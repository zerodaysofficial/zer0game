import { AUTH_CONFIG } from './auth-config.js';
export const authConfigured = Boolean(AUTH_CONFIG.url && AUTH_CONFIG.publishableKey &&
  /^https:\/\//.test(AUTH_CONFIG.url));
let client = null;
let current = null;
function fail(result){ if(result.error) throw new Error(result.error.message || 'Authentication request failed.'); return result.data; }
export async function initializeAuth(onChange){
  if(!authConfigured){onChange(null);return;}
  const sdk = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  client = sdk.createClient(AUTH_CONFIG.url,AUTH_CONFIG.publishableKey,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}});
  client.auth.onAuthStateChange((_event,session)=>{current=session?.user||null;onChange(current);});
  const {data,error}=await client.auth.getUser();
  if(error && error.name!=='AuthSessionMissingError') console.warn('Auth session:',error.message);
  current=data?.user||null;
  onChange(current);
}
export function user(){return current;}
function requireClient(){if(!client)throw new Error('Authentication is not configured.');return client;}
function requireUser(){if(!current)throw new Error('Sign in with your email first.');return current;}
export async function sendCode(email){
  const safe=String(email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safe)||safe.length>254)throw new Error('Enter a valid email.');
  return fail(await requireClient().auth.signInWithOtp({email:safe,options:{shouldCreateUser:true}}));
}
export async function verifyCode(email,token){
  if(!/^\d{6}$/.test(String(token||'')))throw new Error('Enter the six digits received by email.');
  return fail(await requireClient().auth.verifyOtp({email:String(email).trim().toLowerCase(),token:String(token),type:'email'}));
}
export async function signOut(){fail(await requireClient().auth.signOut());current=null;}
export async function getProfile(){const u=requireUser();const db=requireClient();const {data,error}=await db.from('profiles').select('display_name,avatar_path').eq('id',u.id).maybeSingle();if(error)throw new Error(error.message);return data||{display_name:'',avatar_path:''};}
export async function saveProfile(displayName,avatarPath){
 const u=requireUser();const name=String(displayName||'').trim();
 if(name.length>32)throw new Error('Display name is too long.');
 const update={display_name:name,updated_at:new Date().toISOString()};
 if(avatarPath!==undefined)update.avatar_path=avatarPath;
 fail(await requireClient().from('profiles').upsert({id:u.id,...update},{onConflict:'id'}));
}
export function avatarUrl(path){if(!path||!client)return '';return client.storage.from('avatars').getPublicUrl(path).data.publicUrl||'';}
export async function uploadAvatar(file){
 const u=requireUser(),db=requireClient();
 const types={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
 if(!file||!types[file.type])throw new Error('Choose a JPG, PNG or WebP picture.');
 if(file.size>2097152)throw new Error('Avatar must be 2MB or smaller.');
 const path=u.id+'/'+Date.now()+'-'+Math.random().toString(36).slice(2,9)+'.'+types[file.type];
 const {error}=await db.storage.from('avatars').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
 if(error)throw new Error(error.message);
 return path;
}
export async function listFavorites(){
 const u=requireUser();const {data,error}=await requireClient().from('favorites').select('game_key,game_title').eq('user_id',u.id).order('created_at',{ascending:false}).limit(50);
 if(error)throw new Error(error.message);return data||[];
}
export async function setFavorite(key,title,enabled){
 const u=requireUser(),db=requireClient();
 if(enabled){fail(await db.from('favorites').insert({user_id:u.id,game_key:String(key).slice(0,180),game_title:String(title).slice(0,180)}));}
 else{fail(await db.from('favorites').delete().eq('user_id',u.id).eq('game_key',key));}
}
export async function listActivities(limit=20){
 const u=requireUser();const {data,error}=await requireClient().from('activity_events').select('action,game_title,title_id,search_query,created_at').eq('user_id',u.id).order('created_at',{ascending:false}).limit(Math.min(100,limit));
 if(error)throw new Error(error.message);return data||[];
}
export async function recordActivity(action,game={},query=''){
 if(!current||!client)return;
 const allowed=['search_game','search_cheat','view_game','download_game','download_dlc','download_cheat'];
 if(!allowed.includes(action))return;
 const payload={user_id:current.id,action,game_title:String(game.title||'').slice(0,180),title_id:String(game.titleId||'').slice(0,48),search_query:String(query||'').slice(0,180)};
 const {error}=await client.from('activity_events').insert(payload);
 if(error)console.warn('Activity was not saved:',error.message);
}
export async function clearActivities(){
 const u=requireUser();fail(await requireClient().from('activity_events').delete().eq('user_id',u.id));
}