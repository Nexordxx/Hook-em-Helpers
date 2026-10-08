import { createClient } from '@supabase/supabase-js'
import { sampleMentors, defaultSettings } from './data'
const url=import.meta.env.VITE_SUPABASE_URL
const key=import.meta.env.VITE_SUPABASE_ANON_KEY
export const isLive=!!(url&&key&&!url.includes('YOUR_PROJECT')&&!key.includes('YOUR_SUPABASE'))
export const supabase=isLive?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null
const STORAGE_KEY='hookem-helpers-v2-DEMO-ONLY'
const sampleState=()=>({mentors:structuredClone(sampleMentors),requests:[],settings:{...defaultSettings}})
function read(){try{const o=JSON.parse(localStorage.getItem(STORAGE_KEY));return o&&Array.isArray(o.mentors)?o:sampleState()}catch{return sampleState()}}
function mutate(cb){const s=read();const v=cb(s);localStorage.setItem(STORAGE_KEY,JSON.stringify(s));window.dispatchEvent(new Event('hh-demo-change'));return v}
const unwrap=({data,error})=>{if(error)throw error;return data}
const sorted=a=>[...a].sort((x,y)=>String(x.full_name).localeCompare(String(y.full_name)))
export const backend={
  async getSettings(){if(!isLive)return read().settings;const r=unwrap(await supabase.from('site_settings').select('*').eq('id',1).maybeSingle());return {...defaultSettings,...r}},
  async setSettings(data){if(!isLive)return mutate(s=>s.settings={...s.settings,...data});return unwrap(await supabase.from('site_settings').update(data).eq('id',1).select().single())},
  async getMentors(){if(!isLive)return sorted(read().mentors.filter(m=>m.status==='approved'));return sorted(unwrap(await supabase.from('volunteer_profiles').select('*').eq('status','approved').order('full_name')))},
  async getMentor(id){if(!isLive)return read().mentors.find(m=>m.id===id&&m.status==='approved')||null;return unwrap(await supabase.from('volunteer_profiles').select('*').eq('id',id).eq('status','approved').maybeSingle())},
  async getMyProfile(id){if(!isLive)return null;return unwrap(await supabase.from('volunteer_profiles').select('*').eq('id',id).maybeSingle())},
  async getMyDocument(id){if(!isLive)return null;return unwrap(await supabase.from('volunteer_documents').select('*').eq('user_id',id).maybeSingle())},
  async saveMyProfile(id,data){if(!isLive)return mutate(s=>{const m={...data,id:id||`demo-${crypto.randomUUID()}`,status:'pending',avatar_url:''};s.mentors.push(m);return m});return unwrap(await supabase.from('volunteer_profiles').upsert({...data,id,status:'pending'},{onConflict:'id'}).select().single())},
  async getRole(id){if(!isLive)return 'admin';const r=unwrap(await supabase.from('user_roles').select('role').eq('user_id',id).maybeSingle());return r?.role||'volunteer'},
  async submitRequest(data){if(!isLive)return mutate(s=>{const r={...data,id:`demo-req-${crypto.randomUUID()}`,status:'pending',created_at:new Date().toISOString(),admin_notes:''};s.requests.unshift(r);return r});unwrap(await supabase.from('mentorship_requests').insert(data));return true},
  async adminMentors(){if(!isLive)return sorted(read().mentors);return sorted(unwrap(await supabase.from('volunteer_profiles').select('*').order('created_at',{ascending:false})))},
  async adminRequests(){if(!isLive)return read().requests;return unwrap(await supabase.from('mentorship_requests').select('*, volunteer_profiles(full_name)').order('created_at',{ascending:false}))},
  async adminSetMentor(id,updates){if(!isLive)return mutate(s=>Object.assign(s.mentors.find(m=>m.id===id),updates));return unwrap(await supabase.from('volunteer_profiles').update(updates).eq('id',id).select().single())},
  async adminSetRequest(id,updates){if(!isLive)return mutate(s=>Object.assign(s.requests.find(r=>r.id===id),updates));return unwrap(await supabase.from('mentorship_requests').update(updates).eq('id',id).select().single())},
  async adminDeleteMentor(id){if(!isLive)return mutate(s=>{s.mentors=s.mentors.filter(m=>m.id!==id)});return unwrap(await supabase.from('volunteer_profiles').update({status:'suspended'}).eq('id',id).select().single())},
  async adminSaveMentor(id,data){if(!isLive)return mutate(s=>Object.assign(s.mentors.find(m=>m.id===id),data));return unwrap(await supabase.from('volunteer_profiles').update(data).eq('id',id).select().single())},
  async uploadPhoto(userId,file){if(!isLive)throw Error('Photos cannot be uploaded in demo mode.');const ext=file.name.split('.').pop().toLowerCase();const path=`${userId}/${crypto.randomUUID()}.${ext}`;unwrap(await supabase.storage.from('mentor-photos').upload(path,file,{contentType:file.type,upsert:false}));return supabase.storage.from('mentor-photos').getPublicUrl(path).data.publicUrl},
  async uploadResume(userId,file){if(!isLive)throw Error('Résumés cannot be uploaded in demo mode.');const path=`${userId}/${crypto.randomUUID()}.pdf`;unwrap(await supabase.storage.from('mentor-resumes').upload(path,file,{contentType:'application/pdf',upsert:false}));unwrap(await supabase.from('volunteer_documents').upsert({user_id:userId,resume_path:path},{onConflict:'user_id'}));return path},
  async getResumeLink(userId){if(!isLive)return null;const doc=unwrap(await supabase.from('volunteer_documents').select('resume_path').eq('user_id',userId).maybeSingle());if(!doc?.resume_path)return null;return unwrap(await supabase.storage.from('mentor-resumes').createSignedUrl(doc.resume_path,90)).signedUrl},
  resetDemo(){if(isLive)return;localStorage.removeItem(STORAGE_KEY);window.dispatchEvent(new Event('hh-demo-change'))}
}
