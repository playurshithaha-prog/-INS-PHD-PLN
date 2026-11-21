'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Activity,ArrowUpRight,BookOpen,CalendarDays,ChartNoAxesCombined,ChevronRight,Crosshair,FlaskConical,LayoutDashboard,LogOut,Menu,Settings,Shield,Trophy,X,Zap} from 'lucide-react';
import type {Session} from '@supabase/supabase-js';
import {client,key,url} from '../lib/supabase';
import {defaults} from '../lib/defaults';
import {workspaceSchema,type Workspace as State} from '../lib/model';
import {nyDay,nyMinute} from '../lib/risk';
import {Analytics,Overview} from './dashboard';
import {AccountEditor,Execution,PolicyEditor,Preparation} from './planning';
import {Journal,Playbooks} from './journal';
import {Card,Input,Notice} from './ui';
const configured=!!url&&!!key;
const demoKey='nq-edge-demo-v1';
const navigation=[
 {id:'dashboard',name:'Mission Control',icon:LayoutDashboard,description:'Account risk, session preparation, and journal performance.'},
 {id:'premarket',name:'Premarket',icon:CalendarDays,description:'Map the auction and plan your response before the session.'},
 {id:'execution',name:'Execution Gate',icon:Crosshair,description:'Size the position and record your pre-trade decision.'},
 {id:'playbooks',name:'Playbooks',icon:BookOpen,description:'Edit the setups, evidence, and invalidation criteria you trade.'},
 {id:'journal',name:'Trade Journal',icon:Activity,description:'Record fills, reconcile imports, and review your decisions.'},
 {id:'analytics',name:'Analytics',icon:ChartNoAxesCombined,description:'Review results and execution quality from recorded trades.'},
 {id:'competition',name:'Competition',icon:Trophy,description:'Track manual account observations and account-specific rules.'},
 {id:'settings',name:'Settings',icon:Settings,description:'Set personal risk limits, session preferences, and data access.'},
];
let connection:ReturnType<typeof client>;
function database(){return connection??(connection=client());}
async function api(token:string,method='GET',body?:unknown){
 const response=await fetch('/api/workspace',{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 const payload=await response.json();
 if(!response.ok)throw new Error(payload.error??'Workspace request failed.');
 return payload;
}
export default function Workspace({section}:{section:string}){
 const router=useRouter();
 const [state,setState]=useState<State|null>(null),[session,setSession]=useState<Session|null>(null);
 const [revision,setRevision]=useState(0),[now,setNow]=useState<Date|null>(null),[loaded,setLoaded]=useState(false),[failure,setFailure]=useState(''),[status,setStatus]=useState(''),[menu,setMenu]=useState(false),[saving,setSaving]=useState(false);
 const [loadVersion,reload]=useState(0),[generation,resetGeneration]=useState(0);
 const pending=useRef(false);
 useEffect(()=>{
  const update=()=>setNow(new Date()); update();
  const timer=setInterval(update,15000);
  return ()=>clearInterval(timer);
 },[]);
 useEffect(()=>{
  if(!configured){
   const timer=setTimeout(()=>{
    try{const raw=localStorage.getItem(demoKey);setState(raw?workspaceSchema.parse(JSON.parse(raw)):defaults(true));}
    catch{setFailure('The saved demo workspace could not be read.');}
    setLoaded(true);
   },0);
   return ()=>clearTimeout(timer);
  }
  const db=database()!;
  const subscription=db.auth.onAuthStateChange((_event,next)=>setSession(next));
  db.auth.getSession().then(({data,error})=>{setSession(data.session);if(error)setFailure(error.message);setLoaded(true);});
  return ()=>subscription.data.subscription.unsubscribe();
 },[loadVersion]);
 const userId=session?.user.id;
 useEffect(()=>{
  if(!configured||!userId)return;
  let ignore=false;
  async function load(){
   try{
    const {data}=await database()!.auth.getSession();
    if(!data.session||data.session.user.id!==userId)return;
    const result=await api(data.session.access_token);
    if(ignore)return;
    setState(result?workspaceSchema.parse(result.state):defaults(false)); setRevision(result?.revision??0);setFailure('');
   }catch(e){if(!ignore)setFailure(e instanceof Error?e.message:'Workspace could not load.');}
  }
  void load();
  return ()=>{ignore=true;};
 },[userId,loadVersion]);
 async function save(next:State,message:string){
  if(pending.current)return false;
  const checked=workspaceSchema.safeParse(next);
  if(!checked.success){setStatus(checked.error.issues[0].path.join('.')+' · '+checked.error.issues[0].message);return false;}
  pending.current=true;setSaving(true);setStatus('');
  try{
   if(configured){
    if(!session)throw new Error('Sign in required.');
    const result=await api(session.access_token,'PUT',{state:checked.data,revision});
    setState(workspaceSchema.parse(result.state));setRevision(result.revision);
   }else{localStorage.setItem(demoKey,JSON.stringify(checked.data));setState(checked.data);}
   setStatus(message);return true;
  }catch(e){setStatus(e instanceof Error?e.message:'Save failed.');return false;}
  finally{pending.current=false;setSaving(false);}
 }
 const attachments={
  upload:async(file:File)=>{
   const extensions:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
   if(!extensions[file.type]||file.size>2_000_000)throw new Error('Choose a PNG, JPEG, or WebP image under 2 MB.');
   if(!configured){
    if(file.size>350_000)throw new Error('Demo screenshots are limited to 350 KB.');
    return await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file);});
   }
   if(!session)throw new Error('Sign in required.');
   const path=session.user.id+'/'+crypto.randomUUID()+'.'+extensions[file.type];
   const {error}=await database()!.storage.from('screenshots').upload(path,file);
   if(error)throw error;
   return path;
  },
  resolve:async(path:string)=>{
   if(!configured){if(!/^data:image\/(png|jpeg|webp);base64,/.test(path))throw new Error('Invalid image.');return path;}
   const {data,error}=await database()!.storage.from('screenshots').createSignedUrl(path,60);
   if(error)throw error;
   return data.signedUrl;
  }
 };
 async function erase(){
  if(!window.confirm('Delete all workspace data and screenshots?'))return;
  try{
   if(configured&&session){
    const bucket=database()!.storage.from('screenshots');
    for(;;){const {data,error}=await bucket.list(session.user.id,{limit:100});if(error)throw error;if(!data.length)break;const removed=await bucket.remove(data.map(f=>session.user.id+'/'+f.name));if(removed.error)throw removed.error;if(!removed.data?.length)throw new Error('Screenshot deletion could not be confirmed.');}
    await api(session.access_token,'DELETE');
   }else localStorage.removeItem(demoKey);
   setState(defaults(!configured));setRevision(0);resetGeneration(n=>n+1);setStatus(configured?'Workspace deleted.':'Demo reset.');
  }catch(e){setStatus(e instanceof Error?e.message:'Delete failed.');}
 }
 function exportData(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const href=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=href;a.download='nq-edge-workspace.json';a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
 }
 if(loaded&&configured&&!session)return <Login/>;
 if(failure)return <div className="center"><Card title="Workspace unavailable"><Notice>{failure}</Notice><button className="button secondary" onClick={()=>{setFailure('');reload(n=>n+1);}}>Retry</button>{!configured&&<button className="button secondary" onClick={()=>{if(window.confirm('Clear the unreadable demo data?')){localStorage.removeItem(demoKey);setFailure('');setState(defaults(true));}}}>Reset demo</button>}</Card></div>;
 if(!state||!now)return <div className="center"><div className="brand"><span><Zap size={20}/></span>NQ EDGE</div><p className="subtle">Loading workspace…</p></div>;
 const page=navigation.find(n=>n.id===section);
 const active=nyMinute(now)>=state.policy.start&&nyMinute(now)<state.policy.end;
 const time=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hour12:false}).format(now);
 const end=String(Math.floor(state.policy.end/60)).padStart(2,'0')+':'+String(state.policy.end%60).padStart(2,'0');
 const start=String(Math.floor(state.policy.start/60)).padStart(2,'0')+':'+String(state.policy.start%60).padStart(2,'0');
 return <div className="shell">
 {menu&&<button className="scrim" aria-label="Close navigation" onClick={()=>setMenu(false)}/>}
 <aside className={menu?'sidebar open':'sidebar'}>
 <Link className="brand" href="/dashboard"><span><Zap size={22}/></span><div>NQ<span className="brand-edge"> EDGE</span><small>TRADING COMMAND CENTER</small></div></Link>
 <nav aria-label="Workspace"><div className="nav-label">Workspace</div>{navigation.map(({id,name,icon:Icon},i)=><div key={id}>{i===6&&<div className="nav-label nav-gap">Account</div>}<Link href={'/'+id} className={id===section?'nav-item selected':'nav-item'} aria-current={id===section?'page':undefined} onClick={()=>setMenu(false)}><Icon size={18}/>{name}{id===section&&<ChevronRight className="nav-arrow" size={15}/>}</Link></div>)}</nav>
 <div className="sidebar-bottom"><div className="session-mini"><div><span className={active?'dot':'dot muted'}/> NEW YORK OPEN</div><b>{start}–{end} ET</b><small>{active?'Within trading window':'Outside trading window'}</small></div><div className="identity"><div className="avatar">{configured?'ME':'DE'}</div><div><b>{configured?'Private account':'Demo workspace'}</b><small>{configured?'Signed in':'Sample data'}</small></div>{session&&<button type="button" aria-label="Sign out" className="icon-button" onClick={async()=>{await database()!.auth.signOut();setState(null);setRevision(0);}}><LogOut size={16}/></button>}</div></div>
 </aside>
 <div className="body-area"><header className="topbar"><div><button className="icon-button mobile-toggle" aria-label="Open navigation" onClick={()=>setMenu(true)}>{menu?<X size={18}/>:<Menu size={19}/>}</button><span className="subtle">Workspace</span><ChevronRight size={14}/><strong>{page?.name??'Onboarding'}</strong></div><div className="top-right"><span className="top-clock">{time} ET</span><span className="badge mode">{configured?<Shield size={14}/>:<FlaskConical size={14}/>} {configured?'Private mode':'Demo mode'}</span></div></header>
 <main className="content">
 <div className="page-heading"><div><div className="eyebrow"><span className="dot"/> {state.account.competition?'Competition workspace':'Trading workspace'}</div><h1>{page?.name??'Account onboarding'}</h1><p>{page?.description??'Configure account observations, risk policy, and preferred setups.'}</p></div>{section==='dashboard'&&<Link className="button primary" href="/execution"><Crosshair size={17}/> Run execution check <ArrowUpRight size={16}/></Link>}</div>
 {!configured&&<div className="demo-banner"><FlaskConical size={17}/><div><b>Demo workspace</b><span> · Sample data and changes stay in this browser.</span></div></div>}
 {configured&&!state.onboarded&&section!=='onboarding'&&<Notice><Link href="/onboarding">Complete account onboarding</Link></Notice>}
 {section==='dashboard'&&<div className="section-label"><b>Account overview</b><span>{nyDay(now)} · NEW YORK</span></div>}
 <div className="stack" aria-busy={saving} key={section+':'+generation}>
 {section==='dashboard'&&<Overview state={state} now={now}/>}
 {section==='premarket'&&<Preparation state={state} now={now} save={save} attachments={attachments}/>}
 {section==='execution'&&<Execution state={state} now={now} save={save}/>}
 {section==='competition'&&<AccountEditor state={state} now={now} save={save}/>}
 {section==='journal'&&<Journal state={state} save={save} attachments={attachments}/>}
 {section==='playbooks'&&<Playbooks state={state} save={save} attachments={attachments}/>}
 {section==='analytics'&&<Analytics state={state}/>}
 {section==='settings'&&<><PolicyEditor state={state} save={save}/><Card title="Workspace data"><div className="inline"><button className="button secondary" onClick={exportData}>Export JSON</button><button className="button secondary red" onClick={erase} disabled={saving}>{configured?'Delete workspace data':'Reset demo'}</button><Link href="/onboarding" className="button secondary">Open onboarding</Link></div></Card></>}
 {(section==='onboarding'||section==='login')&&<><AccountEditor state={state} now={now} save={save} onboarding/><PolicyEditor state={state} save={save}/><button className="button primary" onClick={async()=>{if(await save({...state,onboarded:true},'Onboarding complete.'))router.push('/dashboard');}}>Finish onboarding</button></>}
 </div>
 </main>
 {status&&<div className="toast" role="status">{status}<button type="button" aria-label="Dismiss message" className="icon-button" onClick={()=>setStatus('')}><X size={16}/></button></div>}
 </div></div>;
}
function Login(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 return <div className="center"><div className="brand"><span><Zap size={22}/></span>NQ EDGE</div><form className="login" onSubmit={async e=>{e.preventDefault();setBusy(true);try{const {error}=await database()!.auth.signInWithPassword({email,password});if(error)setMessage(error.message);}catch{setMessage('Sign-in request failed.');}finally{setBusy(false);}}}><Card title="Sign in to your workspace"><Input label="Email" type="email" value={email} onChange={setEmail} required/><Input label="Password" type="password" value={password} onChange={setPassword} required/><button className="button primary" disabled={busy}>Sign in</button>{message&&<p className="red" role="alert">{message}</p>}</Card></form></div>;
}
