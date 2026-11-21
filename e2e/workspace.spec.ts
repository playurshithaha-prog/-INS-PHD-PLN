import {expect,test} from '@playwright/test';
test('demo routes render and API operations require authentication',async({page,request})=>{
 for(const [method,status] of [['GET',401],['PUT',401],['DELETE',401]] as const){
  expect((await request.fetch('/api/workspace',{method})).status()).toBe(status);
 }
 const routes={dashboard:'Mission Control',premarket:'Premarket',execution:'Execution Gate',journal:'Trade Journal',playbooks:'Playbooks',analytics:'Analytics',competition:'Competition',settings:'Settings',onboarding:'Account onboarding'};
 const errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 for(const [route,title] of Object.entries(routes)){
  await page.goto('/'+route);
  await expect(page.getByRole('heading',{level:1,name:title})).toBeVisible();
  await expect(page.getByText('Sample data and changes stay in this browser.',{exact:false})).toBeVisible();
  if(route==='dashboard')await expect(page.getByText('$9,980.00',{exact:true})).toBeVisible();
 }
 expect(errors).toEqual([]);
});
test('records a journal trade, persists a premarket plan, and sizes a trade',async({page})=>{
 await page.goto('/premarket');
 await page.getByLabel('Preparation notes').fill('Wait for a controlled retest.');
 await page.getByRole('button',{name:'Save premarket plan'}).click();
 await expect(page.getByRole('status')).toHaveText('Premarket plan saved.');
 await page.reload();
 await expect(page.getByLabel('Preparation notes')).toHaveValue('Wait for a controlled retest.');
 await page.goto('/execution');
 await page.getByLabel('Entry price').fill('22000');
 await page.getByLabel('Structural stop').fill('21995');
 await expect(page.getByText('$12.50',{exact:true}).first()).toBeVisible();
 await page.getByRole('button',{name:'Record execution check'}).click();
 await expect(page.getByText('Execution check recorded.',{exact:true})).toBeVisible();
 await page.goto('/journal');
 await page.getByRole('button',{name:'Record trade'}).click();
 await page.getByLabel('Price',{exact:true}).nth(0).fill('22000');
 await page.getByLabel('Price',{exact:true}).nth(1).fill('22005');
 await page.getByRole('button',{name:'Save trade'}).click();
 await expect(page.getByRole('status')).toHaveText('Trade saved.');
 await page.reload();
 await expect(page.getByRole('cell',{name:'$10.00',exact:true})).toBeVisible();
 await page.goto('/analytics');
 await expect(page.getByText('$884.00',{exact:true}).first()).toBeVisible();
});
test('mobile navigation and mapped CSV import are usable',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/dashboard');
 await page.getByRole('button',{name:'Open navigation'}).click();
 await page.getByRole('link',{name:'Trade Journal',exact:true}).click();
 await page.getByRole('button',{name:'Import CSV',exact:true}).click();
 const csv='symbol,side,entry,exit,quantity,opened,closed,commission\nNQ,long,22000,22001,1,2026-10-02T13:30:00Z,2026-10-02T13:35:00Z,2';
 await page.getByLabel('CSV file').setInputFiles({name:'trades.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
 await page.getByRole('combobox',{name:'instrument',exact:true}).selectOption('symbol');
 await page.getByRole('button',{name:'Import valid rows'}).click();
 await expect(page.getByText('CSV import saved.')).toBeVisible();
 await expect(page.getByRole('cell',{name:'$18.00',exact:true})).toBeVisible();
});
