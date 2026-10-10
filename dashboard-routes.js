import './dashboard-visual-pass.js?v=20261010';
const api=window.Zer0Dashboard;
const root=new URL('.',import.meta.url).pathname;
const $=selector=>document.querySelector(selector);
const $$=selector=>Array.from(document.querySelectorAll(selector));
const segments={dashboard:'',library:'games',cheat:'cheat-hub',released:'released',soon:'coming-soon',dlc:'dlc-library'};
const titles={dashboard:'ZER0GAME',library:'GAME LIBRARY',cheat:'CHEAT HUB',released:'RELEASED GAMES',soon:'COMING SOON',dlc:'DLC LIBRARY'};
const slug=text=>String(text||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
let restoring=false,initialized=false;
function urlForSection(section){return root+(segments[section]?segments[section]+'/':'')}
function writeRoute(path,replace=false){
 if(location.pathname===path)return;
 history[replace?'replaceState':'pushState']({zer0game:true},'',path);
}
function section(section,write=true){
 if(!(section in segments))section='library';
 const dialog=$('#gameDialog');
 if(dialog.open)dialog.close();
 api.state.selected=null;
 document.body.classList.remove('route-game');
 document.body.classList.toggle('route-section',section!=='dashboard');
 document.body.dataset.routeSection=section;
 $('#libraryHeading').textContent=titles[section];
 document.title=(section==='dashboard'?'ZER0GAME':titles[section]+' | ZER0GAME');
 api.state.filter=['cheat','released','soon','dlc'].includes(section)?section:'all';
 api.state.shown=15;
 $$('[data-nav]').forEach(el=>el.classList.toggle('active',el.dataset.nav===section));
 api.renderLibrary();
 if(write&&!restoring)writeRoute(urlForSection(section));
}
function gamePage(game){
 if(!game)return;
 const dialog=$('#gameDialog');
 const main=$('.content');
 if(dialog.parentElement!==main)main.querySelector('.topbar').after(dialog);
 if(dialog.open)dialog.close();
 dialog.show();
 document.body.classList.remove('route-section');
 document.body.classList.add('route-game');
 const back=dialog.querySelector('[data-action="close-game"]');
 if(back)back.textContent='← BACK TO LIBRARY';
 document.title=game.title+' | ZER0GAME';
 if(!restoring)writeRoute(root+slug(game.title)+'/');
 window.scrollTo({top:0,behavior:'instant'});
}
function resolve(){
 if(!api.state.games.length)return;
 restoring=true;
 try{
  const segment=decodeURIComponent(location.pathname.slice(root.length)).replace(/^\/+|\/+$/g,'').toLowerCase();
  const found=Object.entries(segments).find(([,part])=>part===segment);
  if(found){section(found[0],false);return;}
  const game=api.state.games.find(item=>slug(item.title)===segment);
  if(game){api.openGame(game);return;}
  section('library',false);
 }finally{restoring=false;}
}
window.addEventListener('zer0:game-open',event=>gamePage(event.detail?.game));
document.addEventListener('click',event=>{
 const nav=event.target.closest('[data-nav]');
 if(nav){section(nav.dataset.nav);return;}
 const filter=event.target.closest('[data-filter]');
 if(filter){section(filter.dataset.filter==='all'?'library':filter.dataset.filter);return;}
 if(event.target.closest('[data-action="close-game"]')&&document.body.classList.contains('route-game')){section('library');return;}
 if(event.target.closest('[data-action="recent"]')){section('library');return;}
},true);
$('#gameDialog').addEventListener('cancel',event=>{
 if(!document.body.classList.contains('route-game'))return;
 event.preventDefault();
 section('library');
});
window.addEventListener('popstate',resolve);
window.addEventListener('zer0:updated',()=>{
 if(!initialized&&api.state.games.length){initialized=true;resolve();}
});
if(api.state.games.length){initialized=true;resolve();}
