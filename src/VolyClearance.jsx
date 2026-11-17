import React,{useState,useEffect} from 'react'
import {ShieldCheck,ArrowUpRight,RefreshCcw} from 'lucide-react'
import {backend,isLive} from './backend'
import {friendlyError} from './data'

export function VolunteerVolyStatus({userId}){
  const [status,setStatus]=useState({loading:true,clearance:null,progress:null,error:''})
  const [saving,setSaving]=useState(false)
  const [notice,setNotice]=useState('')
  useEffect(()=>{let active=true;if(!isLive||!userId){setStatus({loading:false,clearance:null,progress:null,error:''});return}
    Promise.all([backend.getMyClearance(userId),backend.getVolyProgress(userId)]).then(([clearance,progress])=>{if(active)setStatus({loading:false,clearance,progress,error:''})}).catch(e=>{if(active)setStatus({loading:false,clearance:null,progress:null,error:friendlyError(e)})})
    return()=>{active=false}
  },[userId])
  const current=status.clearance&&status.clearance.valid_until>=new Date().toISOString().slice(0,10)
  async function updateStage(stage){setSaving(true);setNotice('');try{const progress=await backend.setVolyProgress(userId,stage);setStatus(v=>({...v,progress,error:''}));setNotice('Your application progress was saved. This is not background-check clearance.')}catch(e){setStatus(v=>({...v,error:friendlyError(e)}))}finally{setSaving(false)}}
  return <div className="aside-info">
    <ShieldCheck size={28}/><h3>Austin ISD VOLY screening</h3>
    <p>Complete the official Austin ISD volunteer application through VOLY. No Garza administrator needs an account on Hook'Em Helpers to track your progress.</p>
    <a className="button btn-primary" href="https://austinisd.voly.org/" target="_blank" rel="noopener noreferrer">Open Austin ISD VOLY <ArrowUpRight size={16}/></a>
    {status.loading?<p>Checking status…</p>:status.error?<div className="alert alert-error">{status.error}</div>:<><p><strong>Verified clearance:</strong> {current?'Confirmed through '+status.clearance.valid_until:status.clearance?'Expired — renewal required':'Not independently confirmed yet'}</p>
    <div className="form-field"><label htmlFor="voly-stage">Your VOLY application progress (self-reported)</label><select id="voly-stage" disabled={saving} value={status.progress?.stage||'not_started'} onChange={e=>updateStage(e.target.value)}><option value="not_started">Not started</option><option value="application_submitted">Application submitted</option><option value="approval_email_received">I received an approval email</option></select></div></>}
    {notice&&<div className="alert alert-good">{notice}</div>}
    <small>Self-reported progress does not count as clearance. Our program must independently confirm current district approval before matching mentors. Do not upload background reports, SSNs or dates of birth.</small>
  </div>
}

export function VolyClearancePanel({mentors}){
  const [records,setRecords]=useState([])
  const [progress,setProgress]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [busy,setBusy]=useState(false)
  const [selected,setSelected]=useState('')
  const [schoolYear,setSchoolYear]=useState(()=>{const d=new Date(),y=d.getFullYear(),start=d.getMonth()>=7?y:y-1;return start+'-'+(start+1)})
  const [validUntil,setValidUntil]=useState('')
  const [confirmed,setConfirmed]=useState(false)
  async function refresh(){
    setLoading(true);setError('')
    try{const [clearances,stages]=await Promise.all([backend.adminClearances(),backend.adminVolyProgress()]);setRecords(clearances);setProgress(stages)}catch(e){setError(friendlyError(e))}
    finally{setLoading(false)}
  }
  useEffect(()=>{refresh()},[])
  async function verify(e){
    e.preventDefault();setError('');setNotice('')
    if(!confirmed){setError('You must independently confirm current approval with Austin ISD or another authorized district source first.');return}
    if(!selected||!/^\d{4}-\d{4}$/.test(schoolYear)||!validUntil){setError('Choose a volunteer, school year and valid-through date.');return}
    if(validUntil<new Date().toISOString().slice(0,10)){setError('Verification cannot be recorded with an expired date.');return}
    setBusy(true)
    try{await backend.adminVerifyClearance(selected,schoolYear,validUntil);setNotice('School verification recorded.');setConfirmed(false);await refresh()}
    catch(e){setError(friendlyError(e))}
    finally{setBusy(false)}
  }
  async function revoke(id){
    if(!window.confirm('Revoke clearance? This will remove the mentor from the public directory and stop new mentorship requests.'))return
    setBusy(true);setError('')
    try{await backend.adminRevokeClearance(id);setNotice('Clearance revoked.');await refresh()}
    catch(e){setError(friendlyError(e))}
    finally{setBusy(false)}
  }
  const today=new Date().toISOString().slice(0,10)
  return <div className="admin-panel">
    <div className="panel-header"><h2>VOLY screening review</h2><a className="text-link" href="https://austinisd.voly.org/" target="_blank" rel="noopener noreferrer">Austin ISD VOLY <ArrowUpRight size={16}/></a></div>
    <div className="form-alert"><ShieldCheck size={22}/><p>A Garza administrator does not need to verify or use this platform. A Hook'Em Helpers administrator can record clearance after independently confirming it with an authorized Austin ISD source. This is NOT an automatic VOLY integration. Keep criminal histories, identity documents and background-check reports out of Hook'Em Helpers. Profile approval and school clearance are separate requirements.</p></div>
    {error&&<div className="alert alert-error">{error}</div>}{notice&&<div className="alert alert-good">{notice}</div>}
    {loading?<p>Checking clearance records…</p>:<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Mentor</th><th>VOLY application (self-reported)</th><th>Independently verified</th><th>Valid through</th><th>Actions</th></tr></thead><tbody>{mentors.map(m=>{const c=records.find(x=>x.mentor_id===m.id);return <tr key={m.id}><td><strong>{m.full_name}</strong><small>{m.major}</small></td><td>{({not_started:'Not started',application_submitted:'Submitted',approval_email_received:'Claims approval email'})[progress.find(x=>x.mentor_id===m.id)?.stage||'not_started']}</td><td>{c?(c.valid_until>=today?'Verified':'Expired'):'Not verified'}</td><td>{c?.valid_until||'—'}</td><td><button className="button btn-outline btn-tiny" type="button" onClick={()=>{setSelected(m.id);setConfirmed(false)}}>Select</button> {c&&<button className="button btn-outline btn-tiny" type="button" disabled={busy} onClick={()=>revoke(m.id)}>Revoke</button>}</td></tr>})}</tbody></table></div>}
    <form className="content-form" onSubmit={verify}>
      <h3>Record independently confirmed district clearance</h3>
      <div className="form-field"><label htmlFor="voly-mentor">Volunteer</label><select id="voly-mentor" value={selected} required onChange={e=>{setSelected(e.target.value);setConfirmed(false)}}><option value="">Choose a volunteer</option>{mentors.map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}</select></div>
      <div className="form-grid"><div className="form-field"><label htmlFor="voly-year">School year</label><input id="voly-year" required pattern="[0-9]{4}-[0-9]{4}" value={schoolYear} onChange={e=>setSchoolYear(e.target.value)}/></div>
      <div className="form-field"><label htmlFor="voly-expiry">Clearance valid through</label><input id="voly-expiry" required type="date" value={validUntil} onChange={e=>setValidUntil(e.target.value)}/></div></div>
      <label className="form-field"><span><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I independently confirmed current VOLY approval with Austin ISD or another authorized district source; I did not rely on a volunteer's claim alone.</span></label>
      <button className="button btn-primary" disabled={busy||!confirmed||!selected}>Record verification <ShieldCheck size={16}/></button>
      <button type="button" className="button btn-outline" onClick={refresh}><RefreshCcw size={16}/> Refresh</button>
    </form>
  </div>
}
