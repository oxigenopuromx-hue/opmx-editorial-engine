import {test} from 'node:test';
import assert from 'node:assert/strict';
import {beginTargetWrite,recordTargetPost,inspectTargetProgress,progressSchemaSql} from './target-progress.mjs';

const input={requestId:'opmx_request_example_123',slug:'prueba-editorial',destination:'OPURO'};
function fakeDb({reserved=true,fail=false}={}) {
  const rows=new Map();let releases=0;
  return {rows,get releases(){return releases},async getConnection(){return {
    async execute(sql,args){
      if(fail)throw new Error('database disconnected');
      if(sql.startsWith('INSERT')){
        assert.match(sql,/FROM opmx_mcp_targets WHERE target_key=\? AND request_id=\?/);
        const [destination,key,requestId]=args;
        if(!reserved)return [{affectedRows:0}];
        if(rows.has(key))throw Object.assign(new Error('duplicate'),{code:'ER_DUP_ENTRY'});
        rows.set(key,{requestId,destination,status:'writing',post_id:null});return [{affectedRows:1}];
      }
      if(sql.startsWith('UPDATE')){
        const [postId,key,requestId,destination]=args;const row=rows.get(key);
        if(!row||row.requestId!==requestId||row.destination!==destination||row.status!=='writing')return [{affectedRows:0}];
        row.status='reported';row.post_id=postId;return [{affectedRows:1}];
      }
      if(sql.startsWith('SELECT')){const [key,requestId,destination]=args;const row=rows.get(key);return [row&&row.requestId===requestId&&row.destination===destination?[row]:[]]}
      throw new Error('unexpected query');
    },release(){releases++}
  }}};
}

test('reserva un solo inicio y conserva el resultado para revisión',async()=>{
  const db=fakeDb();assert.deepEqual(await beginTargetWrite(db,input),{status:'write_started'});
  assert.deepEqual(await beginTargetWrite(db,input),{status:'already_started',action:'manual_reconciliation'});
  assert.deepEqual(await inspectTargetProgress(db,input),{status:'writing',postId:null,action:'manual_reconciliation'});
  assert.deepEqual(await recordTargetPost(db,{...input,postId:123}),{status:'post_reported',action:'verify_wordpress'});
  assert.deepEqual(await inspectTargetProgress(db,input),{status:'reported',postId:'123',action:'manual_reconciliation'});
  assert.deepEqual(await recordTargetPost(db,{...input,postId:123}),{status:'not_updated',action:'manual_reconciliation'});
  assert.equal(db.releases,6);
});
test('sin reserva no autoriza escritura y no crea avance',async()=>{
 const db=fakeDb({reserved:false});assert.deepEqual(await beginTargetWrite(db,input),{status:'not_reserved',action:'manual_reconciliation'});assert.equal(db.rows.size,0);
});
test('errores y datos inválidos no autorizan reintento',async()=>{
 const db=fakeDb({fail:true});await assert.rejects(beginTargetWrite(db,input),/no confirmado/);
 await assert.rejects(recordTargetPost(db,{...input,postId:123}),/no confirmado/);
 await assert.rejects(inspectTargetProgress(db,input),/no confirmada/);
 await assert.rejects(recordTargetPost(db,{...input,postId:-1}),/inválida/);
 await assert.rejects(beginTargetWrite(db,{...input,destination:'OTHER'}),/inválida/);
});
test('la migración separada exige clave única y motor transaccional',()=>{
 assert.match(progressSchemaSql,/PRIMARY KEY/);assert.match(progressSchemaSql,/InnoDB/);
});

