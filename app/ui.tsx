'use client';
import type {ReactNode} from 'react';
import {ArrowUpRight,ChartNoAxesCombined, CircleAlert} from 'lucide-react';
import {money} from '../lib/risk';
export function Card({title,children,action,className=''}:{title?:string;children:ReactNode;action?:ReactNode;className?:string}){return <section className={'card '+className}>{title&&<header><h2>{title}</h2>{action}</header>}{children}</section>}
export function Metric({label,value,detail,tone='',icon}:{label:string;value:ReactNode;detail?:ReactNode;tone?:string;icon?:ReactNode}){return <div className="metric card"><div className="metric-label">{label}<span>{icon??<ArrowUpRight size={15}/>}</span></div><strong className={tone}>{value}</strong>{detail&&<small>{detail}</small>}</div>}
export function Field({label,children}:{label:string;children:ReactNode}){return <label className="field"><span>{label}</span>{children}</label>}
export function Input({label,value,onChange,type='text',placeholder,min,step,required}:{label:string;value:string|number;onChange:(v:string)=>void;type?:string;placeholder?:string;min?:number;step?:number|string;required?:boolean}){return <Field label={label}><input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} min={min} step={step} required={required}/></Field>}
export function Select({label,value,onChange,options}:{label:string;value:string;onChange:(v:string)=>void;options:(string|[string,string])[]}){return <Field label={label}><select value={value} onChange={e=>onChange(e.target.value)}>{options.map(item=>{const [v,l]=typeof item==='string'?[item,item]:item;return <option value={v} key={v}>{l}</option>})}</select></Field>}
export function Note({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){return <Field label={label}><textarea value={value} onChange={e=>onChange(e.target.value)} rows={3}/></Field>}
export function Check({label,checked,onChange}:{label:string;checked:boolean;onChange:(v:boolean)=>void}){return <label className="check"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/>{label}</label>}
export function Empty({children}:{children:ReactNode}){return <div className="empty"><ChartNoAxesCombined size={25}/><span>{children}</span></div>}
export function Notice({children}:{children:ReactNode}){return <div className="notice"><CircleAlert size={16}/><div>{children}</div></div>}
export function Chart({items,financial=true,bars=false}:{items:{label:string;value:number}[];financial?:boolean;bars?:boolean}){
 if(!items.length)return <Empty>No observations yet</Empty>;
 const w=740,h=223,left=76,right=17,top=17,bottom=34;
 const lo=Math.min(0,...items.map(i=>i.value)),hi=Math.max(0,...items.map(i=>i.value)),span=hi-lo||1;
 const x=(i:number)=>left+(i+.5)*(w-left-right)/items.length;
 const y=(v:number)=>top+(hi-v)*(h-top-bottom)/span;
 const points=items.map((p,i)=>x(i)+','+y(p.value)).join(' ');
 const format=(v:number)=>financial?money(v):v.toFixed(1);
 return <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Historical observations chart">
 <defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#4ee0aa" stopOpacity=".21"/><stop offset="100%" stopColor="#4ee0aa" stopOpacity="0"/></linearGradient></defs>
 {[0,.25,.5,.75,1].map(p=>{const v=hi-p*span;return <g key={p}><line x1={left} x2={w-right} y1={y(v)} y2={y(v)} stroke="#242a32" strokeDasharray="3 5"/><text x={left-9} y={y(v)+4} textAnchor="end">{format(v)}</text></g>})}
 {!bars&&<><polygon points={`${x(0)},${y(lo)} ${points} ${x(items.length-1)},${y(lo)}`} fill="url(#chart-fill)"/><polyline points={points} fill="none" stroke="#4ee0aa" strokeWidth="2.4" strokeLinejoin="round"/></>}
 {items.map((p,i)=><g key={i}>{bars?<rect x={x(i)-Math.min(16,250/items.length)} y={Math.min(y(0),y(p.value))} width={Math.min(32,500/items.length)} height={Math.abs(y(p.value)-y(0))} rx="2" fill={p.value<0?'#f27f83':'#4ee0aa'}><title>{p.label} · {format(p.value)}</title></rect>:<circle cx={x(i)} cy={y(p.value)} r="3" fill="#4ee0aa"><title>{p.label} · {format(p.value)}</title></circle>}{(i%Math.ceil(items.length/6)===0)&&<text x={x(i)} y={h-8} textAnchor="middle">{p.label.slice(5)}</text>}</g>)}
 </svg>
}
