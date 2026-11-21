import {describe,expect,it} from 'vitest';
import {defaults} from '../lib/defaults';
import {assess,drawdown,nyDay,nyMinute,roundTick,tick,type TradePlan} from '../lib/risk';
const now=new Date('2026-11-20T14:40:00Z');
function fixture(){
 const {account,policy}=defaults(false);
 Object.assign(account,{balance:1000000,baselineHigh:1000000,equity:1000000,observed:now.toISOString(),confirmed:true});
 const plan:TradePlan={instrument:'MNQ',side:'long',entry:22000,stop:21995,quantity:1,playbook:'1',level:'POC',context:'Balance',trigger:'Rejection',footprint:'Failed progress',exitPlan:'Next value level',emotion:'calm',extension:0,acknowledgement:''};
 return {account,policy,plan,session:{net:0,count:0,streak:0,lastLoss:null as string|null,hasPlan:true}};
}
describe('risk engine',()=>{
 it('uses quarter-point ticks and sizes MNQ including fees and slippage',()=>{
  const {account,policy,plan,session}=fixture();
  const result=assess(account,policy,[],session,plan,now);
  expect([tick(22000.1),roundTick(22000.13),result.unit,result.max,result.result]).toEqual([false,22000.25,1250,8,'Approved under personal rules']);
 });
 it('sizes NQ at $20 a point and blocks oversized orders',()=>{
  const {account,policy,plan,session}=fixture();
  const result=assess(account,policy,[],session,{...plan,instrument:'NQ'},now);
  expect(result.unit).toBe(11150);expect(result.max).toBe(0);expect(result.blocks).toContain('Estimated risk exceeds the available per-trade, daily, or drawdown budget.');
 });
 it('caps mixed position exposure in MNQ equivalents',()=>{
  const {account,policy,plan,session}=fixture();
  Object.assign(account,{maxExposure:25,openNq:2,openMnq:3});
  expect(assess(account,policy,[],session,plan,now).max).toBe(2);
 });
 it('enforces daily loss, max trades, cooldown, and missing prep',()=>{
  const {account,policy,plan,session}=fixture();
  Object.assign(session,{net:-30000,count:3,streak:2,lastLoss:now.toISOString(),hasPlan:false});
  expect(assess(account,policy,[],session,plan,now).blocks).toEqual(expect.arrayContaining(['Daily loss budget exhausted.','Maximum approved or recorded trades reached.','Consecutive-loss cooldown is active.','Save a premarket plan for this New York session.']));
 });
 it('trails only on completed EOD highs and ignores losing days and same-day observations',()=>{
  const {account}=fixture();
  const closes=[{day:'2026-11-17',balance:1190000},{day:'2026-11-19',balance:1100000},{day:'2026-11-20',balance:1400000}];
  expect(drawdown(account,closes,now)).toMatchObject({high:1190000,floor:190000,cushion:810000});
  account.equity=1500000;
  expect(drawdown(account,closes,now)).toMatchObject({floor:190000,cushion:1310000});
  account.cap=100000;expect(drawdown(account,closes,now)?.floor).toBe(100000);
  account.model='static';expect(drawdown(account,closes,now)?.floor).toBe(0);
 });
 it('fails closed with missing, invalid, or stale observations',()=>{
  const {account,policy,plan,session}=fixture();
  account.balance=null;expect(assess(account,policy,[],session,plan,now).max).toBe(0);
  account.balance=1000000;account.observed='invalid';expect(drawdown(account,[],now)).toBeNull();
  account.observed='2026-11-20T12:00:00Z';expect(assess(account,policy,[],session,plan,now).blocks).toContain('Account observation is stale. Update balance and equity.');
 });
 it('assigns New York sessions across DST and UTC date rollover',()=>{
  expect(nyMinute(new Date('2026-03-06T14:30:00Z'))).toBe(570);
  expect(nyMinute(new Date('2026-03-09T13:30:00Z'))).toBe(570);
  expect(nyMinute(new Date('2026-11-02T14:30:00Z'))).toBe(570);
  expect(nyDay('2026-11-02T01:30:00Z')).toBe('2026-11-01');
 });
});
it('records discretionary warnings without allowing acknowledgements to waive a hard block',()=>{
 const {account,policy,plan,session}=fixture();
 const flagged={...plan,emotion:'FOMO',extension:9};
 expect(assess(account,policy,[],session,flagged,now).result).toBe('Review required');
 expect(assess(account,policy,[],session,{...flagged,acknowledgement:'Retest completed at the planned level.'},now).result).toBe('Approved under personal rules');
 expect(assess(account,policy,[],session,{...flagged,quantity:99,acknowledgement:'Acknowledged'},now).result).toBe('Blocked by risk policy');
 account.baselineHigh=null;
 expect(assess(account,policy,[],session,plan,now).max).toBe(0);
});
