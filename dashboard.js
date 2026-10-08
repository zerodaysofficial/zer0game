import * as auth from './auth-service.js';
import {counterKey,readCounter,incrementCounter,formatDownloadCount} from './download-counters.mjs';

const $=selector=>document.querySelector(selector);
const $$=selector=>Array.from(document.querySelectorAll(selector));
const state={games:[],search:'',filter:'all',fw:'',genre:'',lang:'',sort:'newest',shown:15,hero:0,user:null,profile:null,favorites:[],activity:[],selected:null};
const esc=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const lower=value=>String(value||'').toLocaleLowerCase();
const titleKey=g=>String(g.titleId||g.title||'unknown').toLowerCase()+'|'+String(g.version||'').toLowerCase();
const isCheat=g=>Boolean(g.cheatEnabled&&g.cheatDirectUrl);
const isDlc=g=>Boolean(g.dlcDirectUrl);
function validUrl(url,relative=false){
 try{const parsed=new URL(String(url||''),location.href);if(!['https:','http:'].includes(parsed.protocol))return '';if(!relative && parsed.protocol!=='https:')return '';return parsed.href;}catch{return '';}
}
function coverUrl(g){return validUrl(g.cover,true);}
function downloads(g){return {game:validUrl(g.directUrl),dlc:validUrl(g.dlcDirectUrl),cheat:isCheat(g)?validUrl(g.cheatDirectUrl):''};}
function lockLink(url){
 try{const bytes=new TextEncoder().encode(url);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return 'lock.html?v=reactlock2#'+btoa(binary);}
 catch{return 'lock.html?v=reactlock2&to='+encodeURIComponent(url);}
}
let toastTimer;
function toast(message){const node=$('#toast');node.textContent=message;node.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('visible'),3600);}
function humanDate(iso){try{return new Intl.DateTimeFormat('en',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(iso));}catch{return '';}}
function currentGames(){
 const q=lower(state.search.trim());
 let filtered=state.games.filter(g=>{
  if(state.filter==='released'&&g.status!=='released')return false;
  if(state.filter==='soon'&&g.status!=='soon')return false;
  if(state.filter==='cheat'&&!isCheat(g))return false;
  if(state.filter==='dlc'&&!isDlc(g))return false;
  if(state.fw&&String(g.firmware||'')!==state.fw)return false;
  if(state.genre&&!(g.genres||[]).includes(state.genre))return false;
  if(state.lang&&!([...(g.languages?.text||[]),...(g.languages?.audio||[])].includes(state.lang)))return false;
  return !q||[g.title,g.titleId,g.firmware,g.version,g.notes,...(g.genres||[])].some(x=>lower(x).includes(q));
 });
 if(state.sort==='az')filtered.sort((a,b)=>a.title.localeCompare(b.title));
 else if(state.sort==='za')filtered.sort((a,b)=>b.title.localeCompare(a.title));
 else filtered.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
 return filtered;
}
function featuredGames(){const released=state.games.filter(g=>g.status==='released');const w=state.games.find(g=>lower(g.title).includes('wolverine'));return [w,...released.filter(g=>g!==w)].filter(Boolean).slice(0,6);}
function renderHero(){
 const picks=featuredGames();if(!picks.length)return;
 state.hero=(state.hero+picks.length)%picks.length;const g=picks[state.hero],links=downloads(g),src=coverUrl(g);
 $('#featuredTitle').textContent=g.title||'Unknown game';
 $('#featuredDescription').textContent=(g.genres||[]).join(' · ')||'PS5 catalog release';
 $('#featuredPpsa').textContent=g.titleId||'No PPSA';
 $('#featuredVersion').textContent=g.version||'Version —';
 $('#featuredFw').textContent='FW '+(g.firmware||'—');
 $('#featuredCheat').textContent=isCheat(g)?'ϟ CHEAT READY':'CHEAT —';
 $('#heroBg').style.backgroundImage=src?'linear-gradient(90deg,#080b18ab,#09112644),url("'+src.replace(/["\\]/g,'')+'")':'';
 $('#heroChecks').innerHTML='<div>'+(links.game?'Game link available':'No game link')+'</div><div>'+(links.cheat?'Cheat link available':'No cheat link')+'</div><div>'+(links.dlc?'DLC link available':'No DLC link')+'</div>';
 $('#heroPages').textContent=picks.map((_,i)=>i===state.hero?'●':'○').join(' ');
 $('#featuredDownload').disabled=!links.game;$('#featuredDownload').textContent=links.game?'↓ DOWNLOAD GAME':'COMING SOON';
 $('#featuredDownload').onclick=()=>handleDownload(g,'game');
 $('#featuredDetails').onclick=()=>openGame(g);
}
function populateSelect(select,values){
 const first=select.options[0].textContent;select.innerHTML='';const head=document.createElement('option');head.value='';head.textContent=first;select.append(head);
 Array.from(new Set(values.filter(Boolean))).sort((a,b)=>a.localeCompare(b)).forEach(value=>{const opt=document.createElement('option');opt.value=value;opt.textContent=value;select.append(opt);});
}
function setStats(){
 const all=state.games;$('#statGames').textContent=all.length.toLocaleString();$('#statCheats').textContent=all.filter(isCheat).length.toLocaleString();$('#statDlc').textContent=all.filter(isDlc).length.toLocaleString();$('#statReleases').textContent=all.filter(g=>g.status==='released').length.toLocaleString();
}
function cardMarkup(g){
 const src=coverUrl(g);const id=esc(titleKey(g));const saved=state.favorites.some(f=>f.game_key===titleKey(g));const links=downloads(g);
 return '<article class="game-card">'+
  '<button class="cover-button" data-open="'+id+'" aria-label="Details for '+esc(g.title)+'">'+
   (src?'<img class="game-cover" loading="lazy" src="'+esc(src)+'" alt="'+esc(g.title)+' cover">':'<div class="game-cover"></div>')+
   '<span class="ps5-strip">PS5 <span style="float:right;letter-spacing:0">ZER0GAME</span></span><span class="status-badge '+(g.status==='soon'?'soon':'')+'">'+(g.status==='soon'?'COMING SOON':'RELEASED')+'</span></button>'+
  '<div class="game-data"><h3 title="'+esc(g.title)+'">'+esc(g.title)+'</h3><p>'+esc(g.titleId||'No PPSA')+' · '+esc(g.version||'—')+'</p><p>FW '+esc(g.firmware||'—')+'</p>'+
  '<div class="tags"><span class="tag '+(links.game?'available':'')+'">Game</span><span class="tag '+(links.dlc?'available':'')+'">DLC</span><span class="tag '+(links.cheat?'available':'')+'">Cheat</span></div>'+
  '<div class="card-actions"><button data-open="'+id+'">VIEW DETAILS →</button><button data-favorite="'+id+'" class="heart '+(saved?'saved':'')+'" title="Save game" aria-label="Add or remove favourite">'+(saved?'♥':'♡')+'</button></div></div></article>';
}
function renderLibrary(){
 const results=currentGames();$('#resultCount').textContent=results.length+' matching games';
 $('#gameGrid').innerHTML=results.length?results.slice(0,state.shown).map(cardMarkup).join(''):'<p class="empty-hint">No matches. Try another search or filter.</p>';
 $('#loadMore').hidden=state.shown>=results.length;
 $$('[data-filter]').forEach(button=>button.classList.toggle('selected',button.dataset.filter===state.filter));
}
function renderCollection(){
 const userSaved=state.favorites.map(item=>state.games.find(g=>titleKey(g)===item.game_key)).filter(Boolean);
 const chosen=userSaved.length?userSaved:featuredGames().slice(0,4);
 $('#collectionHeading').textContent=userSaved.length?'MY COLLECTION':'FEATURED COLLECTION';
 $('#collectionHint').textContent=userSaved.length?'Your saved games':'Sign in and tap ♡ to keep a personal collection.';
 $('#collectionList').innerHTML=chosen.slice(0,4).map(g=>{
  const src=coverUrl(g);return '<button class="collection-item" data-open="'+esc(titleKey(g))+'">'+
  (src?'<img loading="lazy" src="'+esc(src)+'" alt="">':'')+'<div class="cinfo"><strong>'+esc(g.title)+'</strong><small>'+esc(g.titleId||'No PPSA')+' · '+esc(g.version||'—')+'</small><small>'+[downloads(g).game?'GAME':'',downloads(g).dlc?'DLC':'',downloads(g).cheat?'CHEAT':''].filter(Boolean).join(' · ')+'</small><div class="meter"></div></div></button>';
 }).join('');
}
function renderActivity(){
 const list=state.activity;
 $('#activityList').innerHTML=state.user?(list.length?list.slice(0,6).map(e=>'<div class="activity-entry"><span>'+(['search_game','search_cheat'].includes(e.action)?'⌕':e.action.startsWith('download')?'↓':'◈')+'</span><div><strong>'+esc(e.action.replaceAll('_',' ').toUpperCase())+' · '+esc(e.game_title||e.search_query||'Catalog')+'</strong><small>'+esc(humanDate(e.created_at))+'</small></div></div>').join(''):'<p class="empty-hint">No searches or download clicks yet.</p>'):'<p class="empty-hint">Sign in to securely save and view your own history.</p>';
}
function refresh(){renderHero();renderLibrary();renderCollection();renderActivity();}
function gameByKey(key){return state.games.find(g=>titleKey(g)===key);}
function openGame(g){
 if(!g)return;state.selected=g;const links=downloads(g),src=coverUrl(g),langs=[...(g.languages?.text||[])];
 const langMarkup=langs.length?'<h3>Text languages</h3><div class="language-chips">'+langs.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div>':'';
 $('#gameDialogContent').innerHTML='<div class="game-dialog-grid">'+(src?'<img src="'+esc(src)+'" alt="'+esc(g.title)+' cover">':'<div></div>')+
  '<div><span class="kicker">ZER0GAME / GAME DETAILS</span><h2>'+esc(g.title)+'</h2><p class="game-meta">Title ID: '+esc(g.titleId||'—')+'<br>Version: '+esc(g.version||'—')+'<br>Firmware: '+esc(g.firmware||'—')+'<br>Status: '+esc(g.status||'—')+'<br>Size: '+esc(g.size||'—')+'</p>'+
  '<div class="dialog-actions">'+(links.game?'<button class="primary-btn" data-download="game">↓ DOWNLOAD GAME</button>':'')+(links.dlc?'<button class="ghost-btn" data-download="dlc">↓ DOWNLOAD DLC</button>':'')+(links.cheat?'<button class="ghost-btn" data-download="cheat">ϟ DOWNLOAD CHEAT</button>':'')+'</div>'+
  (g.debugMenuSoon?'<p class="micro">DEBUG MENU SOON</p>':'')+'<div id="modalCounter" class="counter-label">Game and cheat counters loading…</div>'+
  '<p class="notes">'+esc(g.notes||'')+'</p>'+langMarkup+(g.infoUrl&&validUrl(g.infoUrl)?'<p><a class="text-link" href="'+esc(validUrl(g.infoUrl))+'" target="_blank" rel="noopener noreferrer">OFFICIAL INFORMATION ↗</a></p>':'')+'</div></div>';
 $('#gameDialog').showModal();
 void auth.recordActivity('view_game',g).then(()=>loadActivities());
 const labels=[];if(links.game)labels.push({kind:'game',label:'Game'});if(links.cheat)labels.push({kind:'cheat',label:'Cheat'});
 if(labels.length){Promise.all(labels.map(async item=>{try{return item.label+': '+formatDownloadCount(await readCounter(counterKey(g,item.kind)));}catch{return item.label+': unavailable';}})).then(parts=>{if(state.selected===g&&$('#modalCounter'))$('#modalCounter').textContent=parts.join(' · ');});}
 else $('#modalCounter').textContent='No game or cheat download links';
}
function handleDownload(g,kind){
 const url=downloads(g)[kind];
 if(!url){toast('No '+kind+' link is available for this game.');return;}
 // Open immediately on a trusted user click, before any asynchronous requests.
 const opened=window.open(lockLink(url),'_blank','noopener,noreferrer');
 if(!opened)toast('Your browser may have blocked the new download tab.');
 void auth.recordActivity('download_'+kind,g).then(()=>loadActivities());
 if(kind==='game'||kind==='cheat')void incrementCounter(counterKey(g,kind)).catch(()=>{});
}
async function toggleFavorite(g){
 if(!auth.user()){showAuth();return;}
 const key=titleKey(g),saved=state.favorites.some(f=>f.game_key===key);
 try{await auth.setFavorite(key,g.title,!saved);state.favorites=await auth.listFavorites();renderCollection();renderLibrary();toast(saved?'Removed from your collection.':'Saved to your collection.');}
 catch(e){toast(e.message);}
}
async function loadActivities(){if(!auth.user())return;try{state.activity=await auth.listActivities(30);renderActivity();}catch(e){console.warn(e.message);}}
async function loadAccount(user){
 state.user=user;state.profile=null;state.favorites=[];state.activity=[];
 if(user){
  try{const [profile,favorites,activities]=await Promise.all([auth.getProfile(),auth.listFavorites(),auth.listActivities(30)]);if(auth.user()?.id!==user.id)return;state.profile=profile;state.favorites=favorites;state.activity=activities;}
  catch(e){console.warn('Account data:',e.message);}
 }
 const name=state.profile?.display_name?.trim()||user?.email?.split('@')[0]||'Player';
 $('#welcomeName').textContent=name;$('#accountLabel').textContent=user?'Profile':'Sign in';
 const path=state.profile?.avatar_path;const image=auth.avatarUrl(path);
 $('#topAvatar').innerHTML=image?'<img alt="Your avatar" src="'+esc(image)+'">':'Z0';
 renderCollection();renderActivity();renderLibrary();
}
let emailForOtp='',lastOtpAt=0;
function showAuth(){
 if(auth.user()){openProfile();return;}
 $('#authDisabled').hidden=auth.authConfigured;
 $('#sendOtpForm').hidden=!auth.authConfigured;
 $('#verifyOtpForm').hidden=true;
 $('#authMessage').textContent='';
 $('#authDialog').showModal();
}
async function openProfile(){
 if(!auth.user()){showAuth();return;}
 $('#profileEmail').textContent=auth.user().email||'Signed in';
 $('#profileName').value=state.profile?.display_name||'';
 $('#profileAvatar').innerHTML=auth.avatarUrl(state.profile?.avatar_path)?'<img src="'+esc(auth.avatarUrl(state.profile.avatar_path))+'" alt="">':'Z0';
 $('#profileMessage').textContent='';
 $('#profileDialog').showModal();
}
function navigate(section){
 if(['cheat','dlc','released','soon'].includes(section))state.filter=section;
 else state.filter='all';
 state.shown=15;
 $$('.navitem[data-nav]').forEach(n=>n.classList.toggle('active',n.dataset.nav===section));
 renderLibrary();
 if(section!=='dashboard')$('#library').scrollIntoView({behavior:'smooth',block:'start'});
 else window.scrollTo({top:0,behavior:'smooth'});
}
function eventHandlers(){
 $$('#heroPrev,#heroNext').forEach(btn=>btn.addEventListener('click',()=>{state.hero+=btn.id==='heroNext'?1:-1;renderHero();}));
 $('#searchInput').addEventListener('input',e=>{
  state.search=e.target.value;state.shown=15;renderLibrary();scheduleSearchEvent();
 });
 document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();$('#searchInput').focus();}if(e.key==='Escape')state.selected=null;});
 $$('#firmwareFilter,#categoryFilter,#languageFilter,#sortFilter').forEach(node=>node.addEventListener('change',()=>{
  state.fw=$('#firmwareFilter').value;state.genre=$('#categoryFilter').value;state.lang=$('#languageFilter').value;state.sort=$('#sortFilter').value;state.shown=15;renderLibrary();
 }));
 $('#loadMore').addEventListener('click',()=>{state.shown+=15;renderLibrary();});
 document.addEventListener('click',e=>{
  const nav=e.target.closest('[data-nav]');if(nav){navigate(nav.dataset.nav);return;}
  const filter=e.target.closest('[data-filter]');if(filter){state.filter=filter.dataset.filter;state.shown=15;renderLibrary();return;}
  const open=e.target.closest('[data-open]');if(open){openGame(gameByKey(open.dataset.open));return;}
  const fav=e.target.closest('[data-favorite]');if(fav){void toggleFavorite(gameByKey(fav.dataset.favorite));return;}
  const action=e.target.closest('[data-action]');
  if(action){
   if(action.dataset.action==='account'||action.dataset.action==='profile')auth.user()?openProfile():showAuth();
   else if(action.dataset.action==='favorites'){if(!auth.user())showAuth();else{$('#collectionHeading').scrollIntoView({behavior:'smooth'});toast('Your saved collection is shown above.');}}
   else if(action.dataset.action==='activity'){if(!auth.user())showAuth();else $('#activity').scrollIntoView({behavior:'smooth'});}
   else if(action.dataset.action==='focus-search'){$('#searchInput').focus();$('#searchInput').scrollIntoView({behavior:'smooth'});}
   else if(action.dataset.action==='close-game'){$('#gameDialog').close();state.selected=null;}
   else if(action.dataset.action==='close-auth')$('#authDialog').close();
   else if(action.dataset.action==='close-profile')$('#profileDialog').close();
   return;
  }
  const dl=e.target.closest('[data-download]');if(dl&&state.selected)handleDownload(state.selected,dl.dataset.download);
 });
 $('#sendOtpForm').addEventListener('submit',async e=>{
  e.preventDefault();const msg=$('#authMessage');msg.textContent='';
  const email=$('#authEmail').value.trim().toLowerCase();
  if(Date.now()-lastOtpAt<60000){msg.textContent='Wait before requesting another code.';return;}
  const btn=e.target.querySelector('[type=submit]');btn.disabled=true;
  try{await auth.sendCode(email);emailForOtp=email;lastOtpAt=Date.now();$('#sendOtpForm').hidden=true;$('#verifyOtpForm').hidden=false;msg.textContent='Check your inbox for your 6-digit code.';}
  catch(error){msg.textContent=error.message;}finally{btn.disabled=false;}
 });
 $('#verifyOtpForm').addEventListener('submit',async e=>{
  e.preventDefault();const msg=$('#authMessage');const btn=e.target.querySelector('[type=submit]');btn.disabled=true;
  try{await auth.verifyCode(emailForOtp,$('#authCode').value.trim());$('#authDialog').close();$('#authCode').value='';toast('Email verified. Welcome to ZER0GAME!');}
  catch(error){msg.textContent=error.message;}finally{btn.disabled=false;}
 });
 $('#resendOtp').addEventListener('click',async()=>{const msg=$('#authMessage');if(Date.now()-lastOtpAt<60000){msg.textContent='Please wait 60 seconds before requesting another code.';return;}try{await auth.sendCode(emailForOtp);lastOtpAt=Date.now();msg.textContent='A new code has been requested.';}catch(e){msg.textContent=e.message;}});
 $('#profileForm').addEventListener('submit',async e=>{
  e.preventDefault();const btn=e.target.querySelector('[type=submit]'),msg=$('#profileMessage');btn.disabled=true;msg.textContent='';
  try{let path=state.profile?.avatar_path||'';const file=$('#avatarFile').files?.[0];if(file)path=await auth.uploadAvatar(file);await auth.saveProfile($('#profileName').value,path);await loadAccount(auth.user());$('#profileAvatar').innerHTML=auth.avatarUrl(path)?'<img src="'+esc(auth.avatarUrl(path))+'" alt="">':'Z0';msg.textContent='Profile saved!';toast('Your profile has been saved.');}
  catch(error){msg.textContent=error.message;}finally{btn.disabled=false;}
 });
 $('#signOut').addEventListener('click',async()=>{try{await auth.signOut();$('#profileDialog').close();await loadAccount(null);toast('Signed out.');}catch(e){toast(e.message);}});
}
let searchTimer,lastSearch='';
function scheduleSearchEvent(){
 clearTimeout(searchTimer);const text=state.search.trim();if(!auth.user()||text.length<3||text===lastSearch)return;
 searchTimer=setTimeout(()=>{lastSearch=text;void auth.recordActivity(state.filter==='cheat'?'search_cheat':'search_game',{},text).then(()=>loadActivities());},1600);
}
async function loadCatalog(){
 try{
  const response=await fetch('games.json',{cache:'no-store'});if(!response.ok)throw new Error('HTTP '+response.status);
  const json=await response.json();if(!Array.isArray(json.games))throw new Error('Invalid catalog data');
  state.games=json.games.filter(g=>g&&typeof g.title==='string');
  populateSelect($('#firmwareFilter'),state.games.map(g=>g.firmware));
  populateSelect($('#categoryFilter'),state.games.flatMap(g=>g.genres||[]));
  populateSelect($('#languageFilter'),state.games.flatMap(g=>[...(g.languages?.text||[]),...(g.languages?.audio||[])]));
  setStats();refresh();
 }catch(error){console.error(error);$('#gameGrid').innerHTML='<p class="empty-hint">Unable to load the catalog. Please retry later.</p>';toast('Could not fetch games.json');}
}
eventHandlers();void loadCatalog();
auth.initializeAuth(loadAccount).catch(error=>{console.warn(error);$('#authDisabled').hidden=false;$('#sendOtpForm').hidden=true;$('#authDisabled').textContent='Authentication service could not load. Please try later.';});
