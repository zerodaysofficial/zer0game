/* ZER0GAME cinematic motion: no external services and no access to account/admin data.
   GPU-friendly reveal / tilt, inline icons, and native dialog transitions.
 */
import './dashboard-experience.js';

const paths={
 house:'<path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9"/><path d="M9 21v-8h6v8"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 zap:'<path d="M13 2 4 13h7l-1 9 10-12h-7l1-8z"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/><path d="m9 15 2 2 4-4"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
 package:'<path d="m12 2 9 5-9 5-9-5 9-5zM3 7v10l9 5 9-5V7M12 12v10"/>',
 person:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
 history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v6l4 2"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
 community:'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 15a5 5 0 0 1 5 5v1"/>',
 settings:'<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/><path d="m19.4 15 .2.2 1.8 1.4-2 3.4-2.1-.8a9 9 0 0 1-2.1 1.2l-.4 2.1H9.2l-.4-2.1a9 9 0 0 1-2.1-1.2l-2.1.8-2-3.4 1.8-1.4a9 9 0 0 1 0-2.4l-1.8-1.4 2-3.4 2.1.8a9 9 0 0 1 2.1-1.2l.4-2.1h5.6l.4 2.1a9 9 0 0 1 2.1 1.2l2.1-.8 2 3.4-1.8 1.4a9 9 0 0 1 0 2.4z" transform="translate(0 -1) scale(.97)"/>',
 tools:'<path d="m13 2-3 7 5 2-5 11 1-9-5-2 7-9z"/>',
 external:'<rect x="3" y="9" width="12" height="12" rx="2"/><path d="M10 5h9v9M19 5l-9 9"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
 refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 9a8 8 0 0 1 13-3l2 2M4 16l2 2a8 8 0 0 0 13-3"/>',
 gamepad:'<path d="M7 8h10a5 5 0 0 1 4.8 4l.7 5a3 3 0 0 1-4.5 2.8L15 17H9l-3 2.8A3 3 0 0 1 1.5 17l.7-5A5 5 0 0 1 7 8z"/><path d="M7 11v5M4.5 13.5h5M16 13h.01M19 15h.01"/>'
};
function svg(name){return '<svg class="motion-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false">'+(paths[name]||paths.grid)+'</svg>';}
function upgradeIcons(){
 const table={
  'nav:dashboard':'house','nav:library':'grid','nav:cheat':'zap','nav:released':'calendar',
  'nav:soon':'clock','nav:dlc':'package','action:profile':'person','action:activity':'history',
  'action:queue':'download','action:settings':'settings'
 };
 for(const button of document.querySelectorAll('.sidebar .navitem')){
  const target=button.dataset.nav?'nav:'+button.dataset.nav:button.dataset.action?'action:'+button.dataset.action:'';
  const href=button.getAttribute('href')||'';
  const choice=table[target]||(href.includes('builder')?'tools':href.includes('classic')?'external':href.includes('x.com')?'community':null);
  const span=button.querySelector(':scope > span');
  if(choice&&span){span.innerHTML=svg(choice);}
 }
 const widgets={teal:'calendar',purple:'zap',blue:'package',indigo:'search',amber:'refresh',pink:'settings'};
 for(const node of document.querySelectorAll('.quick-widgets .widget')){
  const choice=Object.keys(widgets).find(key=>node.classList.contains(key));
  const span=node.querySelector(':scope > span');
  if(choice&&span)span.innerHTML=svg(widgets[choice]);
 }
 const gamingButton=document.querySelector('.topbar button[data-nav="library"]');
 if(gamingButton)gamingButton.innerHTML=svg('gamepad');
}

const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
const fine=window.matchMedia('(hover:hover) and (pointer:fine)');
const canAnimate=()=>!reduced.matches&&!document.body.classList.contains('no-motion');
const revealSelector='.upper-grid,.quick-widgets,.library,.stats,.profile-summary,.recent-additions,.activity,.download-panel';
let revealObserver=null;
function prepareReveals(){
 if(!canAnimate()||!('IntersectionObserver' in window))return;
 revealObserver=new IntersectionObserver(entries=>{
  for(const entry of entries){
   if(entry.isIntersecting){
    entry.target.classList.add('is-visible');
    revealObserver.unobserve(entry.target);
   }
  }
 },{threshold:.04,rootMargin:'0px 0px -20px 0px'});
 const targets=[...document.querySelectorAll(revealSelector)];
 targets.forEach(target=>{target.classList.add('cinematic-reveal');revealObserver.observe(target);});
 document.body.classList.add('cinematic-ready');
}
function showAllReveals(){
 document.body.classList.remove('cinematic-ready');
 document.querySelectorAll('.cinematic-reveal').forEach(el=>el.classList.add('is-visible'));
 if(revealObserver){revealObserver.disconnect();revealObserver=null;}
}
function tilt(node){
 if(node.dataset.tiltReady==='1')return;
 node.dataset.tiltReady='1';
 let frame=0,latest=null;
 node.addEventListener('pointermove',event=>{
  if(!fine.matches||!canAnimate()||event.pointerType==='touch')return;
  latest={x:event.clientX,y:event.clientY};
  if(frame)return;
  frame=requestAnimationFrame(()=>{
   frame=0;if(!latest)return;
   const rect=node.getBoundingClientRect();
   if(!rect.width||!rect.height)return;
   const x=Math.min(1,Math.max(-1,((latest.x-rect.left)/rect.width-.5)*2));
   const y=Math.min(1,Math.max(-1,((latest.y-rect.top)/rect.height-.5)*2));
   const max=node.classList.contains('widget')?5.2:node.classList.contains('collection-item')?3:6.5;
   node.style.setProperty('--tilt-x',(-y*max).toFixed(2)+'deg');
   node.style.setProperty('--tilt-y',(x*max).toFixed(2)+'deg');
   node.style.setProperty('--spot-x',((x+1)*50).toFixed(1)+'%');
   node.style.setProperty('--spot-y',((y+1)*50).toFixed(1)+'%');
   node.classList.add('is-tilting');
  });
 },{passive:true});
 node.addEventListener('pointerleave',()=>{
  latest=null;
  if(frame){cancelAnimationFrame(frame);frame=0;}
  node.style.removeProperty('--tilt-x');node.style.removeProperty('--tilt-y');
  node.style.removeProperty('--spot-x');node.style.removeProperty('--spot-y');
  node.classList.remove('is-tilting');
 },{passive:true});
}
let gridObserver=null;
function animateCards(){
 const grid=document.querySelector('#gameGrid');
 if(!grid)return;
 function bindCards(){
  const cards=[...grid.querySelectorAll('.game-card')];
  cards.forEach((card,index)=>{
   if(card.dataset.cardMotion==='1')return;
   card.dataset.cardMotion='1';tilt(card);
   if(canAnimate()){
    card.style.setProperty('--stagger-delay',Math.min(index,8)*38+'ms');
    card.classList.add('card-arriving');
    card.addEventListener('animationend',()=>{
     card.classList.remove('card-arriving');
     card.style.removeProperty('--stagger-delay');
    },{once:true});
   }
  });
 }
 bindCards();
 gridObserver=new MutationObserver(bindCards);
 gridObserver.observe(grid,{childList:true});
 document.querySelectorAll('.quick-widgets .widget,.collection-list .collection-item').forEach(tilt);
 const collection=document.getElementById('collectionList');
 if(collection)new MutationObserver(()=>collection.querySelectorAll('.collection-item').forEach(tilt)).observe(collection,{childList:true});
}
function bindHeroParallax(){
 const hero=document.getElementById('hero');
 if(!hero)return;
 let frame=0,latest=null;
 hero.addEventListener('pointermove',event=>{
  if(!fine.matches||!canAnimate())return;
  latest={x:event.clientX,y:event.clientY};
  if(frame)return;
  frame=requestAnimationFrame(()=>{
   frame=0;
   if(!latest)return;
   const box=hero.getBoundingClientRect();
   const x=(latest.x-box.left)/box.width-.5,y=(latest.y-box.top)/box.height-.5;
   hero.style.setProperty('--hero-x',Math.round(-x*16)+'px');
   hero.style.setProperty('--hero-y',Math.round(-y*13)+'px');
  });
 },{passive:true});
 hero.addEventListener('pointerleave',()=>{
  latest=null;if(frame)cancelAnimationFrame(frame);frame=0;
  hero.style.removeProperty('--hero-x');hero.style.removeProperty('--hero-y');
 },{passive:true});
}
function closeDialogAnimated(dialog){
 if(!dialog.open||dialog.classList.contains('motion-closing'))return;
 if(!canAnimate()||typeof dialog.animate!=='function'){
  dialog.close();
  if(dialog.id==='gameDialog'&&window.Zer0Dashboard)window.Zer0Dashboard.state.selected=null;
  return;
 }
 dialog.classList.add('motion-closing');
 const animation=dialog.animate([
  {opacity:1,transform:'perspective(1200px) translateY(0) rotateX(0deg) scale(1)',filter:'blur(0px)'},
  {opacity:0,transform:'perspective(1200px) translateY(30px) rotateX(10deg) scale(.93)',filter:'blur(4px)'}
 ],{duration:240,easing:'cubic-bezier(.4,0,.8,.5)',fill:'forwards'});
 animation.finished.catch(()=>{}).then(()=>{
  if(dialog.open)dialog.close();
  dialog.classList.remove('motion-closing');
  animation.cancel();
  if(dialog.id==='gameDialog'&&window.Zer0Dashboard)window.Zer0Dashboard.state.selected=null;
 });
}
function enableDialog3D(){
 for(const dialog of document.querySelectorAll('dialog.dialog')){
  dialog.addEventListener('cancel',event=>{
   if(canAnimate()){event.preventDefault();closeDialogAnimated(dialog);}
  });
  dialog.addEventListener('close',()=>dialog.classList.remove('motion-closing'));
 }
 // Intercept only the existing modal-close controls: other buttons and native behaviours stay intact.
 document.addEventListener('click',event=>{
  const button=event.target.closest('button[data-action^="close-"]');
  const dialog=button?.closest('dialog.dialog');
  if(!dialog||!canAnimate())return;
  event.preventDefault();event.stopImmediatePropagation();
  closeDialogAnimated(dialog);
 },true);
}
function syncMotionSettings(){
 const motion=document.getElementById('settingMotion');
 if(motion){
  motion.addEventListener('change',()=>{
   if(!canAnimate())showAllReveals();
   else if(!revealObserver)prepareReveals();
  });
 }
 if(typeof reduced.addEventListener==='function')reduced.addEventListener('change',()=>{
  if(reduced.matches)showAllReveals();
  else if(!document.body.classList.contains('no-motion'))prepareReveals();
 });
}
upgradeIcons();
prepareReveals();
animateCards();
bindHeroParallax();
enableDialog3D();
syncMotionSettings();
