import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const launch=read('./dual-launch.mjs');
const scripts=JSON.parse(read('../package.json')).scripts;
const compose=read('../docker-compose.yml');
const web=read('../apps/web/next.config.ts');
test('old local start stays unchanged and both public commands exist',()=>{
 assert.match(scripts.dev,/concurrently/);
 assert.equal(scripts['dev:both'],'node tools/dual-launch.mjs both');
 assert.equal(scripts['dev:public'],'node tools/dual-launch.mjs ops-public');
});
test('independent ports and same-origin API proxies',()=>{
 for(const port of ['3000','3001','4000','4001'])assert.ok(launch.includes(port));
 assert.match(launch,/INTERNAL_API_ORIGIN:jyURL/);
 assert.match(web,/INTERNAL_API_ORIGIN/);
 assert.match(launch,/https:\/\/'\+domain/);
 assert.match(launch,/cloudflared/);
});
test('launch preserves database volumes and forbids unexpected paid AI',()=>{
 assert.match(compose,/opspilot-postgres-data/);
 assert.match(compose,/opspilot-redis-data/);
 assert.match(launch,/AI_MODE==='paid_openai'/);
 assert.doesNotMatch(launch,/compose.+down|-v\b|migrate reset|db push|npm install|git pull/);
 assert.match(launch,/db:deploy/);
 assert.match(launch,/db:migrate/);
});
