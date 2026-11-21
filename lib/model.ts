import {z} from 'zod';
import {nyDay,tick,tickCents,type Instrument,type SessionState} from './risk';
const amount = z.number().int().min(-1e12).max(1e12);
const positive = z.number().int().min(1).max(1e9);
const nonnegative = z.number().int().min(0).max(1e9);
const instant = z.iso.datetime({offset:true});
const instrument = z.enum(['NQ','MNQ']);
const string = z.string().max(4000);
const price = z.number().refine(tick,'Use a positive quarter-point price');
const day = z.iso.date();
export const accountSchema = z.object({
  name:string,competition:z.boolean(),confirmed:z.boolean(),version:string,verifiedDate:z.union([day,z.literal('')]),startDate:day,endDate:day,
  starting:amount,balance:amount.nullable(),equity:amount.nullable(),observed:z.union([instant,z.literal('')]),source:z.enum(['manual','imported']),allowance:positive,
  model:z.enum(['static','eod']),baselineHigh:amount.nullable().default(null),cap:amount.nullable(),buffer:nonnegative,maxNq:positive,maxMnq:positive,maxExposure:positive,
  openNq:nonnegative,openMnq:nonnegative,openRisk:nonnegative,officialDaily:positive.nullable(),
}).refine(a=>a.startDate<=a.endDate && (a.cap===null || a.cap>=a.starting-a.allowance) && (a.baselineHigh===null || a.baselineHigh>=a.starting) && (!a.confirmed || (!!a.version.trim() && !!a.verifiedDate)),'Check dates, floor cap, and rules version.');
export const policySchema = z.object({
  instrument,perTrade:positive,daily:positive,maxTrades:positive,cooldown:nonnegative,start:z.number().int().min(0).max(1439),end:z.number().int().min(1).max(1440),
  commission:nonnegative,slippage:nonnegative,extension:nonnegative,staleMinutes:positive,playbooks:z.array(string),
}).refine(p=>p.start<p.end,'Session end must be after the start.');
const fillSchema=z.object({price,quantity:z.number().int().min(1).max(25000),time:instant});
export const tradeSchema=z.object({
  id:z.uuid(),approvalId:z.uuid().optional(),instrument,side:z.enum(['long','short']),entries:z.array(fillSchema).min(1).max(100),exits:z.array(fillSchema).min(1).max(100),
  stop:price.nullable(),target:price.nullable(),commission:nonnegative,risk:nonnegative,playbook:string,regime:string,levels:string,flow:string,emotion:string,mistakes:string,notes:string,
  riskFollowed:z.boolean(),setupFollowed:z.boolean(),prepared:z.boolean(),reviewed:z.boolean(),screenshots:z.array(string).max(10),
}).superRefine((t,ctx)=>{
  const qty=(fills:typeof t.entries)=>fills.reduce((n,f)=>n+f.quantity,0);
  if(qty(t.entries)!==qty(t.exits)) ctx.addIssue({code:'custom',message:'Entry and exit quantities must match.'});
  const events=[...t.entries.map(f=>({...f,delta:f.quantity})),...t.exits.map(f=>({...f,delta:-f.quantity}))].sort((a,b)=>Date.parse(a.time)-Date.parse(b.time)||b.delta-a.delta);
  let open=0;
  if(events.some(f=>(open+=f.delta)<0)) ctx.addIssue({code:'custom',message:'Exits cannot exceed the quantity opened at that time.'});
});
export const planSchema=z.object({day,context:string,levels:z.record(z.string(),string),bull:z.record(z.string(),string),bear:z.record(z.string(),string),notes:string,gex:z.record(z.string(),string),review:string,screenshots:z.array(string).max(10)});
export const candidateSchema=z.object({instrument,side:z.enum(['long','short']),entry:z.number(),stop:z.number(),quantity:z.number(),playbook:string,level:string,context:string,trigger:string,footprint:string,exitPlan:string,emotion:string,extension:nonnegative,acknowledgement:string});
export const workspaceSchema=z.object({
  account:accountSchema,policy:policySchema,onboarded:z.boolean(),closes:z.array(z.object({day,balance:amount})).max(5000),
  plans:z.array(planSchema).max(5000),trades:z.array(tradeSchema).max(10000),
  approvals:z.array(z.object({id:z.uuid(),time:instant,plan:candidateSchema,result:string,blocks:z.array(string),warnings:z.array(string)})).max(10000),
  playbooks:z.array(z.object({id:string,name:string,description:string,context:string,levels:string,entry:string,checklist:string,invalidation:string,stop:string,target:string,mistakes:string,screenshots:z.array(string).max(10)})).max(100),
  imports:z.array(z.object({id:z.uuid(),time:instant,file:string,count:nonnegative,duplicates:nonnegative})).max(1000),
});
export type Workspace=z.infer<typeof workspaceSchema>;
export type Trade=z.infer<typeof tradeSchema>;
export type DayPlan=z.infer<typeof planSchema>;
export function tradeStats(trade:Trade) {
  const sum=(fills:Trade['entries'])=>fills.reduce((n,f)=>n+f.price*4*f.quantity,0);
  const gross=(sum(trade.exits)-sum(trade.entries))*tickCents[trade.instrument]*(trade.side==='long'?1:-1);
  const opened=Math.min(...trade.entries.map(f=>Date.parse(f.time)));
  const closed=Math.max(...trade.exits.map(f=>Date.parse(f.time)));
  return {gross,net:gross-trade.commission,r:trade.risk?(gross-trade.commission)/trade.risk:null,opened,closed,day:nyDay(new Date(opened)),minutes:(closed-opened)/60000,quantity:trade.entries.reduce((n,f)=>n+f.quantity,0)};
}
export function discipline(t:Trade){
  const criteria=[{label:'Risk compliance',points:t.riskFollowed&&t.risk>0&&t.stop!==null?35:0},{label:'Setup and execution',points:t.setupFollowed&&t.playbook&&t.flow.trim()?30:0},{label:'Emotional discipline',points:t.emotion==='calm'?20:0},{label:'Preparation and journal',points:(t.prepared?7:0)+(t.reviewed&&t.notes.trim()?8:0)}];
  return {criteria,score:criteria.reduce((n,c)=>n+c.points,0)};
}
export function sessionState(state:Workspace, now:Date):SessionState {
  const day=nyDay(now);
  const trades=state.trades.map(t=>({trade:t,...tradeStats(t)}));
  const realized=trades.filter(t=>t.closed<=now.getTime()&&nyDay(new Date(t.closed))===day).sort((a,b)=>b.closed-a.closed);
  const opened=trades.filter(t=>t.day===day&&t.opened<=now.getTime());
  const approvals=state.approvals.filter(a=>a.result==='Approved under personal rules'&&nyDay(a.time)===day);
  let streak=0;
  for(const trade of realized){if(trade.net>=0)break; streak++;}
  return {net:realized.reduce((n,t)=>n+t.net,0),count:opened.length+approvals.filter(a=>!opened.some(t=>t.trade.approvalId===a.id)).length,streak,lastLoss:streak?new Date(realized[0].closed).toISOString():null,hasPlan:state.plans.some(p=>p.day===day&&p.context.trim()&&Object.values(p.levels).some(v=>v.trim())&&(p.bull.Activation?.trim()||p.bear.Activation?.trim()))};
}
export const newTrade=(instrument:Instrument):Trade=>({id:crypto.randomUUID(),instrument,side:'long',entries:[],exits:[],stop:null,target:null,commission:0,risk:0,playbook:'',regime:'',levels:'',flow:'',emotion:'',mistakes:'',notes:'',riskFollowed:false,setupFollowed:false,prepared:false,reviewed:false,screenshots:[]});
