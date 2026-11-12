import React,{useState,useEffect} from 'react'
import {ShieldCheck,ArrowUpRight,RefreshCcw} from 'lucide-react'
import {backend,isLive} from './backend'
import {friendlyError} from './data'

export function VolunteerVolyStatus({userId}){
  const [status,setStatus]=useState({loading:true,clearance:null,error:''})
  useEffect(()=>{let active=true;if(!isLive||!userId){setStatus({loading:false,clearance:null,error:''});return}
    backend.getMyClearance(userId).then(clearance=>{if(active)setStatus({loading:false,clearance,error:''})}).catch(e=>{if(active)setStatus({loading:false,clearance:null,error:friendlyError(e)})})
    return()=>{active=false}
  },[userId])
  const current=status.clearance&&status.clearance.valid_until>=new Date().toISOString().slice(0,10)
  return <div className="aside-info">
    <ShieldCheck size={28}/><h3>Austin ISD VOLY clearance</h3>
    <p>Apply through the district's volunteer portal. A school-authorized representative must independently confirm clearance to Hook'Em Helpers.</p>
    <a className="button btn-primary" href="https://austinisd.voly.org/" target="_blank" rel="noopener noreferrer">Apply through VOLY <ArrowUpRight size={16}/></a>
    {status.loading?<p>Checking verification…</p>:status.error?<div className="alert alert-error">{status.error}</div>:<p><strong>Status:</strong> {current?'School-confirmed through '+status.clearance.valid_until:status.clearance?'Expired — renewal required':'Not yet school-verified'}</p>}
    <small>Submitting VOLY does not automatically clear you. Never share background-check reports, SSNs or dates of birth here.</small>
  </div>
}

export function VolyClearancePanel({mentors}){
  const [records,setRecords]=useState([])
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
    try{setRecords(await backend.adminClearances())}catch(e){setError(friendlyError(e))}
    finally{setLoading(false)}
  }
  useEffect(()=>{refresh()},[])
  async function verify(e){
    e.preventDefault();setError('');setNotice('')
    if(!confirmed){setError('You must independently confirm approval with an authorized school representative first.');return}
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
    <div className="panel-header"><h2>VOLY school clearance</h2><a className="text-link" href="https://austinisd.voly.org/" target="_blank" rel="noopener noreferrer">Austin ISD VOLY <ArrowUpRight size={16}/></a></div>
    <div className="form-alert"><ShieldCheck size={22}/><p>Record only an independently confirmed approval from an authorized Austin ISD representative. This is NOT an automatic VOLY integration. Keep criminal histories, identity documents and background-check reports out of Hook'Em Helpers. Profile approval and school clearance are separate requirements.</p></div>
    {error&&<div className="alert alert-error">{error}</div>}{notice&&<div className="alert alert-good">{notice}</div>}
    {loading?<p>Checking clearance records…</p>:<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Mentor</th><th>School verification</th><th>Valid through</th><th>Actions</th></tr></thead><tbody>{mentors.map(m=>{const c=records.find(x=>x.mentor_id===m.id);return <tr key={m.id}><td><strong>{m.full_name}</strong><small>{m.major}</small></td><td>{c?(c.valid_until>=today?'Verified':'Expired'):'Not verified'}</td><td>{c?.valid_until||'—'}</td><td><button className="button btn-outline btn-tiny" type="button" onClick={()=>{setSelected(m.id);setConfirmed(false)}}>Select</button> {c&&<button className="button btn-outline btn-tiny" type="button" disabled={busy} onClick={()=>revoke(m.id)}>Revoke</button>}</td></tr>})}</tbody></table></div>}
    <form className="content-form" onSubmit={verify}>
      <h3>Record independent school confirmation</h3>
      <div className="form-field"><label htmlFor="voly-mentor">Volunteer</label><select id="voly-mentor" value={selected} required onChange={e=>{setSelected(e.target.value);setConfirmed(false)}}><option value="">Choose a volunteer</option>{mentors.map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}</select></div>
      <div className="form-grid"><div className="form-field"><label htmlFor="voly-year">School year</label><input id="voly-year" required pattern="[0-9]{4}-[0-9]{4}" value={schoolYear} onChange={e=>setSchoolYear(e.target.value)}/></div>
      <div className="form-field"><label htmlFor="voly-expiry">Clearance valid through</label><input id="voly-expiry" required type="date" value={validUntil} onChange={e=>setValidUntil(e.target.value)}/></div></div>
      <label className="form-field"><span><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I personally confirmed current VOLY approval with an authorized school representative.</span></label>
      <button className="button btn-primary" disabled={busy||!confirmed||!selected}>Record verification <ShieldCheck size={16}/></button>
      <button type="button" className="button btn-outline" onClick={refresh}><RefreshCcw size={16}/> Refresh</button>
    </form>
  </div>
}
