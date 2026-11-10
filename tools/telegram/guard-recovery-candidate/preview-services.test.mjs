import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePreviewServices} from './preview-services.mjs';
const input={owner:'255516723',chat:'255516723',packageId:'tg_'+'b'.repeat(40),revision:9};
function database(){const sql=[];const c={async execute(q){sql.push(q);return [q.startsWith('SELECT id FROM opmx_tg_quota')?[{id:1}]:[]]},async beginTransaction(){sql.push('BEGIN')},async commit(){sql.push('COMMIT')},async rollback(){sql.push('ROLLBACK')},release(){sql.push('RELEASE')}};return {sql,pool:{async getConnection(){return c}}}}
test('preview composition installs schemas outside a transaction and exposes no confirmation or CMS writer',async()=>{
 const {sql,pool}=database(),services=await preparePreviewServices({pool,adminUserIds:['255516723']});
 assert.equal(sql.filter(q=>q.startsWith('CREATE TABLE')).length,9);
 assert.equal(sql.includes('BEGIN'),false);
 assert.deepEqual(Object.keys(services).sort(),['telegramPreviewDelivery','telegramPreviewMaterializer','telegramPreviewPayloads']);
 assert.deepEqual(Object.keys(services.telegramPreviewPayloads).sort(),['context','stage']);
 assert.equal(Object.isFrozen(services),true);
});
test('missing trusted recovery state never stages, materializes or delivers a proposal',async()=>{
 const {sql,pool}=database(),s=await preparePreviewServices({pool});sql.length=0;
 assert.deepEqual(await s.telegramPreviewPayloads.context(input),{status:'NOT_AVAILABLE'});
 assert.deepEqual(await s.telegramPreviewPayloads.stage({...input,destination:'OPURO',payload:{title:'QA'}}),{status:'NOT_AVAILABLE'});
 assert.deepEqual(await s.telegramPreviewMaterializer(input),{status:'PREVIEW_NOT_READY'});
 assert.equal(sql.some(q=>/^(INSERT|UPDATE|DELETE)/.test(q)),false);
});
test('a failed schema initialization does not return a partially enabled service',async()=>{
 let released=false;await assert.rejects(preparePreviewServices({pool:{async getConnection(){return {async execute(){throw Error('DDL_FAILED')},release(){released=true}}}}}),/DDL_FAILED/);assert.equal(released,true);
});
