

import './dashboard.js?v=20261009';
const api=window.Zer0Dashboard;
if(!api)throw new Error('Zer0Game dashboard must load before the experience layer');
const {state,auth,titleKey,downloads,coverUrl,gameByKey}=api;
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=(key,alternative)=>{try{const v=JSON.parse(localStorage.getItem(key));return v??alternative;}catch{return alternative;}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{notify('Browser storage is unavailable.');}};
const QUEUE='zer0game-link-queue-v1',PREFS='zer0game-ui-settings-v1',SEEN='zer0game-last-seen-v1',FILTERS='zer0game-remember-filters-v1';
let queue=read(QUEUE,[]);
if(!Array.isArray(queue))queue=[];
queue=queue.filter(x=>x&&typeof x.key==='string'&&['game','dlc','cheat'].includes(x.kind)).slice(0,30);
let prefs={motion:true,compact:false,remember:false,...read(PREFS,{})};
let seen=read(SEEN,'');
let filtersRestored=false;
let notifTimeout;
function notify(message){
 const node=$('#toast');if(!node)return;
 node.textContent=message;node.classList.add('visible');clearTimeout(notifTimeout);
 notifTimeout=setTimeout(()=>node.classList.remove('visible'),2800);
}
function dateLabel(date){if(!date)return '—';try{return new Intl.DateTimeFormat('en',{month:'short',day:'numeric'}).format(new Date(date+'T12:00:00'));}catch{return date;}}
function timeLabel(date){try{return new Intl.DateTimeFormat('en',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(date));}catch{return '';}}
function recentGames(){return [...state.games].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,7);}
function recentEntry(g){
 const cover=coverUrl(g);
 return '<button class="recent-game" type="button" data-open="'+esc(titleKey(g))+'">'+(cover?'<img loading="lazy" src="'+esc(cover)+'" alt="">':'')+
 '<span><strong>'+esc(g.title)+'</strong><small>'+esc(g.titleId||'No PPSA')+' · '+esc(dateLabel(g.date))+'</small></span><span class="recent-arrow">⋮</span></button>';
}
function renderRecent(){
 const games=recentGames(),html=games.slice(0,4).map(recentEntry).join('');
 $('#recentList').innerHTML=html||'<p class="empty-hint">No catalog additions found.</p>';
 $('#notificationList').innerHTML=games.map(recentEntry).join('')||'<p class="empty-hint">No recent additions.</p>';
 const newest=games[0]?.date||'';
 $('#notificationDot').hidden=!newest||Boolean(seen&&newest<=seen);
}
function updateBars(){
 $$('#collectionList .collection-item').forEach(node=>{
  const game=gameByKey(node.dataset.open);if(!game)return;
  const available=Object.values(downloads(game)).filter(Boolean).length;
  const meter=node.querySelector('.meter');
  if(meter){meter.style.setProperty('--avail',Math.round(available/3*100)+'%');meter.title=available+' of 3 link types available';}
 });
}
function renderSummary(){
 const events=state.activity||[];
 const views=events.filter(x=>x.action==='view_game').length;
 const searches=events.filter(x=>x.action==='search_game'||x.action==='search_cheat').length;
 const gameLinks=events.filter(x=>x.action==='download_game').length;
 const cheatLinks=events.filter(x=>x.action==='download_cheat').length;
 const allLinks=events.filter(x=>x.action?.startsWith('download_')).length;
 const avatar=auth.avatarUrl(state.profile?.avatar_path);
 $('#summaryName').textContent=state.profile?.display_name||'Player';
 $('#summaryAvatar').innerHTML=avatar?'<img alt="Your avatar" src="'+esc(avatar)+'">':'Z0';
 $('#profileSaved').textContent=(state.favorites||[]).length;
 $('#profileViews').textContent=views;
 $('#profileLinks').textContent=allLinks;
 const milestones=[
  {icon:'⌕',title:'Explorer',desc:'Search the game library',unlocked:searches>=1},
  {icon:'♡',title:'Collector',desc:'Save at least one game',unlocked:state.favorites.length>=1},
  {icon:'⚡',title:'Cheat Hunter',desc:'Open a cheat link',unlocked:cheatLinks>=1},
  {icon:'✦',title:'Curious',desc:'View 5 game pages',unlocked:views>=5},
  {icon:'⇩',title:'Link Opener',desc:'Open a game link',unlocked:gameLinks>=1}
 ];
 $('#achievementRow').innerHTML=milestones.map(x=>'<div class="achievement '+(x.unlocked?'unlocked':'locked')+'" title="'+esc(x.title+': '+x.desc)+'"><span>'+x.icon+'</span><small>'+esc(x.title)+'</small></div>').join('');
}
function renderLastLink(){
 const event=(state.activity||[]).find(x=>/^download_(game|dlc|cheat)$/.test(x.action));
 if(!event){$('#lastDownload').innerHTML='<p class="empty-hint">No external links opened yet. Choose DOWNLOAD from a game page to start your history.</p>';return;}
 const game=state.games.find(x=>x.title===event.game_title&&(!event.title_id||x.titleId===event.title_id))||state.games.find(x=>x.title===event.game_title);
 const cover=game&&coverUrl(game);
 $('#lastDownload').innerHTML=(cover?'<img class="last-cover" src="'+esc(cover)+'" alt="">':'')+
 '<div class="last-info"><strong>'+esc(event.game_title||'Game')+'</strong><small>'+esc(event.action.replace('download_','').toUpperCase())+' LINK OPENED · '+esc(timeLabel(event.created_at))+'</small><div class="external-explain">↗ Opened on external host · no file progress data</div></div>'+
 (game?'<button type="button" data-open="'+esc(titleKey(game))+'" class="ghost-btn">DETAILS →</button>':'');
}
function queueEntry(item,index,removable){
 const game=gameByKey(item.key);if(!game)return '';
 const cover=coverUrl(game);
 return '<div class="queue-entry">'+(cover?'<img loading="lazy" src="'+esc(cover)+'" alt="">':'')+
 '<span><strong>'+esc(game.title)+'</strong><small>'+esc(item.kind.toUpperCase())+' · ready to open</small></span>'+
 '<button type="button" data-queue-open="'+index+'" aria-label="Open queued '+esc(item.kind)+' link" title="Open link">↗</button>'+
 (removable?'<button type="button" data-queue-remove="'+index+'" aria-label="Remove queued link" title="Remove">×</button>':'')+'</div>';
}
function renderQueue(){
 queue=queue.filter(x=>{const game=gameByKey(x.key);return Boolean(game&&downloads(game)[x.kind]);});
 $('#queueCount').textContent='('+queue.length+')';
 $('#queueList').innerHTML=queue.slice(0,2).map((x,i)=>queueEntry(x,i,false)).join('')||'<p class="empty-hint">Your queue is empty. Add links from a game’s details.</p>';
 $('#queueDialogList').innerHTML=queue.map((x,i)=>queueEntry(x,i,true)).join('')||'<p class="empty-hint">Nothing queued yet.</p>';
}
function addQueue(game,kind){
 if(!game||!downloads(game)[kind]){notify('This link is not available.');return;}
 const key=titleKey(game);
 if(queue.some(x=>x.key===key&&x.kind===kind)){notify('This link is already in your queue.');return;}
 queue.unshift({key,kind});queue=queue.slice(0,30);save(QUEUE,queue);renderQueue();notify('Added to your link queue.');
}
function openQueue(index){
 const item=queue[index],game=item&&gameByKey(item.key);
 if(game&&downloads(game)[item.kind])api.handleDownload(game,item.kind);
 else notify('The saved link is no longer available.');
}
function applyPreferences(){
 document.body.classList.toggle('no-motion',!prefs.motion);
 document.body.classList.toggle('compact-mode',!!prefs.compact);
 $('#settingMotion').checked=!!prefs.motion;
 $('#settingCompact').checked=!!prefs.compact;
 $('#settingRemember').checked=!!prefs.remember;
}
function saveFilters(){
 if(!prefs.remember)return;
 save(FILTERS,{search:state.search,filter:state.filter,fw:state.fw,genre:state.genre,lang:state.lang,sort:state.sort});
}
function restoreFilters(){
 if(filtersRestored||!state.games.length)return;
 filtersRestored=true;
 if(!prefs.remember)return;
 const saved=read(FILTERS,{});
 if(saved&&typeof saved==='object'){
  for(const key of ['search','filter','fw','genre','lang','sort'])if(typeof saved[key]==='string'&&saved[key].length<140)state[key]=saved[key];
  if(!['all','released','soon','cheat','dlc'].includes(state.filter))state.filter='all';
  $('#searchInput').value=state.search;
  for(const [key,input] of [['fw','firmwareFilter'],['genre','categoryFilter'],['lang','languageFilter'],['sort','sortFilter']]){
    const element=$('#'+input);if(Array.from(element.options).some(opt=>opt.value===state[key]))element.value=state[key];
    else state[key]=element.value;
  }
  api.renderLibrary();
 }
}
function sync(){
 if(!state.games.length)return;
 restoreFilters();
 renderRecent();
 renderSummary();
 renderLastLink();
 renderQueue();
 updateBars();
}
function onGameOpen(e){
 if($('#notificationDialog').open)$('#notificationDialog').close();
 const game=e.detail?.game;if(!game)return;
 const links=downloads(game);
 const content=$('#gameDialogContent');
 let old=content.querySelector('.queue-actions');if(old)old.remove();
 const bar=document.createElement('div');bar.className='queue-actions';
 bar.innerHTML=Object.entries(links).filter(([,url])=>url).map(([kind])=>'<button class="ghost-btn" type="button" data-addqueue="'+kind+'">＋ QUEUE '+esc(kind.toUpperCase())+'</button>').join('');
 if(bar.childElementCount)content.querySelector('.dialog-actions')?.insertAdjacentElement('afterend',bar);
}
function configureActions(){
 document.addEventListener('click',event=>{
  const add=event.target.closest('[data-addqueue]');if(add&&state.selected){addQueue(state.selected,add.dataset.addqueue);return;}
  const open=event.target.closest('[data-queue-open]');if(open){openQueue(Number(open.dataset.queueOpen));return;}
  const remove=event.target.closest('[data-queue-remove]');if(remove){queue.splice(Number(remove.dataset.queueRemove),1);save(QUEUE,queue);renderQueue();return;}
  const action=event.target.closest('[data-action]');if(!action)return;
  const target=action.dataset.action;
  if(target==='settings'){applyPreferences();$('#settingsDialog').showModal();}
  if(target==='queue'){renderQueue();$('#queueDialog').showModal();}
  if(target==='notifications'){
   seen=recentGames()[0]?.date||'';save(SEEN,seen);renderRecent();$('#notificationDialog').showModal();
  }
  if(target==='recent'){
   state.filter='all';state.sort='newest';state.shown=15;$('#sortFilter').value='newest';
   api.renderLibrary();saveFilters();
   $$('#notificationDialog[open]').forEach(dialog=>dialog.close());
   $('#library').scrollIntoView({behavior:prefs.motion?'smooth':'auto',block:'start'});
  }
  if(target==='close-settings')$('#settingsDialog').close();
  if(target==='close-queue')$('#queueDialog').close();
  if(target==='close-notifications')$('#notificationDialog').close();
 });
 for(const [field,key] of [['settingMotion','motion'],['settingCompact','compact'],['settingRemember','remember']]){
  $('#'+field).addEventListener('change',e=>{prefs[key]=e.target.checked;save(PREFS,prefs);applyPreferences();if(key==='remember')saveFilters();});
 }
 $('#resetSettings').addEventListener('click',()=>{
  prefs={motion:true,compact:false,remember:false};save(PREFS,prefs);applyPreferences();notify('Settings reset.');
 });
 $('#clearQueue').addEventListener('click',()=>{
  if(!queue.length)return;if(!confirm('Clear your saved link queue?'))return;
  queue=[];save(QUEUE,queue);renderQueue();notify('Queue cleared.');
 });
 // Filter choices are stored only if the visitor expressly opts in.
 document.addEventListener('click',event=>{
  if(event.target.closest('[data-filter],[data-nav]'))setTimeout(saveFilters,0);
  if(event.target.closest('[data-favorite]'))setTimeout(sync,160);
 });
 for(const selector of ['#searchInput','#firmwareFilter','#categoryFilter','#languageFilter','#sortFilter']){
  const el=$(selector);el.addEventListener('input',()=>{saveFilters();});
  el.addEventListener('change',saveFilters);
 }
 window.addEventListener('storage',event=>{if(event.key===QUEUE){queue=read(QUEUE,[]);renderQueue();}});
}
configureActions();
applyPreferences();
window.addEventListener('zer0:updated',sync);
window.addEventListener('zer0:game-open',onGameOpen);
window.addEventListener('zer0:download-open',()=>setTimeout(sync,120));
sync();
