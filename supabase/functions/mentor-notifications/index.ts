// Database webhook: email the selected mentor only after a deliberate admin release.
// Deploy --no-verify-jwt and set a strong private x-hookem-webhook-secret header.
// This handler does not grant access to any user or change Supabase Auth.
import { createClient } from 'npm:@supabase/supabase-js@2'

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const secret = (name: string) => {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}
const safe = (value: unknown) => String(value ?? '').replaceAll('&','&amp;')
  .replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'",'&#39;').replace(/\n/g,'<br>')
function constantTimeMatch(a: string, b: string) {
  const encoder = new TextEncoder()
  const aa = encoder.encode(a), bb = encoder.encode(b)
  let difference = aa.length ^ bb.length
  for (let i = 0; i < Math.max(aa.length, bb.length); i++) difference |= (aa[i] ?? 0) ^ (bb[i] ?? 0)
  return difference === 0
}
Deno.serve(async req => {
  if (req.method !== 'POST') return reply({error:'Method not allowed'},405)
  const expected = Deno.env.get('NOTIFICATION_WEBHOOK_SECRET')
  if (!expected || expected.length < 32 ||
      !constantTimeMatch(expected, req.headers.get('x-hookem-webhook-secret') ?? ''))
    return reply({error:'Unauthorized'},401)

  try {
    const event = await req.json()
    if (event.type !== 'UPDATE' || event.schema !== 'public' || event.table !== 'mentorship_requests' ||
        event.old_record?.status === 'approved_for_mentor' ||
        event.record?.status !== 'approved_for_mentor') return reply({skipped:'Not a new approval'})
    const id = event.record?.id
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return reply({error:'Invalid request ID'},400)

    const db = createClient(secret('SUPABASE_URL'),secret('SUPABASE_SERVICE_ROLE_KEY'),
      {auth:{autoRefreshToken:false,persistSession:false}})
    const {data:r,error:readError} = await db.from('mentorship_requests')
      .select('id,mentor_id,status,mentor_contact_consent,mentor_release_authorized,mentor_released_at,mentor_approved_message,adult_name,adult_email,requester_kind,grade_band,topic,availability_notes')
      .eq('id',id).maybeSingle()
    if (readError) throw readError
    if (!r || r.status !== 'approved_for_mentor' || !r.mentor_contact_consent ||
        !r.mentor_release_authorized || !r.mentor_released_at ||
        !r.mentor_approved_message?.trim() || r.mentor_approved_message.trim().length < 15)
      return reply({skipped:'Release gate not satisfied'})

    const {data:mentor,error:mentorError} = await db.from('volunteer_profiles')
      .select('id,status,full_name').eq('id',r.mentor_id).maybeSingle()
    if (mentorError) throw mentorError
    if (!mentor || mentor.status !== 'approved')
      return reply({skipped:'Mentor profile not approved'})

    // The mentor's email is looked up from Auth, never from requester input.
    const {data:mentorAccount,error:accountError} = await db.auth.admin.getUserById(r.mentor_id)
    if (accountError) throw accountError
    if (!mentorAccount?.user?.email) return reply({skipped:'Mentor has no email'})

    const unique = {event_type:'mentor_request_approved',source_id:r.id,recipient_user_id:r.mentor_id}
    const {error:reservationError} = await db.from('notification_deliveries')
      .insert({...unique,status:'processing'})
    if (reservationError?.code === '23505') return reply({skipped:'Already attempted'})
    if (reservationError) throw reservationError

    let state = 'failed',detail = ''
    try {
      const email = mentorAccount.user.email
      const html = `<h2>A mentorship request has been approved for you</h2>
        <p>Hi ${safe(mentor.full_name)}, a program administrator has approved the following adult-coordinated request.</p>
        <p><strong>Adult contact:</strong> ${safe(r.adult_name)} (${safe(r.requester_kind)})<br>
        <strong>Adult email:</strong> <a href="mailto:${encodeURIComponent(r.adult_email)}">${safe(r.adult_email)}</a><br>
        <strong>Student grade band:</strong> ${safe(r.grade_band)}<br>
        <strong>Requested topic:</strong> ${safe(r.topic)}<br>
        <strong>Preferred availability:</strong> ${safe(r.availability_notes || 'Not specified')}</p>
        <p><strong>Coordinator-reviewed request:</strong><br>${safe(r.mentor_approved_message)}</p>
        <p>Please coordinate only with the named adult and follow program-approved supervision and screening procedures.
        Do not contact a minor privately or assume this email is proof of clearance or a booked session.</p>
        <p>Questions? Contact your program administrator through the website: <a href="https://hookemhelpers.com">Hook’Em Helpers</a>.</p>`
      const result = await fetch('https://api.resend.com/emails',{
        method:'POST',
        headers:{'Authorization':`Bearer ${secret('RESEND_API_KEY')}`,'Content-Type':'application/json',
          'Idempotency-Key':`hh-approved-${r.id}-${r.mentor_id}`},
        body:JSON.stringify({from:`Hook'Em Helpers <${secret('NOTIFICATION_FROM_EMAIL')}>`,
          to:[email],subject:'Hook’Em Helpers: Your mentorship request has been approved',html}),
      })
      const responseBody = await result.json().catch(()=>({}))
      if (!result.ok) throw new Error(`Resend HTTP ${result.status}: ${String(responseBody.message ?? '')}`)
      state = 'sent'
    } catch(e) {
      detail = e instanceof Error ? e.message.slice(0,300) : 'Email sending failed'
      console.error('Mentor notification delivery error',id,detail)
    }
    const {error:logError} = await db.from('notification_deliveries')
      .update({status:state,error_detail:detail,updated_at:new Date().toISOString()}).match(unique)
    if (logError) console.error('Could not update mentor email audit',logError.message)
    return reply({status:state},state === 'sent' ? 200 : 503)
  } catch(e) {
    console.error('Mentor release notification error',e)
    return reply({error:'Notification processing failed'},500)
  }
})
