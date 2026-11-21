import {expect,it} from 'vitest';
import {columns,parseCsv,previewCsv,type Column} from '../lib/imports';
import {discipline,newTrade,tradeSchema,tradeStats} from '../lib/model';
import {analytics} from '../lib/analytics';
const opened='2026-11-20T14:30:00Z', partial='2026-11-20T14:35:00Z', closed='2026-11-20T14:40:00Z';
it('calculates weighted cash flows from partial exits and subtracts fees',()=>{
 const trade=tradeSchema.parse({...newTrade('MNQ'),entries:[{time:opened,quantity:2,price:22000}],exits:[{time:partial,quantity:1,price:22010},{time:closed,quantity:1,price:22020}],commission:250,risk:5000});
 expect(tradeStats(trade)).toMatchObject({gross:6000,net:5750,r:1.15,minutes:10});
 expect(analytics([trade])).toMatchObject({winRate:1,profitFactor:Infinity,expectancy:5750});
 expect(discipline(trade).score).toBe(0);
 expect(tradeSchema.safeParse({...trade,exits:[{...trade.exits[0],quantity:3}]}).success).toBe(false);
});
it('reports invalid, duplicate, and valid CSV rows against existing fills',()=>{
 const row=['MNQ','long','22000','22005','1',opened,closed,'1.50'].join(',');
 const mapping=Object.fromEntries(columns.map(c=>[c,c])) as Record<Column,string>;
 const parsed=parseCsv(columns.join(',')+'\n'+row+'\n'+row+'\n'+row.replace('22000','22000.1'));
 const result=previewCsv(parsed.data,mapping,[]);
 expect(result.trades).toHaveLength(1);expect(result.duplicates).toBe(1);expect(result.errors).toHaveLength(1);
 expect(previewCsv(parsed.data,mapping,result.trades).duplicates).toBe(2);
});
