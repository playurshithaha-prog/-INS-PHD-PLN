export type Instrument = 'NQ' | 'MNQ';
export const tickCents: Record<Instrument, number> = { NQ: 500, MNQ: 50 };
export const equivalent: Record<Instrument, number> = { NQ: 10, MNQ: 1 };
export const cents = (value: number) => Math.round(value * 100);
export const tick = (price: number) => Number.isFinite(price) && price > 0 && price < 1e7 && Number.isInteger(price * 4);
export const roundTick = (price: number) => Math.round(price * 4) / 4;
export const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100);
export const nyDay = (time: Date | string) => new Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));
export function nyMinute(time: Date) {
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hourCycle:'h23',hour:'2-digit',minute:'2-digit'}).formatToParts(time);
  return Number(parts.find(p => p.type === 'hour')?.value) * 60 + Number(parts.find(p => p.type === 'minute')?.value);
}
export type Account = {
  name:string; competition:boolean; confirmed:boolean; version:string; verifiedDate:string; startDate:string; endDate:string;
  starting:number; balance:number|null; equity:number|null; observed:string; source:'manual'|'imported'; allowance:number;
  model:'static'|'eod'; baselineHigh:number|null; cap:number|null; buffer:number; maxNq:number; maxMnq:number; maxExposure:number;
  openNq:number; openMnq:number; openRisk:number; officialDaily:number|null;
};
export type Policy = {instrument:Instrument; perTrade:number; daily:number; maxTrades:number; cooldown:number; start:number; end:number; commission:number; slippage:number; extension:number; staleMinutes:number; playbooks:string[]};
export type Close = {day:string; balance:number};
export type TradePlan = {instrument:Instrument; side:'long'|'short'; entry:number; stop:number; quantity:number; playbook:string; level:string; context:string; trigger:string; footprint:string; exitPlan:string; emotion:string; extension:number; acknowledgement:string};
export type SessionState = {net:number; count:number; streak:number; lastLoss:string|null; hasPlan:boolean};
export function drawdown(account: Account, closes: Close[], now: Date) {
  const {starting, balance, equity, allowance, cap, buffer, observed} = account;
  const valid = (value:number|null) => value !== null && Number.isSafeInteger(value) && Math.abs(value) <= 1e12;
  if (![starting, balance, equity, allowance, buffer].every(valid) || allowance <= 0 || buffer < 0 || (cap !== null && (!valid(cap) || cap < starting - allowance))) return null;
  const age = now.getTime() - Date.parse(observed);
  if (!Number.isFinite(age) || age < 0 || !closes.every(c => valid(c.balance))) return null;
  if (account.model === 'eod' && (!valid(account.baselineHigh) || account.baselineHigh! < starting)) return null;
  const high = Math.max(starting, account.baselineHigh??starting, ...closes.filter(c=>c.day >= account.startDate && c.day < nyDay(now)).map(c=>c.balance));
  const raw = (account.model === 'eod' ? high : starting) - allowance;
  const floor = account.model === 'eod' && cap !== null ? Math.min(raw, cap) : raw;
  return {high, floor, cushion:equity! - floor, age};
}
export function assess(account: Account, policy: Policy, closes: Close[], session: SessionState, plan: TradePlan, now:Date) {
  const blocks:string[] = [], warnings:string[] = [];
  const state = drawdown(account,closes,now);
  const daily = Math.max(0, Math.min(policy.daily, account.officialDaily ?? Infinity) + Math.min(0,session.net) - account.openRisk);
  const budget = Math.max(0,Math.min(policy.perTrade,daily,(state?.cushion ?? 0)-account.buffer-account.openRisk));
  const validStop = tick(plan.entry) && tick(plan.stop) && (plan.side === 'long' ? plan.stop < plan.entry : plan.stop > plan.entry);
  const unit = validStop ? Math.abs(plan.entry*4-plan.stop*4)*tickCents[plan.instrument]+policy.commission+policy.slippage*tickCents[plan.instrument] : 0;
  const open = account.openNq*10+account.openMnq;
  const remaining = Math.min(account.maxExposure, account.maxNq*10, account.maxMnq)-open;
  const instrumentLimit = plan.instrument === 'NQ' ? account.maxNq-account.openNq : account.maxMnq-account.openMnq;
  const limit = Math.max(0, Math.min(instrumentLimit,Math.floor(remaining/equivalent[plan.instrument])));
  if (!validStop) blocks.push('Enter valid quarter-point prices and place the stop on the loss side of entry.');
  if (!state) blocks.push('Account balance, equity, observation time, or the EOD high-water baseline is missing or invalid.');
  else if (state.age > policy.staleMinutes * 60000) blocks.push('Account observation is stale. Update balance and equity.');
  if (account.competition && !account.confirmed) blocks.push('Confirm account-specific competition rules before approval.');
  if (account.competition && (nyDay(now) < account.startDate || nyDay(now) > account.endDate)) blocks.push('Outside the configured competition dates.');
  if (daily <= 0) blocks.push('Daily loss budget exhausted.');
  if (session.count >= policy.maxTrades) blocks.push('Maximum approved or recorded trades reached.');
  if (session.streak >= 2 && session.lastLoss && now.getTime()-Date.parse(session.lastLoss) < policy.cooldown*60000) blocks.push('Consecutive-loss cooldown is active.');
  const minute = nyMinute(now);
  const weekday = new Date(nyDay(now)+'T00:00:00Z').getUTCDay();
  if (weekday===0 || weekday===6 || minute < policy.start || minute >= policy.end) blocks.push('Outside the configured New York trading window.');
  if (!session.hasPlan) blocks.push('Save a premarket plan for this New York session.');
  const sizingAvailable = state && state.age <= policy.staleMinutes * 60000 && (!account.competition || account.confirmed);
  const max = unit > 0 && sizingAvailable ? Math.max(0,Math.min(limit,Math.floor(budget/unit))) : 0;
  if (!Number.isInteger(plan.quantity) || plan.quantity < 1) blocks.push('Enter a positive whole contract quantity.');
  if (plan.quantity > limit) blocks.push('Position exceeds instrument or combined exposure limits.');
  if (unit > 0 && plan.quantity*unit > budget) blocks.push('Estimated risk exceeds the available per-trade, daily, or drawdown budget.');
  if (![plan.playbook,plan.level,plan.context,plan.trigger,plan.footprint,plan.exitPlan].every(v=>v.trim())) warnings.push('Complete setup evidence and exit plan.');
  if (plan.emotion !== 'calm') warnings.push('Review emotional readiness.');
  if (plan.extension > policy.extension) warnings.push('Entry exceeds the configured extension threshold.');
  return {blocks,warnings,max,unit,daily,budget,result:blocks.length ? 'Blocked by risk policy' : warnings.length && !plan.acknowledgement.trim() ? 'Review required' : 'Approved under personal rules'};
}
