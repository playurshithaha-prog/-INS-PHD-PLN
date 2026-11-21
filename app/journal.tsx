'use client';
import {useState} from 'react';
import { Plus, Upload } from 'lucide-react';
import {columns,parseCsv,previewCsv, type Column} from '../lib/imports';
import {discipline,newTrade,tradeStats,type Trade,type Workspace} from '../lib/model';
import {regimes} from '../lib/defaults';
import {cents,money} from '../lib/risk';
import {TradeTable} from './dashboard';
import {Card,Check,Field,Input,Note,Notice,Select} from './ui';
import type {SaveState} from './planning';
export type AttachmentProps={upload:(file:File)=>Promise<string>; resolve:(path:string)=>Promise<string>};
export function Attachments({paths,onChange,upload,resolve}:{paths:string[];onChange:(v:string[])=>void}&AttachmentProps){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <div className="attachments"><Field label="Attach screenshot · PNG, JPEG or WebP"><input type="file" disabled={busy||paths.length>=10} accept="image/png,image/jpeg,image/webp" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;setError('');setBusy(true);try{onChange([...paths,await upload(file)]);}catch(err){setError(err instanceof Error?err.message:'Upload failed.');}finally{setBusy(false);}}}/></Field>{paths.map((p,i)=><div key={p} className="inline"><button type="button" className="small-button" onClick={async()=>{try{const url=await resolve(p);const a=document.createElement('a');a.href=url;a.download='screenshot-'+(i+1);if(!url.startsWith('data:')){a.target='_blank';a.rel='noopener noreferrer';}a.click();}catch{setError('Screenshot could not be opened.');}}}>Open screenshot {i+1}</button><button type="button" className="small-button" onClick={()=>onChange(paths.filter(s=>s!==p))}>Detach</button></div>)}{error&&<p role="alert">{error}</p>}</div>;
}
export function Journal({state,save,attachments}:{state:Workspace;save:SaveState;attachments:AttachmentProps}){
 const [trade,set]=useState<Trade|null>(null),[importing,setImporting]=useState(false);
 return <>
 <div className="inline"><button className="button primary" onClick={()=>{setImporting(false);set(newTrade(state.policy.instrument));}}><Plus size={17}/> Record trade</button><button className="button secondary" onClick={()=>{set(null);setImporting(!importing);}}><Upload size={16}/> Import CSV</button></div>
 {importing&&<Importer state={state} save={save}/>}
 {trade&&<TradeForm key={trade.id} initial={trade} state={state} save={save} close={()=>set(null)} attachments={attachments}/>}
 <Card title="Trade journal"><TradeTable state={state} onEdit={id=>{setImporting(false);set(state.trades.find(t=>t.id===id)??null);}}/></Card>
 </>;
}
function TradeForm({initial,state,save,close,attachments}:{initial:Trade;state:Workspace;save:SaveState;close:()=>void;attachments:AttachmentProps}){
 const makeFill=()=>({price:0,quantity:1,time:new Date().toISOString()});
 const [t,set]=useState({...initial,entries:initial.entries.length?initial.entries:[makeFill()],exits:initial.exits.length?initial.exits:[makeFill()]});
 const stats=tradeStats(t),score=discipline(t);
 return <form className="stack" onSubmit={async e=>{e.preventDefault();if(await save({...state,trades:[...state.trades.filter(x=>x.id!==t.id),t]},'Trade saved.'))close();}}>
 <Card title="Group trade fills"><div className="fields"><Select label="Instrument" value={t.instrument} options={['NQ','MNQ']} onChange={v=>set({...t,instrument:v as Trade['instrument']})}/><Select label="Direction" value={t.side} options={['long','short']} onChange={v=>set({...t,side:v as Trade['side']})}/><Select label="Playbook" value={t.playbook} options={['',...state.playbooks.map(p=>[p.id,p.name] as [string,string])]} onChange={playbook=>set({...t,playbook})}/>
 <Select label="Link execution approval" value={t.approvalId??''} options={['',...state.approvals.filter(a=>a.result==='Approved under personal rules'&&a.plan.instrument===t.instrument&&a.plan.side===t.side&&!state.trades.some(other=>other.id!==t.id&&other.approvalId===a.id)).map(a=>[a.id,a.time+' · '+a.plan.instrument] as [string,string])]} onChange={v=>set({...t,approvalId:v||undefined})}/>
 <Select label="Market regime" value={t.regime} options={['',...regimes]} onChange={regime=>set({...t,regime})}/>
 <Select label="Emotion before entry" value={t.emotion} options={['','calm','FOMO','revenge','uncertain']} onChange={emotion=>set({...t,emotion})}/>
 {(['stop','target','commission','risk'] as const).map((key,i)=><Input key={key} label={['Stop','Target','Total commissions ($)','Planned risk ($)'][i]} type="number" step={i<2?'.25':'.01'} min={0} value={t[key]===null?'':i<2?t[key]:t[key]/100} onChange={v=>set({...t,[key]:i<2?v?Number(v):null:cents(Number(v))})}/>)}</div>
 {(['entries','exits'] as const).map(key=><div key={key} className="fill"><h3>{key==='entries'?'Entry fills':'Exit fills'}</h3>{t[key].map((fill,i)=><div className="fill-row" key={i}>{(['price','quantity','time'] as const).map((f,j)=><Input key={f} label={['Price','Quantity','Timestamp · ISO with offset'][j]} type={j===2?'text':'number'} min={j===2?undefined:j===0?.25:1} step={j===0?.25:1} required value={fill[f]||''} onChange={v=>set({...t,[key]:t[key].map((p,index)=>index===i?{...p,[f]:j===2?v:Number(v)}:p)})}/>)}<button type="button" className="small-button" disabled={t[key].length===1} onClick={()=>set({...t,[key]:t[key].filter((_,j)=>i!==j)})}>Remove</button></div>)}<button type="button" className="button secondary" onClick={()=>set({...t,[key]:[...t[key],makeFill()]})}>Add {key==='entries'?'entry':'exit'} fill</button></div>)}
 <p className="subtle">Recorded estimate · Gross {money(stats.gross)} · Net {money(stats.net)}</p></Card>
 <Card title="Post-trade review"><div className="fields">{(['levels','flow','mistakes','notes'] as const).map((key,i)=><Note key={key} label={['Reference levels','Order-flow observations','Mistakes','Review notes'][i]} value={t[key]} onChange={v=>set({...t,[key]:v})}/>)}</div>
 {(['riskFollowed','setupFollowed','prepared','reviewed'] as const).map((key,i)=><Check key={key} checked={t[key]} onChange={v=>set({...t,[key]:v})} label={['Followed risk policy','Followed playbook setup','Prepared before the session','Completed review'][i]}/>)}
 <p>Process score <b>{score.score} / 100</b></p><ul>{score.criteria.map(c=><li key={c.label}>{c.label} · {c.points} points</li>)}</ul>
 <Attachments paths={t.screenshots} onChange={screenshots=>set({...t,screenshots})} {...attachments}/></Card>
 <div className="inline"><button className="button primary" type="submit">Save trade</button><button className="button secondary" type="button" onClick={close}>Cancel</button></div></form>;
}
function Importer({state,save}:{state:Workspace;save:SaveState}){
 const [csv,setCsv]=useState<ReturnType<typeof parseCsv>|null>(null),[file,setFile]=useState(''),[error,setError]=useState('');
 const [mapping,map]=useState(Object.fromEntries(columns.map(c=>[c,c])) as Record<Column,string>);
 const result=csv?previewCsv(csv.data,mapping,state.trades):null;
 return <Card title="CSV import"><p className="subtle">One row per closed trade. Use NQ or MNQ, long or short, and ISO timestamps with an offset. Commission is in dollars.</p>
 <Field label="CSV file"><input type="file" accept=".csv,text/csv" onChange={async e=>{const next=e.target.files?.[0];if(!next)return;setCsv(null);setError('');if(next.size>2_000_000){setError('CSV must be smaller than 2 MB.');return;}try{const parsed=parseCsv(await next.text());setCsv(parsed);setFile(next.name);map(Object.fromEntries(columns.map(c=>[c,parsed.meta.fields?.find(f=>f.toLowerCase()===c)??''])) as Record<Column,string>);}catch{setError('CSV could not be read.');}}}/></Field>
 {error&&<Notice>{error}</Notice>}
 {csv&&result&&<><div className="fields">{columns.map(c=><Select key={c} label={c} value={mapping[c]} options={['',...(csv.meta.fields??[])]} onChange={v=>map({...mapping,[c]:v})}/>)}</div>
 <p role="status">{result.trades.length} valid · {result.duplicates} duplicates · {result.errors.length+csv.errors.length} errors</p>
 {[...csv.errors.map(x=>x.message),...result.errors].slice(0,20).map((v,i)=><div className="red" key={i}>{v}</div>)}
 <div className="table-wrap"><table><thead><tr><th>Instrument</th><th>Direction</th><th>Entry</th><th>Exit</th><th>Net P&L</th></tr></thead><tbody>{result.trades.slice(0,10).map(t=><tr key={t.id}><td>{t.instrument}</td><td>{t.side}</td><td>{t.entries[0].price}</td><td>{t.exits[0].price}</td><td>{money(tradeStats(t).net)}</td></tr>)}</tbody></table></div>
 <button className="button primary" disabled={!result.trades.length||!!csv.errors.length} onClick={async()=>{const ok=await save({...state,trades:[...state.trades,...result.trades],imports:[...state.imports,{id:crypto.randomUUID(),time:new Date().toISOString(),file,count:result.trades.length,duplicates:result.duplicates}]},'CSV import saved.');if(ok)setCsv(null);}}>Import valid rows</button></>}
 {!!state.imports.length&&<><h3>Import history</h3>{state.imports.slice().reverse().map(i=><p className="subtle" key={i.id}>{i.file} · {i.count} saved · {i.duplicates} skipped · {i.time}</p>)}</>}</Card>;
}
export function Playbooks({state,save,attachments}:{state:Workspace;save:SaveState;attachments:AttachmentProps}){
 const [id,set]=useState(state.playbooks[0]?.id??'');
 const p=state.playbooks.find(p=>p.id===id);
 return <><div className="tabs">{state.playbooks.map(p=><button key={p.id} className={'button '+(p.id===id?'primary':'secondary')} onClick={()=>set(p.id)}>{p.name}</button>)}</div>{p&&<PlaybookForm key={p.id} initial={p} state={state} save={save} attachments={attachments}/>}</>;
}
function PlaybookForm({initial,state,save,attachments}:{initial:Workspace['playbooks'][number];state:Workspace;save:SaveState;attachments:AttachmentProps}){
 const [p,set]=useState(initial);
 const trades=state.trades.filter(t=>t.playbook===initial.id);
 return <form className="stack" onSubmit={e=>{e.preventDefault();void save({...state,playbooks:state.playbooks.map(s=>s.id===p.id?p:s)},'Playbook saved.');}}>
 <Card title={initial.name}><div className="fields">{(['name','description','context','levels','entry','checklist','invalidation','stop','target','mistakes'] as const).map((key,i)=><Note key={key} label={['Name','Description','Market context','Reference levels','Entry conditions','Confirmation checklist','Invalidation','Stop placement','Target logic','Mistakes to avoid'][i]} value={p[key]} onChange={v=>set({...p,[key]:v})}/>)}</div>
 <Attachments paths={p.screenshots} onChange={screenshots=>set({...p,screenshots})} {...attachments}/></Card>
 <Card title="Journal performance"><p>{trades.length} trades · {trades.length?money(trades.reduce((n,t)=>n+tradeStats(t).net,0)):'No results yet'}</p></Card><button className="button primary">Save playbook</button></form>;
}
