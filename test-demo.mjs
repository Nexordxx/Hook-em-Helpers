import fs from 'node:fs'
const memories=new Map()
globalThis.localStorage={getItem:k=>memories.get(k)||null,setItem:(k,v)=>memories.set(k,v),removeItem:k=>memories.delete(k)}
globalThis.window={dispatchEvent() {}}
globalThis.Event=class Event {constructor(name){this.name=name}}
let code=fs.readFileSync('./src/backend.js','utf8')
code=code.replace("import { createClient } from '@supabase/supabase-js'",'const createClient=()=>null')
code=code.replace("import { sampleMentors, defaultSettings } from './data'",`import { sampleMentors, defaultSettings } from './data.js'`)
code=code.replaceAll('import.meta.env.VITE_SUPABASE_URL','undefined').replaceAll('import.meta.env.VITE_SUPABASE_ANON_KEY','undefined')
const url=`data:text/javascript;charset=utf-8,${encodeURIComponent(code.replace("from './data.js'",`from 'file://${process.cwd()}/src/data.js'`))}`
const {backend,isLive}=await import(url)
const assert=(x,msg)=>{if(!x)throw Error(msg)}
assert(!isLive,'Demo should be default')
let mentors=await backend.getMentors();assert(mentors.length===6,'6 seeded mentors')
const saved=await backend.saveMyProfile(null,{full_name:'Test Fictional Volunteer',major:'Economics',year:'Junior',bio:'Fictional'.repeat(9),availability:'Friday afternoon',topics:['Math & statistics']})
assert((await backend.getMentors()).length===6,'Pending mentor hidden from public')
assert((await backend.adminMentors()).length===7,'Admin sees pending mentor')
await backend.adminSetMentor(saved.id,{status:'approved'})
assert((await backend.getMentors()).length===7,'Approved mentor shown publicly')
await backend.submitRequest({mentor_id:saved.id,adult_name:'Test Adult',adult_email:'adult@example.com',requester_kind:'parent',grade_band:'high',topic:'Math & statistics',question:'Please provide advice on learning statistics',availability_notes:'Afternoons',adult_confirmed:true})
assert((await backend.adminRequests()).length===1,'Request appears in queue')
const req=(await backend.adminRequests())[0]
await backend.adminSetRequest(req.id,{status:'reviewing',admin_notes:'Test adult follow up'})
assert((await backend.adminRequests())[0].status==='reviewing','Admin edits request')
await backend.setSettings({announcement:'Test announcement'})
assert((await backend.getSettings()).announcement==='Test announcement','Admin edits content')
backend.resetDemo()
assert((await backend.adminRequests()).length===0,'Reset removes sample requests')
assert((await backend.getMentors()).length===6,'Reset restores seed')
console.log('PASS: 6 fictional profiles; pending review gating; admin approval; request queue; request edits; homepage content edits; demo reset.')
