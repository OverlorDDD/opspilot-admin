// Windows-first shared orchestration. No changes to database volumes or application business logic.
import {spawn,spawnSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import net from 'node:net';
const ops=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.argv[2]||'both';
if(!['both','ops-public','ops-local'].includes(mode))throw Error('Expected both, ops-public or ops-local');
const both=mode==='both',publicMode=mode!=='ops-local';
const other=resolve(process.env.JYOTISH_PATH||resolve(ops,'..','jyotish-studio-git'));
const domain='voyage-matchbox-claim.ngrok-free.dev';
const opURL='http://127.0.0.1:4000';
const jyURL='http://127.0.0.1:4001';
const isWin=process.platform==='win32',children=[];
let closing=false;
const say=(s)=>console.log('[launcher] '+s);
const fail=(s)=>{throw Error(s)};
function envFrom(path){
 if(!existsSync(path))return {};
 const obj={};
 for(const line of readFileSync(path,'utf8').split(/\r?\n/)){
  const m=line.match(/^\s*([A-Za-z_]\w*)\s*=\s*(.*)\s*$/);
  if(m)obj[m[1]]=m[2].trim().replace(/^["']|["']$/g,'');
 }
 return obj;
}
const opsEnv=envFrom(resolve(ops,'services/config-api/.env'));
const jyEnv=both?envFrom(resolve(other,'.env')):{};
function tool(name,args=[],cwd=ops,quiet=false){
 const exe=isWin?'cmd.exe':name;
 const cmd=isWin?['/d','/s','/c',name+' '+args.map(a=>/[\s"]/g.test(a)?'"'+a.replaceAll('"','')+'"':a).join(' ')]:args;
 const r=spawnSync(exe,cmd,{cwd,encoding:'utf8',timeout:120000,windowsHide:true,env:process.env});
 if(r.error||r.status!==0)fail(name+' '+args.join(' ')+' failed: '+(r.stderr||r.stdout||r.error?.message||'not installed').trim().slice(-750));
 if(!quiet&&r.stdout)console.log(r.stdout.trim());
 return r.stdout||'';
}
function available(command){
 const r=spawnSync(isWin?'where.exe':'which',[command],{encoding:'utf8',windowsHide:true});
 return r.status===0;
}
function npm(args,cwd,env={}){
 const exe=isWin?'cmd.exe':'npm';
 const argv=isWin?['/d','/s','/c','npm '+args.join(' ')]:args;
 return spawn(exe,argv,{cwd,env:{...process.env,...env},stdio:'inherit',windowsHide:false});
}
function runNpm(args,cwd,env){
 const r=isWin?spawnSync('cmd.exe',['/d','/s','/c','npm '+args.join(' ')],{cwd,env:{...process.env,...env},stdio:'inherit',windowsHide:false,timeout:180000}):
 spawnSync('npm',args,{cwd,env:{...process.env,...env},stdio:'inherit',timeout:180000});
 if(r.status!==0)fail('npm '+args.join(' ')+' failed. Fix this before public launch.');
}
function start(name,command,args,cwd,env={},kind='app'){
 const exe=isWin&&['ngrok','cloudflared'].includes(command)?'cmd.exe':command;
 const argv=exe==='cmd.exe'?['/d','/s','/c',[command,...args].join(' ')]:args;
 const child=spawn(exe,argv,{cwd,env:{...process.env,...env},stdio:['ignore','pipe','pipe'],windowsHide:false});
 children.push({name,child,kind});
 for(const [stream,output] of [[child.stdout,process.stdout],[child.stderr,process.stderr]]){
  let pending='';
  stream?.on('data',data=>{
   pending+=data.toString();const lines=pending.split(/\r?\n/);pending=lines.pop()||'';
   for(const line of lines){if(line.trim()){output.write('['+name+'] '+line+'\n');
    if(name==='cloudflare'){const m=line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);if(m)say('Jyotish public: '+m[0]);}
   }}
  });
 }
 child.on('error',e=>console.error('['+name+'] '+e.message));
 child.on('exit',(code)=>{
  if(!closing)console.error('['+name+'] exited ('+code+'). Other services stay running. '+(kind==='tunnel'?'Local sites are still available.':'Check the service output.'));
 });
 return child;
}
function launchNpm(name,args,cwd,env){
 const cmd=isWin?'cmd.exe':'npm',argv=isWin?['/d','/s','/c','npm '+args.join(' ')]:args;
 return start(name,cmd,argv,cwd,env,'app');
}
function checkPort(port){
 return new Promise((ok,no)=>{const s=net.createServer();
  s.once('error',e=>no(new Error('Port '+port+' unavailable ('+e.code+'). Stop the previous server first.')));
  s.listen(port,'127.0.0.1',()=>s.close(ok));
 });
}
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
async function readiness(check,label,maxMs=90000){
 const until=Date.now()+maxMs;
 while(Date.now()<until&&!closing){try{if(await check()){say(label+' ready');return}}catch{}
  await wait(750);}
 fail(label+' not ready within '+Math.round(maxMs/1000)+' seconds. Check Docker and service logs.');
}
async function httpReady(url){
 try{const r=await fetch(url,{signal:AbortSignal.timeout(2500),redirect:'manual'});return r.status>=200&&r.status<500;}catch{return false;}
}
function healthy(container){
 try{return tool('docker',['inspect','--format','{{.State.Health.Status}}',container],ops,true).trim()==='healthy';}catch{return false;}
}
function requireInstall(path,label){if(!existsSync(path))fail(label+' missing: '+path);}
async function cleanup(){
 if(closing)return;closing=true;say('Stopping child processes and tunnels; Docker volumes are preserved.');
 for(const {child} of [...children].reverse()){
  if(child.exitCode!==null||!child.pid)continue;
  if(isWin)spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:5000});
  else child.kill('SIGTERM');
 }
}
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{void cleanup().then(()=>process.exit(0))});
process.on('uncaughtException',e=>{console.error(e);void cleanup().then(()=>process.exit(1))});
async function main(){
 requireInstall(resolve(ops,'package.json'),'OpsPilot repository');
 if(both)requireInstall(resolve(other,'package.json'),'Jyotish repository (set JYOTISH_PATH)');
 if(!available('docker'))fail('Docker CLI unavailable. Start Docker Desktop.');
 if(publicMode&&!available('ngrok'))fail('Install ngrok, configure authtoken, and retry.');
 if(both&&!available('cloudflared'))say('cloudflared missing: Jyotish remains local until installed.');
 requireInstall(resolve(ops,'node_modules'),'OpsPilot dependencies; run npm install manually');
 if(both)requireInstall(resolve(other,'node_modules'),'Jyotish dependencies; run npm install manually');
 if(publicMode){
  const secret=opsEnv.JWT_SECRET||process.env.JWT_SECRET||'';
  if(secret.length<32||secret.includes('development-secret')||secret.includes('change-before'))fail('OpsPilot services/config-api/.env needs a unique JWT_SECRET of at least 32 characters before public access.');
 }
 if(both&&(jyEnv.AUTH_SECRET||process.env.AUTH_SECRET||'').length<32)fail('Jyotish root .env needs an AUTH_SECRET of at least 32 characters before public access.');
 // Check app ports only; DB/Redis ports belong to Docker containers.
 for(const port of (both?[3000,4000,3001,4001]:[3000,4000]))await checkPort(port);
 say('Starting existing Docker Compose services; named volumes remain untouched.');
 tool('docker',['compose','up','-d','postgres','redis'],ops);
 if(both)tool('docker',['compose','up','-d','db'],other);
 await readiness(async()=>healthy('opspilot-postgres')&&healthy('opspilot-redis'),'OpsPilot PostgreSQL/Redis',120000);
 if(both)await readiness(async()=>healthy('jyotish-db'),'Jyotish PostgreSQL',120000);
 // Deploy only already committed, pending migrations. Never reset or seed.
 runNpm(['run','db:generate'],ops);
 runNpm(['run','db:deploy'],ops);
 if(both){runNpm(['run','db:generate'],other);runNpm(['run','db:migrate'],other);}
 const opBackend={...opsEnv,API_PORT:'4000',API_HOST:'127.0.0.1',COOKIE_SECURE:publicMode?'true':'false',
  CORS_ORIGINS:'http://localhost:3000,https://'+domain};
 const opWeb={WEB_PORT:'3000',NEXT_PUBLIC_API_URL:'/api',INTERNAL_API_ORIGIN:opURL};
 const jyWeb={WEB_PORT:'3001',PORT:'4001',INTERNAL_API_ORIGIN:jyURL};
 const jyBackend={WEB_PORT:'3001',PORT:'4001'};
 if(publicMode){
  say('Building production mode: no Next.js dev middleware on public tunnels.');
  runNpm(['run','build'],ops,{...opBackend,...opWeb});
  if(both)runNpm(['run','build'],other,{...jyWeb,...jyBackend});
 }
 launchNpm('op-api',['run',publicMode?'start':'dev','--workspace=@opspilot/config-api'],ops,opBackend);
 launchNpm('op-web',['run',publicMode?'start':'dev','--workspace=@opspilot/web'],ops,opWeb);
 if(both){
  launchNpm('jy-api',['run','dev:api'],other,jyBackend); // backend source stays unchanged
  launchNpm('jy-web',['run',publicMode?'start':'dev','--workspace=@jyotish/web'],other,jyWeb);
 }
 await readiness(()=>httpReady(opURL+'/api/health/live'),'OpsPilot API',90000);
 await readiness(()=>httpReady('http://127.0.0.1:3000/'),'OpsPilot web',90000);
 if(both){
  await readiness(()=>httpReady(jyURL+'/api/health'),'Jyotish API',90000);
  await readiness(()=>httpReady('http://127.0.0.1:3001/'),'Jyotish web',90000);
 }
 say('OpsPilot local: http://localhost:3000');
 if(both)say('Jyotish local: http://localhost:3001');
 if(publicMode){
  start('ngrok','ngrok',['http','3000','--url='+domain],ops,{},'tunnel');
  say('OpsPilot public (after ngrok connects): https://'+domain);
 }
 if(both&&available('cloudflared')){
  start('cloudflare','cloudflared',['tunnel','--url','http://localhost:3001'],other,{},'tunnel');
  say('Waiting for a temporary Jyotish trycloudflare.com URL in cloudflared output.');
 }
 await new Promise(()=>{}); // stay alive until Ctrl+C
}
main().catch(e=>{console.error('[launcher] ERROR: '+e.message);void cleanup().then(()=>process.exit(1))});
