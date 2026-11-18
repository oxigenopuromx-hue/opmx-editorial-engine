import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import {createTelegramPackageStore} from './actual-guard/package-store.mjs';
import {createDuplicateCancellation,cancellationSchema} from './duplicate-cancellation.mjs';
const config={host:'127.0.0.1',port:3306,user:'root',password:'testroot'};
const admin=await mysql.createConnection(config);
await admin.query('CREATE DATABASE issue28_real_store');await admin.end();
const pool=mysql.createPool({...config,database:'issue28_real_store',connectionLimit:8});
const getConnection=pool.getConnection.bind(pool);pool.getConnection=async()=>{const c=await getConnection();const execute=c.execute.bind(c);c.execute=async(sql,args)=>{try{return await execute(sql,args)}catch(e){console.error('ISOLATED_SQL_FAILURE',e.code,e.sqlMessage);throw e}};return c};
try{
 const ddl=[
  'CREATE TABLE opmx_tg_recovery_leases_v1 (package_id VARCHAR(43) PRIMARY KEY,actor_key CHAR(64),owner_key CHAR(64),receipt_id VARCHAR(128),opening_revision INT UNSIGNED) ENGINE=InnoDB',
  'CREATE TABLE opmx_tg_publication_fence_v1 (package_id VARCHAR(43),revision INT UNSIGNED,state VARCHAR(32),PRIMARY KEY(package_id,revision)) ENGINE=InnoDB',
  'CREATE TABLE opmx_tg_motor_attempts_v1 (package_id VARCHAR(43),revision INT UNSIGNED,state VARCHAR(32),PRIMARY KEY(package_id,revision)) ENGINE=InnoDB',
  'CREATE TABLE opmx_tg_events_v1 (package_id VARCHAR(43),revision INT UNSIGNED,PRIMARY KEY(package_id,revision)) ENGINE=InnoDB',
  'CREATE TABLE opmx_tg_preview_generation_v1 (package_id VARCHAR(43),revision INT UNSIGNED,PRIMARY KEY(package_id,revision)) ENGINE=InnoDB',cancellationSchema
 ];
 for(const sql of ddl)await pool.execute(sql);
 const events={async initialize(){},async enqueue(c,{packageId,revision}){await c.execute('INSERT INTO opmx_tg_events_v1 VALUES (?,?)',[packageId,revision]);return 'synthetic-event'}};
 const store=createTelegramPackageStore(pool,{events});const cancel=createDuplicateCancellation({pool});
 const who=n=>({owner:String(n),chat:String(n)}),receipt=(n,m)=>`telegram-${n}-${m}-${m}`;
 async function setup(n){const opened=await store.run('open',{...who(n),receiptId:receipt(n,100)});assert.equal(opened.status,'OPEN');const packageId=opened.packageId;const added=await store.run('reserve',{...who(n),packageId,receiptId:receipt(n,101),kind:'TEXT',text:'Contenido de prueba aislado',attachment:null});assert.equal(added.status,'STORED');return packageId}
 const req=(n,packageId)=>({...who(n),packageId,revision:2,receiptId:receipt(n,102)});
 {
  const n=3001,packageId=await setup(n);const r=await cancel(req(n,packageId));assert.equal(r.status,'CANCELLED');
  assert.equal((await store.run('current',who(n))).status,'NO_OPEN_PACKAGE');
  assert.equal((await store.run('reserve',{...who(n),packageId,receiptId:receipt(n,103),kind:'TEXT',text:'No guardar',attachment:null})).status,'PACKAGE_CLOSED');
  assert.equal((await store.run('seal',{...who(n),packageId})).status,'PACKAGE_CLOSED');
  assert.equal((await cancel(req(n,packageId))).status,'CANCELLED_REPLAY');
  const manifest=await store.run('manifest',{...who(n),packageId});assert.equal(manifest.status,'FOUND');assert.equal(manifest.state,'CANCELLED');assert.equal(manifest.items.length,1);assert.equal(manifest.items[0].text_content,'Contenido de prueba aislado');
  const [eventRows]=await pool.execute('SELECT * FROM opmx_tg_events_v1 WHERE package_id=?',[packageId]);assert.equal(eventRows.length,0);
 }
 for(let n=3100;n<3112;n++){
  const packageId=await setup(n);const funcs=n%2?[()=>store.run('seal',{...who(n),packageId}),()=>cancel(req(n,packageId))]:[()=>cancel(req(n,packageId)),()=>store.run('seal',{...who(n),packageId})];
  const values=await Promise.all(funcs.map(f=>f()));const c=n%2?values[1]:values[0],seal=n%2?values[0]:values[1];
  assert.ok(!(c.status==='CANCELLED'&&seal.status==='READY'));
  assert.ok(['CANCELLED','STALE_REVISION'].includes(c.status));assert.ok(['PACKAGE_CLOSED','READY'].includes(seal.status));
  const [eventsNow]=await pool.execute('SELECT revision FROM opmx_tg_events_v1 WHERE package_id=?',[packageId]);
  const [[state]]=await pool.execute('SELECT state FROM opmx_tg_packages_v1 WHERE package_id=?',[packageId]);
  assert.equal(eventsNow.length,state.state==='READY'?1:0);assert.equal(c.status==='CANCELLED',state.state==='CANCELLED');
 }
 for(let n=3200;n<3212;n++){
  const packageId=await setup(n);const write=()=>store.run('reserve',{...who(n),packageId,receiptId:receipt(n,103),kind:'TEXT',text:'Segundo texto',attachment:null});
  const f=n%2?[write,()=>cancel(req(n,packageId))]:[()=>cancel(req(n,packageId)),write];const v=await Promise.all(f.map(x=>x()));const c=n%2?v[1]:v[0],w=n%2?v[0]:v[1];
  assert.ok(!(c.status==='CANCELLED'&&w.status==='STORED'));assert.ok(['CANCELLED','STALE_REVISION'].includes(c.status));assert.ok(['PACKAGE_CLOSED','STORED'].includes(w.status));
 }
 console.log('PASS MySQL: rutas reales del almacén contra cancelación, sello, escritura posterior y carreras');
}finally{await pool.end()}
