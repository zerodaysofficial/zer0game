import {readFileSync,writeFileSync,mkdirSync,existsSync,unlinkSync,rmdirSync} from 'node:fs';
import {join} from 'node:path';
const index=readFileSync('index.html','utf8');
const games=JSON.parse(readFileSync('games.json','utf8')).games;
const slug=text=>String(text||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const escape=text=>String(text).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const sectionRoutes=[['games','Game Library'],['cheat-hub','Cheat Hub'],['released','Released Games'],['coming-soon','Coming Soon'],['dlc-library','DLC Library']];
const routes=[...games.map(game=>({slug:slug(game.title),title:game.title})),...sectionRoutes.map(([slug,title])=>({slug,title}))];
const used=new Set();
for(const route of routes){
 if(!route.slug||used.has(route.slug))throw new Error('Duplicate or empty route: '+route.slug);
 used.add(route.slug);
}
function render(route){
 const heading='<title>'+escape(route.title)+' | ZER0GAME</title>';
 const metadata='<meta name="generator" content="zer0game-routes">\n<meta property="og:title" content="'+escape(route.title)+' | ZER0GAME">\n<meta property="og:url" content="https://zerodaysofficial.github.io/zer0game/'+route.slug+'/">\n</head>';
 return index.replace(/<title>[\s\S]*?<\/title>/,heading).replace('</head>',metadata);
}
const previous=existsSync('routes-manifest.json')?JSON.parse(readFileSync('routes-manifest.json','utf8')).paths||[]:[];
for(const old of previous){
 if(!used.has(old)&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(old)){
  const file=join(old,'index.html');
  if(existsSync(file)&&readFileSync(file,'utf8').includes('name="generator" content="zer0game-routes"')){
   unlinkSync(file);
   try{rmdirSync(old)}catch{}
  }
 }
}
for(const route of routes){
 mkdirSync(route.slug,{recursive:true});
 writeFileSync(join(route.slug,'index.html'),render(route));
}
writeFileSync('404.html',index.replace('</head>','<meta name="generator" content="zer0game-routes">\n</head>'));
writeFileSync('routes-manifest.json',JSON.stringify({paths:routes.map(x=>x.slug).sort()},null,2)+'\n');
