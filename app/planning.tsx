'use client';
import {useState} from 'react';
import {Save} from 'lucide-react';
import {blankPlan,levels,regimes,scenario} from '../lib/defaults';
import type {Workspace} from '../lib/model';
import {analytics} from '../lib/analytics';
import {assess,cents,drawdown,money,nyDay,roundTick,type TradePlan} from '../lib/risk';
import {sessionState} from '../lib/model';
import {Attachments,type AttachmentProps} from './journal';
import {Card,Chart,Check,Input,Metric,Note,Notice,Select} from './ui';
export type SaveState=(state:Workspace,message:string)=>Promise<boolean>;
export function Preparation({state,now,save,attachments}:{state:Workspace;now:Date;save:SaveState;attachments:AttachmentProps}){
 const [day,setDay]=useState(nyDay(now));
 return <><Input label="New York session date" type="date" value={day} onChange={setDay}/><PlanForm key={day} initial={state.plans.find(p=>p.day===day)??blankPlan(day)} state={state} save={save} attachments={attachments}/></>;
}
function PlanForm({initial,state,save,attachments}:{initial:ReturnType<typeof blankPlan>;state:Workspace;save:SaveState;attachments:AttachmentProps}){
 const [plan,set]=useState(initial);
 return <form className="stack" onSubmit={e=>{e.preventDefault();void save({...state,plans:[...state.plans.filter(p=>p.day!==plan.day),plan]},'Premarket plan saved.')}}>
 <Card title="Auction and reference levels"><div className="fields"><Select label="Auction context" value={plan.context} onChange={context=>set({...plan,context})} options={['',...regimes]}/>{levels.map(label=><Input key={label} label={label} value={plan.levels[label]??''} onChange={v=>set({...plan,levels:{...plan.levels,[label]:v}})}/>)}</div><Note label="Preparation notes" value={plan.notes} onChange={notes=>set({...plan,notes})}/><Attachments paths={plan.screenshots} onChange={screenshots=>set({...plan,screenshots})} {...attachments}/></Card>
 <div className="two">{(['bull','bear'] as const).map(side=><Card key={side} title={side==='bull'?'Bullish scenario':'Bearish scenario'}>{scenario.map(label=>label==='Playbook'?<Select key={label} label={label} value={plan[side][label]??''} options={['',...state.playbooks.map(p=>[p.id,p.name] as [string,string])]} onChange={v=>set({...plan,[side]:{...plan[side],[label]:v}})}/>:<Input key={label} label={label} value={plan[side][label]??''} onChange={v=>set({...plan,[side]:{...plan[side],[label]:v}})}/>)}</Card>)}</div>
 <Card title="Gamma context"><p className="subtle">Record the source and reference instrument. Options strikes and futures prices are distinct references.</p><div className="fields">{[['Gamma regime',['','Positive','Negative','Uncertain']],['Reference instrument',['','NDX','SPX','SPY','NQ']]].map(([label,options])=><Select key={label as string} label={label as string} options={options as string[]} value={plan.gex[label as string]??''} onChange={v=>set({...plan,gex:{...plan.gex,[label as string]:v}})}/>)}{['Call wall','Put wall','Major concentrations','Source','Observation timestamp','Volatility implications','Notes'].map(label=><Input key={label} label={label} value={plan.gex[label]??''} onChange={v=>set({...plan,gex:{...plan.gex,[label]:v}})}/>)}</div></Card>
 <Card title="Session review"><Note label="Review and reasons for standing aside" value={plan.review} onChange={review=>set({...plan,review})}/></Card>
 <button className="button primary" type="submit"><Save size={17}/> Save premarket plan</button></form>;
}
export function Execution({state,now,save}:{state:Workspace;now:Date;save:SaveState}){
 const [plan,set]=useState<TradePlan>({instrument:state.policy.instrument,side:'long',entry:0,stop:0,quantity:1,playbook:'',level:'',context:'',trigger:'',footprint:'',exitPlan:'',emotion:'',extension:0,acknowledgement:''});
 const [result,setResult]=useState('');
 const session=sessionState(state,now);
 const assessment=assess(state.account,state.policy,state.closes,session,plan,now);
 return <><div className="metrics"><Metric label="Risk per contract" value={assessment.unit?money(assessment.unit):'—'}/><Metric label="Available risk budget" value={money(assessment.budget)}/><Metric label="Maximum contracts" value={assessment.max} detail={plan.instrument+' contracts'}/><Metric label="Estimated risk" value={assessment.unit?money(assessment.unit*plan.quantity):'—'}/></div>
 <form className="dashboard-grid" onSubmit={async e=>{e.preventDefault(); const time=new Date();const checked=assess(state.account,state.policy,state.closes,sessionState(state,time),plan,time); const ok=await save({...state,approvals:[...state.approvals,{id:crypto.randomUUID(),time:time.toISOString(),plan,result:checked.result,blocks:checked.blocks,warnings:checked.warnings}]},'Execution check recorded.');if(ok)setResult('Execution check recorded. See history below.');}}>
 <Card title="Trade checklist"><div className="fields">
 <Select label="Instrument" value={plan.instrument} onChange={v=>set({...plan,instrument:v as TradePlan['instrument']})} options={['NQ','MNQ']}/>
 <Select label="Direction" value={plan.side} onChange={v=>set({...plan,side:v as TradePlan['side']})} options={['long','short']}/>
 {(['entry','stop','quantity','extension'] as const).map((key,i)=><Input key={key} label={['Entry price','Structural stop','Planned contracts','Extension from reference · ticks'][i]} type="number" step={i<2?'any':1} min={0} value={plan[key]||''} onChange={v=>set({...plan,[key]:Number(v)})}/>)}
 </div><button type="button" className="button secondary" onClick={()=>set({...plan,entry:roundTick(plan.entry),stop:roundTick(plan.stop)})}>Round prices to nearest tick</button>
 <div className="fields"><Select label="Playbook" value={plan.playbook} onChange={playbook=>set({...plan,playbook})} options={['',...state.playbooks.filter(p=>state.policy.playbooks.includes(p.id)).map(p=>[p.id,p.name] as [string,string])]}/>
 <Select label="Emotional state" value={plan.emotion} onChange={emotion=>set({...plan,emotion})} options={['','calm','FOMO','revenge','uncertain']}/>
 {(['level','context','trigger','footprint','exitPlan'] as const).map((key,i)=><Input key={key} label={['Meaningful reference level','15-minute auction context','1-minute entry trigger','Footprint evidence','Target or exit plan'][i]} value={plan[key]} onChange={v=>set({...plan,[key]:v})}/>)}</div>
 </Card><Card title="Approval result"><p className={assessment.blocks.length?'red':'green'}><b>{assessment.result}</b></p>
 {assessment.blocks.map(v=><p className="reason" key={v}>{v}</p>)}{assessment.warnings.map(v=><p key={v} className="reason amber">{v}</p>)}
 {!!assessment.warnings.length&&<Note label="Written acknowledgement" value={plan.acknowledgement} onChange={acknowledgement=>set({...plan,acknowledgement})}/>}
 <p className="subtle">Application-level approval only. Orders remain under your control.</p><button className="button primary" type="submit">Record execution check</button><p role="status">{result}</p></Card></form>
 <Card title="Execution history">{state.approvals.length?state.approvals.slice().reverse().map(a=><div className="history" key={a.id}><b>{a.result}</b><small>{new Date(a.time).toLocaleString('en-US',{timeZone:'America/New_York'})} ET · {a.plan.quantity} {a.plan.instrument}</small>{[...a.blocks,...a.warnings].map(v=><div key={v} className="subtle">{v}</div>)}{a.plan.acknowledgement&&<div>{a.plan.acknowledgement}</div>}</div>):<p className="subtle">No execution checks recorded.</p>}</Card></>;
}
const dollar=(v:string)=>cents(Number(v));
export function AccountEditor({state,now,save,onboarding=false}:{state:Workspace;now:Date;save:SaveState;onboarding?:boolean}){
 const [account,set]=useState(state.account),[day,setDay]=useState(nyDay(now)),[closing,setClosing]=useState('');
 const a=state.account,d=drawdown(a,state.closes,now), dayNow=nyDay(now);
 let days=0;
 if(a.endDate>=dayNow){const cursor=new Date(Math.max(Date.parse(a.startDate),Date.parse(dayNow)));const end=Date.parse(a.endDate);while(cursor.getTime()<=end){if(cursor.getUTCDay()%6!==0)days++;cursor.setUTCDate(cursor.getUTCDate()+1);}}
 const stats=analytics(state.trades), session=sessionState(state,now);
 return <>
 {!onboarding&&<><div className="metrics"><Metric label="Balance" value={a.balance===null?'—':money(a.balance)} detail={a.observed?(d&&d.age<=state.policy.staleMinutes*60000?a.source:'Stale · '+a.source):'No observation'}/><Metric label="Equity" value={a.equity===null?'—':money(a.equity)} detail={a.observed||'No observation'}/><Metric label="Drawdown cushion" value={d?money(d.cushion):'—'} detail={d?'Floor '+money(d.floor):'Account data required'}/><Metric label="Weekdays remaining" value={days} detail="Excludes weekends only"/></div>
 <Card title="Account performance"><div className="stat-list">{Object.entries({'Profit accumulated':a.balance===null?'—':money(a.balance-a.starting),'Unrealized P&L':a.equity===null||a.balance===null?'—':money(a.equity-a.balance),'Journal realized P&L':stats.rows.length?money(stats.total):'—','Session P&L':money(session.net),'EOD high-water mark':d?money(d.high):'—','Daily risk remaining':money(Math.max(0,Math.min(state.policy.daily,a.officialDaily??Infinity)+Math.min(0,session.net)-a.openRisk)),'Rule status':a.confirmed?'Confirmed by you':'Unverified'}).map(([k,v])=><div key={k}><span>{k}</span><b>{v}</b></div>)}</div></Card></>}
 <form className="stack" onSubmit={e=>{e.preventDefault();void save({...state,account},'Account rules and observation saved.');}}>
 <Card title="Account and competition rules"><Notice>Phidias reference terms are provisional and require your confirmation against your account agreement. Review the trailing floor, contract limits, and liquidation terms.</Notice>
 <div className="fields"><Input label="Account name" value={account.name} onChange={name=>set({...account,name})}/><Select label="Account mode" value={account.competition?'competition':'normal'} onChange={v=>set({...account,competition:v==='competition'})} options={['competition','normal']}/>
 <Input label="Start date" type="date" value={account.startDate} onChange={startDate=>set({...account,startDate,confirmed:false})}/><Input label="End date" type="date" value={account.endDate} onChange={endDate=>set({...account,endDate,confirmed:false})}/>
 <Input label="Rules version" value={account.version} onChange={version=>set({...account,version,confirmed:false})}/><Input label="Verification date" type="date" value={account.verifiedDate} onChange={verifiedDate=>set({...account,verifiedDate})}/>
 <Select label="Drawdown model" value={account.model} options={['static',['eod','End-of-day trailing']]} onChange={v=>set({...account,model:v as typeof account.model,confirmed:false})}/>
 {(['starting','allowance','cap','buffer','officialDaily','balance','equity','openRisk'] as const).map((key,i)=><Input key={key} type="number" step=".01" label={['Starting balance ($)','Drawdown allowance ($)','Optional trailing floor cap ($)','Personal safety buffer ($)','Optional official daily loss limit ($)','Current balance ($)','Current equity ($)','Existing open-position risk ($)'][i]} value={account[key]===null?'':account[key]/100} onChange={v=>{const value=v===''&&(key==='balance'||key==='equity'||key==='cap'||key==='officialDaily')?null:dollar(v);set({...account,[key]:value,confirmed:i<5&&key!=='buffer'?false:account.confirmed});}}/>)}
 {(['maxNq','maxMnq','maxExposure','openNq','openMnq'] as const).map((key,i)=><Input key={key} label={['NQ limit','MNQ limit','Combined limit · MNQ equivalents','Open NQ contracts','Open MNQ contracts'][i]} type="number" min={0} step={1} value={account[key]} onChange={v=>set({...account,[key]:Number(v),confirmed:i<3?false:account.confirmed})}/>)}
 <Input label="Highest eligible EOD close to date ($)" type="number" step=".01" value={account.baselineHigh===null?'':account.baselineHigh/100} onChange={v=>set({...account,baselineHigh:v?dollar(v):null})}/>
 <Select label="Observation source" value={account.source} options={['manual','imported']} onChange={v=>set({...account,source:v as typeof account.source})}/>
 <Input label="Observed at · ISO timestamp" value={account.observed} onChange={observed=>set({...account,observed})}/>
 </div><button type="button" className="button secondary" onClick={()=>set({...account,observed:new Date().toISOString()})}>Set observation time to now</button>
 <Check label="I verified these rules against my account agreement" checked={account.confirmed} onChange={confirmed=>set({...account,confirmed})}/>
 </Card><button className="button primary">Save account</button></form>
 {!onboarding&&<><form onSubmit={e=>{e.preventDefault(); if(day>=dayNow||!closing)return;void save({...state,closes:[...state.closes.filter(c=>c.day!==day),{day,balance:dollar(closing)}]},'EOD close saved.');}}><Card title="Record end-of-day balance"><p className="subtle">Closing balances become eligible on the following New York calendar day. Enter the starting balance as the high-water baseline only for a new account.</p><div className="fields"><Input label="Completed session date" type="date" required value={day} onChange={setDay}/><Input label="Closing balance ($)" type="number" required step=".01" value={closing} onChange={setClosing}/></div><button className="button secondary" disabled={day>=dayNow}>Save EOD balance</button></Card></form>
 <div className="two"><Card title="EOD balance observations"><Chart items={state.closes.slice().sort((a,b)=>a.day.localeCompare(b.day)).map(c=>({label:c.day,value:c.balance}))}/></Card><Card title="Realized journal drawdown"><Chart items={stats.curve.map(p=>({label:p.label,value:p.drawdown}))}/></Card></div></>}
 </>;
}
export function PolicyEditor({state,save}:{state:Workspace;save:SaveState}){
 const [policy,set]=useState(state.policy);
 const fields=['perTrade','daily','maxTrades','cooldown','commission','slippage','extension','staleMinutes'] as const;
 const times=['start','end'] as const;
 return <form className="stack" onSubmit={e=>{e.preventDefault();void save({...state,policy},'Personal policy saved.');}}><Card title="Personal risk policy"><div className="fields"><Select label="Preferred instrument" value={policy.instrument} options={['NQ','MNQ']} onChange={v=>set({...policy,instrument:v as typeof policy.instrument})}/>
 {fields.map((key,i)=>{const usd=[0,1,4].includes(i);return <Input key={key} type="number" min={0} step={usd?'.01':1} label={['Risk per trade ($)','Daily loss limit ($)','Maximum trades','Cooldown (minutes)','Round-trip commission per contract ($)','Round-trip slippage (ticks)','Chasing threshold (ticks)','Observation expiry (minutes)'][i]} value={usd?policy[key]/100:policy[key]} onChange={v=>set({...policy,[key]:usd?dollar(v):Number(v)})}/>})}
 {times.map(key=><Input key={key} type="time" label={key==='start'?'New York window start':'New York window end'} value={String(Math.floor(policy[key]/60)).padStart(2,'0')+':'+String(policy[key]%60).padStart(2,'0')} onChange={v=>{const [h,m]=v.split(':').map(Number);if(v)set({...policy,[key]:60*h+m});}}/>)}
 </div></Card><Card title="Preferred playbooks">{state.playbooks.map(p=><Check key={p.id} label={p.name} checked={policy.playbooks.includes(p.id)} onChange={v=>set({...policy,playbooks:v?[...policy.playbooks,p.id]:policy.playbooks.filter(id=>id!==p.id)})}/>)}</Card><button className="button primary">Save personal policy</button></form>;
}
