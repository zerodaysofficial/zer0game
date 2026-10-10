


import './dashboard-cinematic.js';
const api=window.Zer0Dashboard;
const $=selector=>document.querySelector(selector);
const arts={};
const hero=$('#hero');
const title=$('#featuredTitle');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
const progress=document.createElement('div');
progress.className='page-progress';progress.setAttribute('aria-hidden','true');
document.body.append(progress);
let lastTitle='',progressFrame=0;
function gameArt(g){
 if(!g)return '';
 try{
  const str=api.coverUrl(g);
  const uri=new URL(str,location.href);
  return ['https:','http:'].includes(uri.protocol)?uri.href:'';
 }catch{return '';}
}
function syncHero(){
 const game=api.state.games.find(g=>g.title===title?.textContent);
 const art=gameArt(game);
 if(!game||!art){if(arts.hero){arts.hero.classList.remove('has-art');}return;}
 if(!arts.hero){
  const frame=document.createElement('div');frame.className='hero-keyart';frame.setAttribute('aria-hidden','true');
  const img=document.createElement('img');img.decoding='async';img.alt='';
  img.addEventListener('load',()=>frame.classList.add('has-art'));
  img.addEventListener('error',()=>frame.classList.remove('has-art'));
  frame.append(img);
  hero.insertBefore(frame,hero.querySelector('.hero-main'));
  arts.hero=frame;
 }
 if(lastTitle!==game.title){
  lastTitle=game.title;
  arts.hero.classList.remove('has-art');
  arts.hero.querySelector('img').src=art;
 }
}
function chooseArt(){
 const all=api.state.games;
 if(!all.length)return {};
 const sorted=[...all].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
 const released=sorted.find(g=>g.status==='released'&&gameArt(g));
 const cheat=sorted.find(g=>g.cheatEnabled&&g.cheatDirectUrl&&gameArt(g));
 const dlc=sorted.find(g=>g.dlcDirectUrl&&gameArt(g));
 const newest=sorted.find(g=>gameArt(g));
 const another=sorted.find(g=>g!==newest&&g!==released&&gameArt(g));
 const more=sorted.find(g=>g!==newest&&g!==released&&g!==another&&gameArt(g));
 return {released,cheat:cheat||another,dlc:dlc||another,search:another||newest,recent:newest||another,admin:more||newest};
}
function syncTiles(){
 const art=chooseArt();
 const targets=[
  ['.widget.teal',art.released],
  ['.widget.purple',art.cheat],
  ['.widget.blue',art.dlc],
  ['.widget.indigo',art.search],
  ['.widget.amber',art.recent],
  ['.widget.pink',art.admin]
 ];
 for(const [selector,game] of targets){
  const el=$(selector),url=gameArt(game);
  if(!el||!url||el.dataset.visualCover===url)continue;
  el.dataset.visualCover=url;
  let image=el.querySelector('.widget-art');
  if(!image){
   image=document.createElement('img');
   image.alt='';image.setAttribute('aria-hidden','true');
   image.loading='lazy';image.decoding='async';image.className='widget-art';
   image.addEventListener('error',()=>{image.hidden=true;});
   el.insertBefore(image,el.firstChild);
  }
  image.hidden=false;
  image.src=url;
 }
}
function renderProgress(){
 progressFrame=0;
 const scroller=document.scrollingElement||document.documentElement;
 const available=Math.max(0,scroller.scrollHeight-window.innerHeight);
 const current=Math.max(0,Math.min(1,available?scroller.scrollTop/available:0));
 progress.style.transform='scaleX('+current.toFixed(4)+')';
}
function requestProgress(){
 if(progressFrame)return;
 progressFrame=requestAnimationFrame(renderProgress);
}
function syncVisuals(){syncHero();syncTiles();requestProgress();}
const titleWatch=new MutationObserver(syncHero);
if(title)titleWatch.observe(title,{subtree:true,childList:true,characterData:true});
window.addEventListener('zer0:updated',syncVisuals);
window.addEventListener('resize',requestProgress,{passive:true});
window.addEventListener('scroll',requestProgress,{passive:true});
syncVisuals();
