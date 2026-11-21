import {createClient} from '@supabase/supabase-js';
import {NextResponse} from 'next/server';
import {workspaceSchema,sessionState} from '../../../lib/model';
import {assess} from '../../../lib/risk';
import {url,key} from '../../../lib/supabase';
export const dynamic='force-dynamic';
const serverKey=process.env.SUPABASE_SECRET_KEY;
async function authenticate(request:Request){
 const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
 if(!url||!key||!token)return null;
 const db=createClient(url,key,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user}}=await db.auth.getUser(token);
 return user?{user}:null;
}
export async function GET(request:Request){
 const auth=await authenticate(request);
 if(!auth)return NextResponse.json({error:'Sign in required.'},{status:401});
 if(!serverKey||!url)return NextResponse.json({error:'Server database credentials are missing.'},{status:503});
 const db=createClient(url,serverKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await db.from('workspaces').select('state,revision').eq('user_id',auth.user.id).maybeSingle();
 return error?NextResponse.json({error:'Workspace could not be loaded.'},{status:500}):NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
}
export async function PUT(request:Request){
 const auth=await authenticate(request);
 if(!auth)return NextResponse.json({error:'Sign in required.'},{status:401});
 if(!serverKey||!url)return NextResponse.json({error:'Server database credentials are missing.'},{status:503});
 const db=createClient(url,serverKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const body=await request.json().catch(()=>null);
 const parsed=workspaceSchema.safeParse(body?.state);
 if(!parsed.success || !Number.isSafeInteger(body?.revision) || body.revision<0)return NextResponse.json({error:parsed.error?.issues[0]?.message??'Invalid revision.'},{status:400});
 const {data:existing,error:readError}=await db.from('workspaces').select('state,revision').eq('user_id',auth.user.id).maybeSingle();
 if(readError)return NextResponse.json({error:'Workspace could not be read.'},{status:500});
 if((existing?.revision??0)!==body.revision)return NextResponse.json({error:'Workspace changed in another tab. Reload before saving.'},{status:409});
 const old=workspaceSchema.safeParse(existing?.state);
 const state=parsed.data;
 if(existing&&!old.success)return NextResponse.json({error:'Saved workspace needs migration.'},{status:409});
 const previous=old.success?old.data.approvals:[];
 if(JSON.stringify(state.approvals.slice(0,previous.length))!==JSON.stringify(previous) || state.approvals.length>previous.length+1)return NextResponse.json({error:'Approval history is append-only.'},{status:400});
 if(state.approvals.length>previous.length){
  const record=state.approvals.at(-1)!;
  if(!old.success)return NextResponse.json({error:'Save initial settings before recording an execution check.'},{status:400});
  const baseline=old.data;
  if(JSON.stringify({...state,approvals:previous})!==JSON.stringify(baseline))return NextResponse.json({error:'Save workspace changes separately before running an execution check.'},{status:400});
  const now=new Date();
  const response=assess(baseline.account,baseline.policy,baseline.closes,sessionState(baseline,now),record.plan,now);
  Object.assign(record,{time:now.toISOString(),result:response.result,blocks:response.blocks,warnings:response.warnings});
 }
 const revision=body.revision+1;
 const query=existing?db.from('workspaces').update({state,revision}).eq('user_id',auth.user.id).eq('revision',body.revision):db.from('workspaces').insert({user_id:auth.user.id,state,revision});
 const {data,error}=await query.select('state,revision').maybeSingle();
 return error||!data?NextResponse.json({error:'Save failed. Reload if the workspace changed in another tab.'},{status:error?.code==='23505'||!error?409:500}):NextResponse.json(data);
}
export async function DELETE(request:Request){
 const auth=await authenticate(request);
 if(!auth)return NextResponse.json({error:'Sign in required.'},{status:401});
 if(!serverKey||!url)return NextResponse.json({error:'Server database credentials are missing.'},{status:503});
 const db=createClient(url,serverKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await db.from('workspaces').delete().eq('user_id',auth.user.id);
 return error?NextResponse.json({error:'Workspace could not be deleted.'},{status:500}):NextResponse.json({deleted:true});
}
