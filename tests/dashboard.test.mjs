import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const root=join(import.meta.dirname,'..');
const read=name=>readFileSync(join(root,name),'utf8');
const html=read('index.html'),script=read('dashboard.js'),experience=read('dashboard-experience.js'),guest=read('guest-data.js'),auth=read('auth-service.js');
test('Dashboard preserves public catalog, all action buttons and classic routes',()=>{
 for(const item of ['games.json','classic.html','admin.html','builder.html','dashboard.css','dashboard-experience.js','authDialog','profileDialog','gameDialog','firmwareFilter','categoryFilter','languageFilter','clearActivity'])
   assert.ok(html.includes(item)||script.includes(item),'Missing feature: '+item);
 for(const action of ['download_','search_game','search_cheat','view_game','counterKey','lock.html'])
   assert.ok(script.includes(action),'Missing action: '+action);
 assert.ok(experience.includes("import './dashboard.js'"),'Dashboard experience must initialize core');
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
 for(const path of ['dashboard.js','dashboard-experience.js','guest-data.js','auth-service.js','auth-config.js']){
  const source=read(path).replace(/^import .*;\s*$/mg,'').replace(/^export /mg,'');
  assert.doesNotThrow(()=>new Function(source),'Syntax error in '+path);
 }
});