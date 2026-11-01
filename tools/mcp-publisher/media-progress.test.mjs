import {test} from 'node:test';
import assert from 'node:assert/strict';
import {beginMediaUpload,recordMediaUpload,inspectMediaUpload,mediaSchemaSql} from './media-progress.mjs';

const base={requestId:'opmx_request_example_123',slug:'prueba-editorial',destination:'OPURO'};
function fakeDb({started=true,broken=false}={}) {
  const rows=new Map(); let releases=0;
  return {rows,get releases(){return releases},async getConnection(){return {
    async execute(sql,args) {
      if(broken) throw Error('disconnect');
      if(sql.startsWith('INSERT')) {
        assert.match(sql,/FROM opmx_mcp_target_progress/);
        const [role,key,requestId,destination]=args;
        if(!started)return [{affectedRows:0}];
        const index=key+':'+role;
        if(rows.has(index))throw Object.assign(Error('duplicate'),{code:'ER_DUP_ENTRY'});
        rows.set(index,{requestId,destination,role,status:'uploading',media_id:null});return [{affectedRows:1}];
      }
      if(sql.startsWith('UPDATE')) {
        const [id,key,requestId,role]=args,row=rows.get(key+':'+role);
        if(!row||row.requestId!==requestId||row.status!=='uploading')return [{affectedRows:0}];
        row.status='reported';row.media_id=id;return [{affectedRows:1}];
      }
      if(sql.startsWith('SELECT')) {
        const [key,requestId,role]=args,row=rows.get(key+':'+role);
        return [row&&row.requestId===requestId?[row]:[]];
      }
      throw Error('unexpected');
    },release(){releases++;}
  }}};
}

test('Hero y destacada se registran por separado, sin repetir una carga incierta',async()=>{
  const db=fakeDb(),hero={...base,role:'hero'},featured={...base,role:'featured'};
  assert.deepEqual(await beginMediaUpload(db,hero),{status:'upload_started'});
  assert.deepEqual(await beginMediaUpload(db,featured),{status:'upload_started'});
  assert.deepEqual(await beginMediaUpload(db,hero),{status:'already_started',action:'manual_reconciliation'});
  assert.deepEqual(await inspectMediaUpload(db,hero),{status:'uploading',mediaId:null,action:'manual_reconciliation'});
  assert.deepEqual(await recordMediaUpload(db,{...hero,mediaId:123}),{status:'media_reported',action:'verify_wordpress'});
  assert.deepEqual(await inspectMediaUpload(db,hero),{status:'reported',mediaId:'123',action:'manual_reconciliation'});
  assert.deepEqual(await recordMediaUpload(db,{...hero,mediaId:124}),{status:'not_updated',action:'manual_reconciliation'});
  assert.equal(db.releases,7);
});
test('sin inicio durable de destino no se permite subir medios',async()=>{
  const db=fakeDb({started:false});assert.deepEqual(await beginMediaUpload(db,{...base,role:'hero'}),{status:'not_started',action:'manual_reconciliation'});assert.equal(db.rows.size,0);
});
test('destinos, roles e identificadores inválidos fallan antes de conectar',async()=>{
  let calls=0;const db={async getConnection(){calls++;throw Error('unexpected')}};
  await assert.rejects(beginMediaUpload(db,{...base,destination:'OPOL',role:'hero'}),/inválida/);
  await assert.rejects(recordMediaUpload(db,{...base,role:'hero',mediaId:0}),/inválida/);
  assert.equal(calls,0);
});
test('errores de base no se confunden con éxito y exigen revisión',async()=>{
  const db=fakeDb({broken:true}),hero={...base,role:'hero'};
  await assert.rejects(beginMediaUpload(db,hero),/no confirmado/);
  await assert.rejects(recordMediaUpload(db,{...hero,mediaId:9}),/no confirmado/);
  await assert.rejects(inspectMediaUpload(db,hero),/no confirmada/);
});
test('migración usa clave compuesta por destino y rol en InnoDB',()=>{
  assert.match(mediaSchemaSql,/PRIMARY KEY \(target_key, role\)/);assert.match(mediaSchemaSql,/InnoDB/);
});
