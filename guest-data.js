



const STORAGE_KEY='zer0game-local-v1';
const visitor=Object.freeze({id:'local-device',email:'Local profile · this browser'});
const blank=()=>({display_name:'Player',avatar_path:'',favorites:[],activities:[]});
let memory=blank();
function load(){
 try{
  const text=localStorage.getItem(STORAGE_KEY);
  if(!text)return;
  const data=JSON.parse(text);
  if(!data||typeof data!=='object')return;
  memory={
   display_name:typeof data.display_name==='string'?data.display_name.slice(0,32):'Player',
   avatar_path:typeof data.avatar_path==='string'&&data.avatar_path.startsWith('data:image/')?data.avatar_path:'',
   favorites:Array.isArray(data.favorites)?data.favorites.slice(0,100):[],
   activities:Array.isArray(data.activities)?data.activities.slice(0,60):[]
  };
 }catch(e){console.warn('[ZER0GAME] Local profile not available:',e);}
}
function persist(){
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(memory));}
 catch(e){console.warn('[ZER0GAME] Browser blocked saving profile',e);}
}
load();
export const authConfigured=false;
export async function initializeAuth(onChange){onChange(visitor);}
export function user(){return visitor;}
export async function getProfile(){return {display_name:memory.display_name,avatar_path:memory.avatar_path};}
export async function saveProfile(name,path){
 const value=String(name??'').trim();
 if(value.length>32)throw new Error('Nickname can have up to 32 characters.');
 memory.display_name=value||'Player';
 if(path!==undefined)memory.avatar_path=path;
 persist();
}
export function avatarUrl(path){return typeof path==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(path)?path:'';}
export async function uploadAvatar(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPG, PNG or WebP image.');
 if(file.size>2097152)throw new Error('Avatar must be 2 MB or smaller.');
 const image=await createImageBitmap(file);
 try{
  const canvas=document.createElement('canvas');
  const scale=Math.min(1,256/Math.max(image.width,image.height));
  canvas.width=Math.max(1,Math.round(image.width*scale));
  canvas.height=Math.max(1,Math.round(image.height*scale));
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/webp',.75);
 }finally{image.close();}
}
export async function listFavorites(){return [...memory.favorites];}
export async function setFavorite(key,title,enabled){
 const safeKey=String(key||'').slice(0,180);
 if(!safeKey)throw new Error('Missing game ID');
 memory.favorites=memory.favorites.filter(f=>f.game_key!==safeKey);
 if(enabled)memory.favorites.unshift({game_key:safeKey,game_title:String(title||'').slice(0,180)});
 memory.favorites=memory.favorites.slice(0,100);
 persist();
}
export async function listActivities(limit=30){return memory.activities.slice(0,Math.min(60,limit));}
export async function recordActivity(action,game={},query=''){
 const allowed=['search_game','search_cheat','view_game','download_game','download_dlc','download_cheat'];
 if(!allowed.includes(action))return;
 const item={
  action,
  game_title:String(game.title||'').slice(0,180),
  title_id:String(game.titleId||'').slice(0,48),
  search_query:String(query||'').slice(0,180),
  created_at:new Date().toISOString()
 };
 memory.activities.unshift(item);
 memory.activities=memory.activities.slice(0,60);
 persist();
}
export async function clearActivities(){memory.activities=[];persist();}
export async function signOut(){
 
 memory=blank();
 try{localStorage.removeItem(STORAGE_KEY);}catch{}
}
export async function sendCode(){throw new Error('Email registration is coming later.');}
export async function verifyCode(){throw new Error('Email registration is coming later.');}
