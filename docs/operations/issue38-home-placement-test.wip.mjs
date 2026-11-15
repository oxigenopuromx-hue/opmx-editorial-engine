import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createHomePlacementStore,readHomePlacementForRequestInTransaction} from './source/tools/telegram/guard-recovery-candidate/home-placement-store.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const actor='123', owner=hash(`opmx:telegram:v1:${actor}:${actor}`), pkg='tg_'+'a'.repeat(40);
for (const choice of [true,false,null]) {
 let inserted;
 const c={async beginTransaction(){},async rollback(){},async commit(){},release(){},async execute(sql,args){
 if(sql.includes('FROM opmx_tg_quota_v1'))return [[{id:1}]];
 if(sql.includes('FROM opmx_tg_packages_v1'))return [[{owner_key:owner,state:'OPEN',revision:5}]];
 if(sql.includes('FROM opmx_tg_recovery_leases_v1'))return [[{actor_key:owner,owner_key:owner,receipt_id:'telegram-123-1-100',opening_revision:4}]];
 if(sql.includes('FROM opmx_tg_sessions_v1'))return [[{package_id:pkg}]];
 if(sql.startsWith('SELECT')&&/opmx_tg_(home_placements_v1|editorial_placements_v1|correction_selections_v2)/.test(sql))return [[]];
 if(sql.startsWith('INSERT INTO opmx_tg_home_placements_v1')){inserted=args;return [{}]}
 if(sql.startsWith('UPDATE opmx_tg_packages_v1'))return [{affectedRows:1}];
 throw Error(sql)
 }};
 const s=createHomePlacementStore({pool:{getConnection:async()=>c}});
 const result=await s.select({chat:actor,owner:actor,packageId:pkg,revision:5,receiptId:'telegram-123-2-101',choice});
 assert.equal(result.status,'HOME_PLACEMENT_SELECTED');assert.equal(result.choice,choice);assert.equal(inserted[8],JSON.stringify(choice));
 await assert.rejects(()=>s.select({chat:actor,owner:actor,packageId:pkg,revision:5,receiptId:'telegram-123-2-102',choice:'false'}));
}
const c={execute:async()=>{throw Error('unexpected DB call')}};
assert.equal((await readHomePlacementForRequestInTransaction(c,{requestId:'abcdefghijklmnop',choice:null})).status,'HOME_PLACEMENT_UNCHANGED');
assert.equal((await readHomePlacementForRequestInTransaction(c,{requestId:'abcdefghijklmnop',choice:true})).status,'HOME_PLACEMENT_UNCONFIRMED');
console.log('Guard WIP: selección true, false y preservar; rechazo de tipo y prueba sin autoridad superados');
