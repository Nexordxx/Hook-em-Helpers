// Supabase Database Webhook recipient. Deploy with JWT verification OFF and require
// the private x-hookem-webhook-secret header configured on each Database Webhook.
// No browser endpoint or client-side Resend key is used here.
import { createClient } from 'npm:@supabase/supabase-js@2'

type EventPayload = {
  type?: string
  table?: string
  schema?: string
  record?: Record<string, unknown>
}

const json = (body: unknown, code = 200) =>
  new Response(JSON.stringify(body), { status: code, headers: { 'content-type': 'application/json' } })

function equalSecret(a: string, b: string) {
  // Constant-time comparison for equal-length values.
  const encoder = new TextEncoder()
  const x = encoder.encode(a)
  const y = encoder.encode(b)
  let mismatch = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    mismatch |= (x[i] ?? 0) ^ (y[i] ?? 0)
  }
  return mismatch === 0
}

const required = (name: string) => {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing server secret: ${name}`)
  return value
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // A publicly callable function is safe only when the webhook secret is strong,
  // private and required for every request. Configure in Supabase Edge Function secrets.
  const secret = Deno.env.get('NOTIFICATION_WEBHOOK_SECRET')
  if (!secret || secret.length < 32 ||
      !equalSecret(req.headers.get('x-hookem-webhook-secret') ?? '', secret)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  try {
    const payload = await req.json() as EventPayload
    if (payload.type !== 'INSERT' || payload.schema !== 'public' ||
        !['mentorship_requests', 'volunteer_profiles'].includes(payload.table ?? '')) {
      return json({ skipped: 'Unsupported event' })
    }
    const recordId = payload.record?.id
    if (typeof recordId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recordId)) {
      return json({ error: 'Invalid record id' }, 400)
    }

    const supabase = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const eventType = payload.table === 'mentorship_requests' ? 'new_mentorship_request' : 'new_volunteer_application'
    // Re-read the actual row under server credentials; never trust webhook-supplied
    // content or email addresses as authoritative.
    const { data: source, error: sourceError } = await supabase
      .from(payload.table)
      .select('id,status')
      .eq('id', recordId)
      .maybeSingle()
    if (sourceError) throw sourceError
    if (!source || source.status !== 'pending') {
      return json({ skipped: 'Source record missing or no longer pending' })
    }

    const { data: admins, error: adminError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
    if (adminError) throw adminError
    if (!admins?.length) return json({ skipped: 'No administrators configured' })

    const baseUrl = 'https://hookemhelpers.com/admin'
    const subject = eventType === 'new_mentorship_request'
      ? 'Hook’Em Helpers: New mentorship request'
      : 'Hook’Em Helpers: New volunteer application'
    const message = eventType === 'new_mentorship_request'
      ? 'A mentorship request has been submitted and is awaiting administrator review.'
      : 'A new volunteer profile has been submitted and is awaiting administrator approval.'
    const html = `<p>${message}</p><p><a href="${baseUrl}">Open the administrator dashboard</a>.</p>
      <p>This message intentionally excludes family and student information. Review requests only in the protected dashboard.</p>`
    const apiKey = required('RESEND_API_KEY')
    const from = required('NOTIFICATION_FROM_EMAIL') // e.g. notifications@hookemhelpers.com
    let sent = 0, skipped = 0, failed = 0

    for (const admin of admins) {
      const uid = admin.user_id as string
      const { data: userResult, error: userError } = await supabase.auth.admin.getUserById(uid)
      if (userError || !userResult?.user?.email) {
        console.error('Admin lookup failed', uid, userError?.message)
        failed++
        continue
      }
      const email = userResult.user.email
      const unique = { event_type: eventType, source_id: recordId, recipient_user_id: uid }
      // Reserve delivery in a separate table. An existing row means this event
      // was already attempted; manual retry procedures are in the rollout docs.
      const { error: reserveError } = await supabase
        .from('notification_deliveries')
        .insert({ ...unique, status: 'processing' })
      if (reserveError?.code === '23505') { skipped++; continue }
      if (reserveError) throw reserveError

      let deliveryStatus = 'failed'
      let detail = ''
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': `hh-${eventType}-${recordId}-${uid}`,
          },
          body: JSON.stringify({
            from: `Hook'Em Helpers <${from}>`,
            to: [email],
            subject,
            html,
          }),
        })
        const result = await response.json().catch(() => ({})) as Record<string, unknown>
        if (!response.ok) throw new Error(`Resend HTTP ${response.status}: ${String(result.message ?? '')}`)
        deliveryStatus = 'sent'
        sent++
      } catch (e) {
        detail = e instanceof Error ? e.message.slice(0, 300) : 'Unknown sending error'
        console.error('Notification failed', eventType, recordId, uid, detail)
        failed++
      }
      const { error: updateError } = await supabase.from('notification_deliveries')
        .update({ status: deliveryStatus, error_detail: detail, updated_at: new Date().toISOString() })
        .match(unique)
      if (updateError) console.error('Unable to update notification log', updateError.message)
    }
    return json({ sent, skipped, failed }, failed ? 503 : 200)
  } catch (e) {
    console.error('Notification handler error', e)
    return json({ error: 'Notification processing failed' }, 500)
  }
})
