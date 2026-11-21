'use client';
import Link from 'next/link';
import {Activity, ArrowRight, BookOpen, CalendarDays, ChartNoAxesCombined, ClipboardCheck, Crosshair, Shield, Wallet} from 'lucide-react';
import type {Workspace} from '../lib/model';
import {sessionState} from '../lib/model';
import {analytics} from '../lib/analytics';
import {drawdown,money,nyDay,nyMinute} from '../lib/risk';
import {Card,Chart,Empty,Metric} from './ui';
export function Overview({state,now}:{state:Workspace;now:Date}){
 const a=analytics(state.trades), s=sessionState(state,now), account=state.account,d=drawdown(account,state.closes,now);
 const daily=Math.max(0,Math.min(state.policy.daily,account.officialDaily??Infinity)+Math.min(0,s.net)-account.openRisk);
 const p=state.plans.find(p=>p.day===nyDay(now));
 const active=nyMinute(now)>=state.policy.start&&nyMinute(now)<state.policy.end;
 const stale=!d||d.age>state.policy.staleMinutes*60000;
 return <>
 <div className="metrics">
 <Metric label="Account balance" value={account.balance===null?'—':money(account.balance)} detail={account.balance===null?'Add an account observation':stale?'Stale observation':account.source==='imported'?'Imported observation':'Manual observation'} icon={<Wallet size={16}/>}/>
 <Metric label="Net P&L" value={a.rows.length?money(a.total):'—'} detail={a.rows.length+' journaled trades'} tone={a.total>0?'green':a.total<0?'red':''} icon={<ChartNoAxesCombined size={16}/>}/>
 <Metric label="Drawdown cushion" value={d?money(d.cushion):'—'} detail={account.model==='eod'?'End-of-day trailing floor':'Static floor'} icon={<Shield size={16}/>}/>
 <Metric label="Daily risk remaining" value={money(daily)} detail={money(state.policy.daily)+' personal limit'} icon={<Crosshair size={16}/>}/>
 </div>
 <div className="dashboard-grid">
 <Card title="Equity curve" action={<Link className="text-link" href="/analytics">Analytics <ArrowRight size={14}/></Link>}><p className="card-description">Cumulative realized P&L from your journal</p><Chart items={a.curve.map(t=>({label:t.label,value:t.equity}))}/></Card>
 <Card title="Session plan" action={<span className="badge"><span className={active?'dot':'dot muted'}/>{active?'Within window':'Outside window'}</span>}>
 <div className="session"><div><CalendarDays size={18}/><span>New York session</span><b>{nyDay(now)}</b></div><div><ClipboardCheck size={18}/><span>Premarket plan</span><b>{s.hasPlan?'Ready':p?'Incomplete':'Pending'}</b></div><div><Activity size={18}/><span>Trades used</span><b>{s.count} / {state.policy.maxTrades}</b></div><div><Shield size={18}/><span>Competition rules</span><b className={account.competition&&!account.confirmed?'amber':''}>{account.competition?(account.confirmed?'Confirmed by you':'Unverified'):'Normal mode'}</b></div></div>
 <Link href="/premarket" className="button secondary full">Open premarket plan <ArrowRight size={15}/></Link></Card>
 </div>
 <Card title="Recent trades" action={<Link className="text-link" href="/journal">View journal <ArrowRight size={14}/></Link>}><TradeTable state={state} limit={5}/></Card>
 <div className="subtle bottom-note"><BookOpen size={15}/> Account values are entered manually or imported. Journal P&L is calculated from recorded fills.</div></>;
}
export function TradeTable({state,limit,onEdit}:{state:Workspace;limit?:number;onEdit?:(id:string)=>void}){
 const rows=analytics(state.trades).rows.reverse().slice(0,limit);
 if(!rows.length)return <Empty>Record a trade to see it here.</Empty>;
 return <div className="table-wrap"><table><thead><tr><th>Session</th><th>Instrument</th><th>Direction</th><th>Playbook</th><th>Size</th><th>Net P&L</th><th>R</th>{onEdit&&<th>Review</th>}</tr></thead><tbody>{rows.map(t=><tr key={t.trade.id}><td>{t.day}</td><td><b>{t.trade.instrument}</b></td><td className="capitalize">{t.trade.side}</td><td>{state.playbooks.find(p=>p.id===t.trade.playbook)?.name??'—'}</td><td>{t.quantity}</td><td className={t.net>=0?'green':'red'}>{money(t.net)}</td><td>{t.r===null?'—':t.r.toFixed(2)+'R'}</td>{onEdit&&<td><button type="button" className="small-button" onClick={()=>onEdit(t.trade.id)}>Open</button></td>}</tr>)}</tbody></table></div>
}
export function Analytics({state}:{state:Workspace}){
 const a=analytics(state.trades);
 const m=(v:number|null)=>v===null?'—':money(v);
 const daily=new Map<string,number>();
 a.rows.forEach(t=>daily.set(t.day,(daily.get(t.day)??0)+t.net));
 const grouping=(name:string,key:(t:typeof a.rows[number])=>string)=>{
  const groups=new Map<string,{count:number;net:number}>();
  for(const row of a.rows){const k=key(row),p=groups.get(k)??{count:0,net:0};groups.set(k,{count:p.count+1,net:p.net+row.net});}
  return <Card key={name} title={name}>{groups.size?<div className="table-wrap"><table><thead><tr><th>Group</th><th>Trades</th><th>Net P&L</th></tr></thead><tbody>{[...groups].map(([k,v])=><tr key={k}><td>{k}</td><td>{v.count}</td><td>{money(v.net)}</td></tr>)}</tbody></table></div>:<Empty>No trades yet</Empty>}</Card>;
 };
 return <>
 {a.rows.length<20&&<p className="subtle">Small sample · {a.rows.length} trades. Treat the results as descriptive.</p>}
 <div className="metrics"><Metric label="Net P&L" value={a.rows.length?money(a.total):'—'}/><Metric label="Win rate" value={a.winRate===null?'—':(a.winRate*100).toFixed(1)+'%'}/><Metric label="Profit factor" value={a.profitFactor===null?'—':a.profitFactor===Infinity?'No losses':a.profitFactor.toFixed(2)}/><Metric label="Discipline" value={a.score===null?'—':a.score.toFixed(0)+' / 100'}/></div>
 <Card title="Trade statistics"><div className="stat-list">{Object.entries({'Gross P&L':money(a.gross),'Average winner':m(a.averageWinner),'Average loser':m(a.averageLoser),'Expectancy':m(a.expectancy),'Average R':a.averageR?.toFixed(2)??'—','Maximum drawdown':money(-a.maxDrawdown),'Average hold':a.holding===null?'—':a.holding.toFixed(1)+' min','Win streak':a.maxWins,'Loss streak':a.maxLosses,'Risk violations':a.violations,'FOMO losses':money(a.fomo)}).map(([k,v])=><div key={k}><span>{k}</span><b>{v}</b></div>)}</div></Card>
 <div className="two">{(['equity','drawdown','r','discipline'] as const).map((key,i)=><Card key={key} title={['Equity curve','Drawdown','Cumulative R','Discipline trend'][i]}><Chart financial={i<2} items={a.curve.map(t=>({label:t.label,value:t[key]}))}/></Card>)}</div>
 <Card title="Daily P&L"><Chart bars items={[...daily].map(([label,value])=>({label,value}))}/></Card>
 <div className="two">{grouping('Playbook performance',t=>state.playbooks.find(p=>p.id===t.trade.playbook)?.name??'Unassigned')}{grouping('Market regime',t=>t.trade.regime||'Unspecified')}{grouping('Direction',t=>t.trade.side)}{grouping('Time of day · New York',t=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric'}).format(t.opened))}</div>
 </>;
}
