import test from 'node:test';import assert from 'node:assert/strict';
import {createMcpEventStore,readyEvent,deliveryOutcome,sharedEventOwners,subscriptionOwnersForEvent,mayDeliverEvent} from './event-store.mjs';import {subscriptionCipher} from './event-delivery.mjs';
import {createTelegramPackageStore} from './package-store.mjs';
const who={owner:'1001',chat:'1001'},pkg='tg_'+'a'.repeat(40),secret='f'.repeat(64),signing='whsec_'+Buffer.alloc(32,77).toString('base64');
const input={...who,params:{name:'opmx.package.ready',arguments:{queue_id:'telegram-editorial'},delivery:{mode:'webhook',url:'https://callbacks.chatgpt.com/test',secret:signing}}};
function fixture(){const q=[];let prior=null;const c={release(){},async beginTransaction(){q.push(['BEGIN']);},async commit(){q.push(['COMMIT']);},async rollback(){q.push(['ROLLBACK']);},async execute(sql,args=[]){q.push([sql,args]);if(sql.startsWith('CREATE'))return [{}];if(sql.startsWith('SELECT package_id'))return [[{package_id:pkg}]];if(sql.startsWith('SELECT secret_envelope'))return [prior?[{secret_envelope:prior}]:[]];if(sql.startsWith('SELECT COUNT'))return [[{total:prior?1:0,active:prior?1:0}]];if(sql.startsWith('INSERT INTO opmx_tg_subscriptions')){prior=args[2];return [{affectedRows:1}];}if(sql.startsWith('UPDATE'))return [{affectedRows:1}];throw Error('Unexpected SQL');}};return {q,c,pool:{async getConnection(){return c;}},prior:()=>prior};}
test('subscribe challenges once, refreshes finite grant, encrypts persisted secret and survives new store instance',async()=>{
 const f=fixture();let time=1000000,challenges=0;const post=async(u,h,b)=>{challenges++;return {status:200,json:{challenge:JSON.parse(b).challenge}};};
 const make=()=>createMcpEventStore({pool:f.pool,guardSecret:secret,post,now:()=>time});const a=await make().run('subscribe',input);assert.match(a.id,/^sub_/);assert.equal(challenges,1);assert.equal(f.prior().includes(signing),false);
 const b=await make().run('subscribe',input);assert.equal(a.id,b.id);assert.equal(challenges,1);time+=300001;await make().run('subscribe',input);assert.equal(challenges,2);await make().run('subscribe',input);assert.equal(challenges,2);
 assert.equal(Date.parse(a.refreshBefore)-1000000,86400000);const short=await make().run('subscribe',{...input,params:{...input.params,ttlMs:1}});assert.equal(Date.parse(short.refreshBefore)-time,60000);
 const unsub={...who,params:{...input.params,delivery:{mode:'webhook',url:input.params.delivery.url}}};assert.deepEqual(await make().run('unsubscribe',unsub),{});assert.deepEqual(await make().run('unsubscribe',unsub),{});
});
test('failed challenge or unauthorized filter persists no subscription',async()=>{
 const f=fixture(),s=createMcpEventStore({pool:f.pool,guardSecret:secret,post:async()=>({status:200,json:{challenge:'wrong'}})});
 assert.equal((await s.run('subscribe',input)).rpcError.code,-32015);assert.equal(f.prior(),null);
 const count=f.q.length;assert.equal((await s.run('subscribe',{...input,owner:'2002'})).rpcError.code,-32602);assert.equal(f.q.length,count);
});
test('stable event payload contains no source or execution instructions; retry bounds and terminal responses',()=>{
 const a=readyEvent('hash',pkg,7,3,'2026-11-02T00:00:00Z'),b=readyEvent('hash',pkg,7,3,'2026-11-02T00:00:01Z');assert.equal(a.eventId,b.eventId);assert.notEqual(a.eventId,readyEvent('hash',pkg,8,3,a.timestamp).eventId);assert.deepEqual(Object.keys(a.data),['queue_id','package_id','revision','state','item_count']);
 assert.equal(deliveryOutcome(200,1,0).state,'SENT');for(const status of [400,401,403,404,410,413])assert.equal(deliveryOutcome(status,1,0).state,'FAILED');assert.equal(deliveryOutcome(503,8,0).state,'FAILED');assert.equal(deliveryOutcome(429,1,1000,'30').next,31000);assert.equal(deliveryOutcome(503,1,0).state,'RETRY');
});
test('seal and outbox share one transaction; failed enqueue rolls back READY; replay emits nothing',async()=>{
 for(const fail of [false,true]){const seen=[];let tx=false;const c={release(){},async beginTransaction(){tx=true;seen.push('BEGIN');},async commit(){seen.push('COMMIT');tx=false;},async rollback(){seen.push('ROLLBACK');tx=false;},async execute(sql){seen.push(sql);if(sql.startsWith('CREATE')||sql.startsWith('INSERT IGNORE'))return [{}];if(sql.includes('FROM opmx_tg_quota'))return [[{used_bytes:1,package_count:1}]];if(sql.includes('FROM opmx_tg_packages'))return [[{package_id:pkg,state:'OPEN',revision:6}]];if(sql.includes('FROM opmx_tg_items'))return [[{total:4,pending:0,stored:3}]];return [{affectedRows:1}];}};
 const events={async initialize(){assert.equal(tx,false);},async enqueue(conn,e){assert.equal(conn,c);assert.equal(tx,true);assert.equal(e.itemCount,3);assert.equal(e.revision,7);seen.push('ENQUEUE');if(fail)throw Error('DB');}};
 const s=createTelegramPackageStore({async getConnection(){return c;}},{events});if(fail){await assert.rejects(s.run('seal',{...who,packageId:pkg}));assert.equal(seen.at(-1),'ROLLBACK');}else{assert.equal((await s.run('seal',{...who,packageId:pkg})).status,'READY');assert.ok(seen.indexOf('ENQUEUE')<seen.indexOf('COMMIT'));}}
});
test('worker checks active subscription and READY ownership before sending; fencing prevents stale report and stale stop',async()=>{
 const owner='ownerhash',sub='sub_'+'b'.repeat(48),event=readyEvent(owner,pkg,7,3,'2026-11-02T00:00:00Z'),envelope=subscriptionCipher(secret).encrypt({id:sub,url:input.params.delivery.url,secret:signing},owner+':'+sub);
 for(const visible of [false,true]){let sent=0;const q=[],c={release(){},async beginTransaction(){},async commit(){},async rollback(){},async execute(sql,args=[]){q.push([sql,args]);if(sql.startsWith('CREATE')||sql.startsWith('UPDATE'))return [{affectedRows:0}];if(sql.startsWith('SELECT delivery_key'))return [[{delivery_key:'d',subscription_id:sub,event_id:event.eventId,attempts:0}]];if(sql.startsWith('SELECT s.secret_envelope'))return [visible?[{owner_key:owner,event_owner:owner,secret_envelope:envelope,payload_json:JSON.stringify(event)}]:[]];throw Error('Unexpected SQL');}};
 const s=createMcpEventStore({pool:{async getConnection(){return c;}},guardSecret:secret,post:async()=>{sent++;return {status:410};}});assert.equal(await s.deliverOne(),true);assert.equal(sent,visible?1:0);assert.equal(q.some(([sql])=>sql.startsWith('UPDATE opmx_tg_subscriptions')),false);assert.ok(q.some(([sql])=>sql.includes("p.state='READY'")));assert.ok(q.some(([sql])=>sql.includes("claim_token=? AND state='LEASED'")));}
});
test('shared delivery allows only configured operators and preserves direct subscriptions',()=>{
 const shared=sharedEventOwners({subscriber:'1001',operators:['1001','2002']});
 const other=sharedEventOwners({subscriber:'3003',operators:['3003']}).subscriber;
 const [one,two]=[...shared.operators];
 assert.equal(shared.subscriber,one);
 assert.deepEqual(subscriptionOwnersForEvent(two,shared),[two,one]);
 assert.deepEqual(subscriptionOwnersForEvent(one,shared),[one]);
 assert.deepEqual(subscriptionOwnersForEvent(other,shared),[other]);
 assert.equal(mayDeliverEvent(one,two,shared),true);
 assert.equal(mayDeliverEvent(other,two,shared),false);
 assert.equal(mayDeliverEvent(one,other,shared),false);
 assert.equal(mayDeliverEvent(two,two,null),true);
 assert.equal(mayDeliverEvent(one,two,null),false);
 assert.throws(()=>sharedEventOwners({subscriber:'1001',operators:['not-an-id']}));
});
test('worker delivers shared event only to subscriber authorized for its operator',async()=>{
 const shared=sharedEventOwners({subscriber:'1001',operators:['2002']});
 const subowner=shared.subscriber,operator=[...shared.operators][0],foreign=sharedEventOwners({subscriber:'3003',operators:['3003']}).subscriber;
 const sub='sub_'+'c'.repeat(48),event=readyEvent(operator,pkg,7,3,'2026-11-02T00:00:00Z');
 const envelope=subscriptionCipher(secret).encrypt({id:sub,url:input.params.delivery.url,secret:signing},subowner+':'+sub);
 for(const eventOwner of [operator,foreign]){
  let sent=0;const c={release(){},async beginTransaction(){},async commit(){},async rollback(){},async execute(sql){
   if(sql.startsWith('CREATE'))return [{}];if(sql.startsWith('UPDATE'))return [{affectedRows:1}];
   if(sql.startsWith('SELECT delivery_key'))return [[{delivery_key:'d',subscription_id:sub,event_id:event.eventId,attempts:0}]];
   if(sql.startsWith('SELECT s.secret_envelope'))return [[{owner_key:subowner,event_owner:eventOwner,secret_envelope:envelope,payload_json:JSON.stringify(event)}]];
   throw Error('Unexpected SQL');
  }};
  const s=createMcpEventStore({pool:{async getConnection(){return c;}},guardSecret:secret,sharedOperators:{subscriber:'1001',operators:['2002']},post:async()=>{sent++;return {status:200};}});
  assert.equal(await s.deliverOne(),true);assert.equal(sent,eventOwner===operator?1:0);
 }
});
test('enqueue targets matching private subscriber and configured shared subscriber exactly once',async()=>{
 const shared=sharedEventOwners({subscriber:'1001',operators:['1001','2002']});
 const operator=[...shared.operators][1];const writes=[];
 const conn={async execute(sql,args){writes.push({sql,args});return [{affectedRows:1}];}};
 const s=createMcpEventStore({pool:{},guardSecret:secret,sharedOperators:{subscriber:'1001',operators:['1001','2002']}});
 await s.enqueue(conn,{owner:operator,packageId:pkg,revision:7,itemCount:2,timestamp:'2026-11-02T00:00:00Z'});
 const deliveries=writes.filter(x=>x.sql.includes('INSERT IGNORE INTO opmx_tg_deliveries_v1'));
 assert.deepEqual(deliveries.map(x=>x.args[2]),[operator,shared.subscriber]);
 assert.equal(writes.filter(x=>x.sql.includes('INSERT IGNORE INTO opmx_tg_events_v1')).length,1);
});
