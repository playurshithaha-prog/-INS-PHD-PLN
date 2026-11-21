import {createClient} from '@supabase/supabase-js';
export const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
export const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export function client(){return url&&key?createClient(url,key):null}
