import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const root=join(import.meta.dirname,'..');
const read=name=>readFileSync(join(root,name),'utf8');
const html=read('index.html'),script=read('dashboard.js'),experience=read('dashboard-experience.js'),guest=read('guest-data.js'),auth=read('auth-service.js'),motion=read('dashboard-cinematic.js'),motionCSS=read('dashboard-cinematic.css'),visualJS=read('dashboard-visual-pass.js'),visualCSS=read('dashboard-visual-pass.css');
test('Dashboard preserves public catalog, all action buttons and classic routes',()=>{
 for(const item of ['games.json','classic.html','admin.html','builder.html','dashboard.css','dashboard-visual-pass.js','authDialog','profileDialog','gameDialog','firmwareFilter','categoryFilter','languageFilter','clearActivity'])
   assert.ok(html.includes(item)||script.includes(item),'Missing feature: '+item);
 for(const action of ['download_','search_game','search_cheat','view_game','counterKey','lock.html'])
   assert.ok(script.includes(action),'Missing action: '+action);
 assert.ok(experience.includes("import './dashboard.js'"),'Dashboard experience must initialize core');
 assert.ok(motion.includes("import './dashboard-experience.js'"),'Motion layer must initialize dashboard experience');
 assert.ok(visualJS.includes("import './dashboard-cinematic.js'"),'Visual layer must initialize cinematic effects');
 assert.ok(script.includes("import * as auth from './guest-data.js'"),'Phase 1 must not activate email registration');
});
test('All stat numbers are derived from the real catalog',()=>{
 assert.match(script,/state\.games\.filter/);
 assert.ok(!html.includes('42.6K')&&!html.includes('1,248'));
});
test('OTP generated and verified only at remote Auth provider',()=>{
 assert.match(auth,/signInWithOtp/);
 assert.match(auth,/verifyOtp/);
 assert.match(auth,/type:'email'/);
 assert.ok(!auth.includes('Math.random().toString(10).slice(2,8)'));
 assert.ok(!html.includes('service_role'));
 const config=read('auth-config.js');
 assert.ok(!config.includes('sk_test_'));
});
test('Private user data require authenticated user and SQL RLS policies',()=>{
 for(const operation of ['requireUser','listFavorites','listActivities','clearActivities','uploadAvatar'])
  assert.ok(auth.includes(operation));
 const sql=read('supabase/schema.sql');
 assert.match(sql,/row level security/);
 assert.match(sql,/auth\.uid\(\)/);
 for(const table of ['profiles','favorites','activity_events'])assert.ok(sql.includes(table));
 assert.ok(!/create table.*admin_role/i.test(sql));
});
test('Each ID queried by the dashboard script exists in HTML',()=>{
 const pattern=/\$\('#([A-Za-z][A-Za-z0-9_-]*)'\)/g;
 for(const match of script.matchAll(pattern)){
  assert.ok(html.includes('id="'+match[1]+'"')||script.includes('id="'+match[1]+'"'),'Missing HTML or dynamically rendered id: '+match[1]);
 }
});
test('JavaScript files are parseable',()=>{
 for(const path of ['dashboard.js','dashboard-experience.js','dashboard-cinematic.js','dashboard-visual-pass.js','guest-data.js','auth-service.js','auth-config.js']){
  const source=read(path).replace(/^import .*;\s*$/mg,'').replace(/^export /mg,'');
  assert.doesNotThrow(()=>new Function(source),'Syntax error in '+path);
 }
});
test('Cinematic polish respects user motion settings and accessibility',()=>{
 assert.ok(html.includes('dashboard-cinematic.css'),'Cinematic stylesheet linked');
 assert.ok(motion.includes('prefers-reduced-motion: reduce'),'Reduced-motion media query used');
 assert.ok(motion.includes("document.body.classList.contains('no-motion')"),'User motion setting used');
 assert.ok(motion.includes("('IntersectionObserver' in window)"),'Visibility animations are progressive');
 assert.ok(motion.includes('requestAnimationFrame'),'Pointer effects must be scheduled efficiently');
 assert.ok(motionCSS.includes('@media(prefers-reduced-motion:reduce)'),'Reduced motion CSS fallback');
 assert.ok(motionCSS.includes('dialog3DIn'),'3D dialog opening effect');
 assert.ok(motion.includes('closeDialogAnimated'),'Animated dialog close effect');
 assert.ok(motion.includes("upgradeIcons()"),'Sidebar and shortcut icons are upgraded');
});

test('Reference screenshot readability and visual composition',()=>{
 assert.ok(html.includes('dashboard-visual-pass.css')&&html.includes('dashboard-visual-pass.js'),'Polish assets linked');
 assert.ok(visualJS.includes("api.state.games"),'Artwork must come from the real catalog');
 assert.ok(visualJS.includes('hero-keyart'),'Featured artwork uses a separate contained layer');
 assert.ok(visualJS.includes('widget-art'),'Shortcut tiles show actual catalog artwork');
 assert.ok(visualJS.includes('page-progress'),'Scroll position indicator exists');
 assert.ok(visualCSS.includes('background-image:radial-gradient'),'Hero avoids poster-as-cover zoom');
 assert.ok(visualCSS.includes('font-size:12px'),'Game information is legible');
 assert.ok(visualCSS.includes('prefers-reduced-motion'),'Reduced motion still supported');
 assert.ok(!visualJS.includes('service_role'),'No secret or server-side account access introduced');
});
