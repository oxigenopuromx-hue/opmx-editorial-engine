import test from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';
import {createGuard} from './deployed-guard/guard-server.mjs';
test('preview diagnostics authenticate first, validate scope and select no callback secrets',async()=>{
 const secret='a'.repeat(64),queries=[];
 const pool={async getConnection(){return {release(){},async execute(sql,args){queries.push(sql);assert.match(sql,/^SELECT /);assert.doesNotMatch(sql,/secret|payload|token|owner_key/);return [[]]}}}};
 const server=createGuard({pool,secret});server.listen(0,'127.0.0.1');await once(server,'listening');
 const url=`http://127.0.0.1:${server.address().port}/v1/telegram/previews/diagnostic`;
 const post=(body,auth=true)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${secret}`}:{})},body:JSON.stringify(body)});
 try{assert.equal((await post({},false)).status,401);assert.equal(queries.length,0);assert.equal((await post({})).status,400);assert.equal(queries.length,0);const r=await post({packageId:'tg_'+'a'.repeat(40)});assert.equal(r.status,200);const j=await r.json();assert.equal(j.status,'PREVIEW_DIAGNOSTIC');assert.deepEqual(j.generation,[]);assert.equal(queries.length,3)}finally{server.close();server.closeAllConnections();await once(server,'close')}
});
