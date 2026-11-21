import Papa from 'papaparse';
import {newTrade,tradeSchema,type Trade} from './model';
import {cents} from './risk';
export const columns=['instrument','side','entry','exit','quantity','opened','closed','commission'] as const;
export type Column=typeof columns[number];
export const tradeKey=(t:Trade)=>JSON.stringify([t.instrument,t.side,...[t.entries,t.exits].map(fills=>fills.map(f=>[f.price,f.quantity,Date.parse(f.time)]).sort((a,b)=>a[2]-b[2]||a[0]-b[0]||a[1]-b[1]))]);
export function parseCsv(text:string){
 return Papa.parse<Record<string,string>>(text,{header:true,skipEmptyLines:'greedy',transformHeader:v=>v.trim()});
}
export function previewCsv(rows:Record<string,string>[],mapping:Record<Column,string>,existing:Trade[]){
 const seen=new Set(existing.map(tradeKey)), trades:Trade[]=[], errors:string[]=[];
 let duplicates=0;
 rows.forEach((r,i)=>{
  const get=(c:Column)=>r[mapping[c]]?.trim()??'';
  const required=columns.filter(c=>c!=='commission');
  if(required.some(c=>!get(c))){errors.push('Row '+(i+2)+': Missing required value.');return;}
  const quantity=Number(get('quantity'));
  const data={...newTrade('MNQ'),instrument:get('instrument').toUpperCase(),side:get('side').toLowerCase(),commission:cents(Number(get('commission'))),entries:[{price:Number(get('entry')),time:get('opened'),quantity}],exits:[{price:Number(get('exit')),time:get('closed'),quantity}]};
  const checked=tradeSchema.safeParse(data);
  if(!checked.success){errors.push('Row '+(i+2)+': '+(checked.error.issues[0].path.join('.')||'Trade')+' · '+checked.error.issues[0].message);return;}
  const key=tradeKey(checked.data);
  if(seen.has(key)){duplicates++;return;}
  seen.add(key);trades.push(checked.data);
 });
 return {trades,duplicates,errors};
}
