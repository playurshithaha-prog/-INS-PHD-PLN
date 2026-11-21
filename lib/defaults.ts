import {newTrade, type DayPlan,type Workspace} from './model';
import {nyDay} from './risk';
const setups=[
 ['Absorption Reversal','Aggressive executions make limited progress at a significant level.','Previous extremes, VAH, VAL, POC, HVN, LVN','Wait for failure to continue and subsequent price rejection.','Footprint imbalance, limited progress, observable rejection','Renewed acceptance through the level','Beyond the rejected structural extreme','Rotation toward value or next reference','Entering on large volume alone'],
 ['Breakout and Acceptance','A balanced auction makes a sustained move beyond a boundary.','Opening range, value boundary, liquidity area','Wait for acceptance outside the range or a controlled retest.','Participation, footprint, sustained price response, extension within limit','Return and acceptance inside the old range','Beyond the retest structure','Next liquidity reference','Chasing a single large candle'],
 ['Large Trades / Defense','Repeated executions occur near a significant reference.','Volume node, prior high or low','Wait for observable holding, rejection, or continuation.','Repeated executions and clear price response','Price accepts through the reference','Beyond the level that invalidates the reaction','Next auction reference','Attributing prints to an unidentified participant'],
 ['Failed Auction','An attempted breakout fails and rotates back into balance.','Range boundary or prior extreme','Wait for re-entry and failed continuation.','Order-flow confirmation and return into balance','Sustained acceptance outside balance','Beyond the failed auction extreme','POC or opposite value boundary','Entering before re-entry'],
];
export const levels=['Prior day high','Prior day low','Prior VAH','Prior VAL','Prior POC','Overnight high','Overnight low','Overnight POC','HVNs','LVNs','Opening range','Liquidity zones','Other levels'];
export const scenario=['Activation','Levels','Playbook','Confirmation','Invalidation','Response'];
export const regimes=['Balance','Discovery','Potential transition','Unclear'];
export const blankPlan=(day:string):DayPlan=>({day,context:'',levels:{},bull:{},bear:{},gex:{},notes:'',review:'',screenshots:[]});
export function defaults(demo:boolean):Workspace {
 const now=new Date(), observed=new Date(now.getTime()-1000).toISOString(), day=nyDay(now);
 const playbooks=setups.map(([name,description,levels,entry,checklist,invalidation,stop,target,mistakes],i)=>({id:String(i+1),name,description,context:description,levels,entry,checklist,invalidation,stop,target,mistakes,screenshots:[]}));
 const state:Workspace={
 account:{name:'Phidias Fall Edition',competition:true,confirmed:false,version:'',verifiedDate:'',startDate:'2026-09-01',endDate:'2026-11-30',starting:1000000,balance:demo?1087400:null,equity:demo?1087400:null,observed:demo?observed:'',source:'manual',allowance:1000000,model:'eod',baselineHigh:demo?1000000:null,cap:null,buffer:5000,maxNq:25,maxMnq:250,maxExposure:250,openNq:0,openMnq:0,openRisk:0,officialDaily:null},
 policy:{instrument:'MNQ',perTrade:10000,daily:30000,maxTrades:3,cooldown:15,start:570,end:660,commission:150,slippage:2,extension:8,staleMinutes:60,playbooks:playbooks.map(p=>p.id)},onboarded:false,playbooks,plans:[],trades:[],closes:[],approvals:[],imports:[]};
 if(!demo)return state;
 const examples=[75,-36,185,240,-65,165,330,-20];
 const cursor=new Date(day+'T12:00:00Z'), sampleDays:string[]=[];
 while(sampleDays.length<examples.length){
  cursor.setUTCDate(cursor.getUTCDate()-1);
  if(cursor.getUTCDay()%6!==0)sampleDays.unshift(nyDay(cursor));
 }
 examples.forEach((p,i)=>{
  const dateKey=sampleDays[i], entry=21840+i*7;
  const offset=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',timeZoneName:'longOffset'}).formatToParts(new Date(dateKey+'T16:00:00Z')).find(p=>p.type==='timeZoneName')?.value.slice(3)??'-05:00';
  const time=dateKey+'T09:34:00'+offset, exit=dateKey+'T09:48:00'+offset;
  state.trades.push({...newTrade('MNQ'),entries:[{price:entry,quantity:2,time}],exits:[{price:entry+(p+2)/4,quantity:2,time:exit}],commission:200,risk:10000,stop:entry-10,playbook:playbooks[i%4].id,regime:regimes[i%3],emotion:p<0?'FOMO':'calm',riskFollowed:true,setupFollowed:p>0,prepared:true,reviewed:true,flow:'Observed price response at the reference.',notes:'Review acceptance before extending size.'});
 });
 state.closes=state.trades.map((t,i)=>({day:nyDay(t.entries[0].time),balance:1000000+examples.slice(0,i+1).reduce((a,b)=>a+b,0)*100}));
 state.plans=[{...blankPlan(day),context:'Balance',levels:{'Prior POC':'21862.50','Overnight high':'21915.25'},bull:{Activation:'Acceptance above the overnight high'},bear:{Activation:'Failed auction above the overnight high'},notes:'Wait for price response at the overnight range.'}];
 return state;
}
