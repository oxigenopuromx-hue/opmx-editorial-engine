import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chooseMotorPolicy} from './motor-policy-v3-update.mjs';
import {attestedControl} from './versioned-telegram-policy.mjs';
const pkg='tg_'+'a'.repeat(40), sha=x=>createHash('sha256').update(x).digest('hex');
function fixture(policy,command){
 const texts=[attestedControl('/nuevo',pkg,1,2,policy),'Fuente editorial',...(command?[attestedControl(command,pkg,3,undefined,policy)]:[]),attestedControl('/listo',pkg,4,undefined,policy)];
 const sources=texts.map((x,i)=>({item_id:'ti_'+String(i+1).padStart(40,'0'),stream:'text',bytes:Buffer.from(x)}));
 const items=sources.map(s=>({item_id:s.item_id,kind:'TEXT',state:'STORED',text_bytes:s.bytes.length,sha256:sha(s.bytes)}));
 return {sources,inventory:{status:'PACKAGE_FOUND',package_id:pkg,revision:1,state:'READY',items}};
}
function select(x){return chooseMotorPolicy(x.inventory,x.sources,{packageId:pkg,revision:x.inventory.revision})}
test('new default is AMBOS, with explicit TODOS and HORIZONTE still available',()=>{
 for(const [cmd,destination] of [[null,'AMBOS'],['/publicar todos','TODOS'],['/publicar horizonte','HORIZONTE'],['/borrador','AMBOS']])assert.equal(select(fixture('publish-ambos-v4',cmd)).destination,destination);
 assert.equal(select(fixture('publish-todos-v3',null)).destination,'TODOS');
});
test('confirmed recovery binds the v4 policy and rejects mixed policies',()=>{
 const x=fixture('publish-ambos-v4',null),prior=select(x),c={package_id:pkg,revision:2,action:'CREATE',destination:'TODOS',policy:'publish-ambos-v4',content_mode:'EDITORIAL',preview_hash:'b'.repeat(64)};
 x.inventory={...x.inventory,revision:2,recovered_policy:prior,confirmed_correction:c};
 const result=select(x);assert.equal(result.destination,'TODOS');assert.deepEqual(result.destinations,['OPURO','OPOL','LIBERAL','HORIZONTE']);
 x.inventory.confirmed_correction={...c,policy:'publish-todos-v3'};assert.throws(()=>select(x),/RECOVERED_POLICY_UNCONFIRMED/);
});
