// Characterization test: run only against the known historic store. The module
// is supplied by the caller, which must first verify its SHA against the host.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

test('historical seal can transition a cancelled package and enqueue it', async () => {
  const modulePath = process.env.OPMX_AUDIT_PACKAGE_STORE;
  assert.ok(modulePath, 'Set OPMX_AUDIT_PACKAGE_STORE to the audited file');
  const {createTelegramPackageStore}=await import(pathToFileURL(modulePath));
  const calls=[];
  const connection={
    async beginTransaction(){}, async commit(){}, async rollback(){}, release(){},
    async execute(sql,args=[]){
      calls.push({sql,args});
      if(sql.startsWith('CREATE TABLE')||sql.startsWith('INSERT IGNORE'))return [[]];
      if(sql.includes('SELECT used_bytes,package_count'))return [[{used_bytes:1,package_count:1}]];
      if(sql.startsWith('SELECT * FROM opmx_tg_packages'))return [[{package_id:args[0],state:'CANCELLED',revision:25,item_count:1}]];
      if(sql.startsWith('SELECT COUNT(*) AS total'))return [[{total:1,pending:0,stored:1}]];
      if(sql.startsWith('UPDATE opmx_tg_packages')||sql.startsWith('DELETE FROM opmx_tg_sessions'))return [{affectedRows:1}];
      throw Error('Unexpected query: '+sql);
    }
  };
  const events={async initialize(){}, async enqueue(_c,event){calls.push({event});}};
  const store=createTelegramPackageStore({async getConnection(){return connection;}},{events});
  const result=await store.run('seal',{owner:'123',chat:'123',packageId:'tg_'+'a'.repeat(40)});
  assert.equal(result.status,'READY');
  assert.equal(result.revision,26);
  assert.ok(calls.some(x=>x.event?.revision===26));
});
