import test from 'node:test';import assert from 'node:assert/strict';
import {createRecoveredCreationGate} from './recovered-creation-gate.mjs';import {expectedDraftRequestId} from './correlation-candidate.mjs';
const packageId='tg_'+'a'.repeat(40),revision=9;
const input={requestId:expectedDraftRequestId({packageId,revision,destination:'OPURO'}),destination:'OPURO'};
function fixture(options={}){let calls=0;const c={async beginTransaction(){},async commit(){},async rollback(){},release(){},async execute(sql){calls++;if(sql.startsWith('SELECT b.package_id'))return [options.rows??[{package_id:packageId,revision,state:'READY',current_revision:revision}]];return [options.saved??[]]}};return {gate:createRecoveredCreationGate({pool:{getConnection:async()=>c},readDecision:async()=>options.decision??{action:'CREATE',destination:'OPURO'}}),calls:()=>calls}}
test('ordinary and historical requests retain their existing downstream guard',async()=>{const f=fixture();assert.equal(await f.gate(input),true);assert.equal(await f.gate({requestId:'other-legacy-request'}),true);assert.equal(f.calls(),2);assert.equal(await fixture({rows:[]}).gate(input),true)});
test('an UPDATE decision cannot enter any creation, media or publication writer',async()=>{assert.equal(await fixture({saved:[{decision_json:'{"action":"UPDATE"}'}]}).gate(input),false)});
test('a recovered creation is limited to the exact confirmed destination label',async()=>{
 const f=fixture({saved:[{decision_json:'{"action":"CREATE"}'}]});assert.equal(await f.gate(input),true);assert.equal(await f.gate({...input,destination:'LIBERAL'}),false);assert.equal(await f.gate({...input,requestId:expectedDraftRequestId({packageId,revision,destination:'TODOS'})}),false);
});
test('stale, malformed, ambiguous or unconfirmed decisions fail closed',async()=>{
 for(const options of [{rows:[{package_id:packageId,revision,state:'OPEN',current_revision:revision+1}]},{saved:[{decision_json:'bad'}]},{saved:[{decision_json:'{}'}]},{saved:[{decision_json:'{"action":"CREATE"}'}],decision:{action:'UPDATE',destination:'OPURO'}},{saved:[{decision_json:'{}'},{decision_json:'{}'}]}])assert.equal(await fixture(options).gate(input),false);
});
