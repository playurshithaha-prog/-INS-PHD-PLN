import {discipline,tradeStats,type Trade} from './model';
export function analytics(trades:Trade[]){
 const rows=trades.map(trade=>({trade,...tradeStats(trade),discipline:discipline(trade).score})).sort((a,b)=>a.closed-b.closed);
 const wins=rows.filter(t=>t.net>0),losses=rows.filter(t=>t.net<0);
 const sum=(items:typeof rows)=>items.reduce((n,t)=>n+t.net,0);
 const total=sum(rows), gross=rows.reduce((n,t)=>n+t.gross,0);
 let equity=0,peak=0,maxDrawdown=0,r=0,winStreak=0,lossStreak=0,maxWins=0,maxLosses=0;
 const curve=rows.map(t=>{
   equity+=t.net; peak=Math.max(peak,equity); const drawdown=equity-peak; maxDrawdown=Math.min(maxDrawdown,drawdown); r+=t.r??0;
   winStreak=t.net>0?winStreak+1:0; lossStreak=t.net<0?lossStreak+1:0; maxWins=Math.max(maxWins,winStreak); maxLosses=Math.max(maxLosses,lossStreak);
   return {label:t.day,equity,drawdown,r,discipline:t.discipline};
 });
 const ratios=rows.flatMap(t=>t.r===null?[]:[t.r]);
 return {rows,curve,total,gross,maxDrawdown,maxWins,maxLosses,winRate:rows.length?wins.length/rows.length:null,profitFactor:losses.length?sum(wins)/-sum(losses):wins.length?Infinity:null,averageWinner:wins.length?sum(wins)/wins.length:null,averageLoser:losses.length?sum(losses)/losses.length:null,expectancy:rows.length?total/rows.length:null,averageR:ratios.length?ratios.reduce((a,b)=>a+b,0)/ratios.length:null,holding:rows.length?rows.reduce((n,t)=>n+t.minutes,0)/rows.length:null,score:rows.length?rows.reduce((n,t)=>n+t.discipline,0)/rows.length:null,violations:rows.filter(t=>!t.trade.riskFollowed).length,fomo:sum(rows.filter(t=>t.trade.emotion==='FOMO'&&t.net<0))};
}
