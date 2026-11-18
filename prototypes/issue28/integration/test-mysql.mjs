import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import mysql from 'mysql2/promise';
import {createDuplicateCancellation,cancellationSchema} from './duplicate-cancellation.mjs';
const pool=mysql.createPool({host:'127.0.0.1',port:3306,user:'root',password:'testroot',database:'issue28_test',connectionLimit:8});
const h=x=>createHash('sha256').update(x).digest('hex'),actor=h('opmx:telegram:v1:111:111');
const ddl=[
 'CREATE TABLE opmx_tg_quota_v1 (id INT PRIMARY KEY) ENGINE=InnoDB',
 'CREATE TABLE opmx_tg_packages_v1 (package_id VARCHAR(43) PRIMARY KEY, owner_key CHAR(64), state VARCHAR(16), revision INT UNSIGNED, updated_at DATETIME(6)) ENGINE=InnoDB',
 'CREATE TABLE opmx_tg_sessions_v1 (owner_key CHAR(64) PRIMARY KEY, package_id VARCHAR(43)) ENGINE=InnoDB',
 'CREATE TABLE opmx_tg_recovery_leases_v1 (package_id VARCHAR(43) PRIMARY KEY, actor_key CHAR(64), owner_key CHAR(64), receipt_id VARCHAR(128), opening_revision INT UNSIGNED) ENGINE=InnoDB',
 'CREATE TABLE opmx_tg_publication_fence_v1 (package_id VARCHAR(43), revision INT UNSIGNED, state VARCHAR(32), PRIMARY KEY(package_id,revision)) ENGINE=InnoDB',
 'CREATE TABLE opmx_tg_motor_attempts_v1 (package_id VARCHAR(43), revision INT UNSIGNED, state VARCHAR(32), PRIMARY KEY(package_id,revision)) ENGINE=InnoDB',
 'CREATE TABLE opmx_tg_items_v1 (item_id VARCHAR(43) PRIMARY KEY,package_id VARCHAR(43),state VARCHAR(16),text_content TEXT, INDEX(package_id)) ENGINE=InnoDB',
 'CREATE TABLE opmx_tg_events_v1 (package_id VARCHAR(43),revision INT UNSIGNED,PRIMARY KEY(package_id,revision)) ENGINE=InnoDB',
 'CREATE TABLE opmx_tg_preview_generation_v1 (package_id VARCHAR(43),revision INT UNSIGNED,PRIMARY KEY(package_id,revision)) ENGINE=InnoDB',
 cancellationSchema
];
try {
 for(const sql of ddl)await pool.execute(sql);
 await pool.execute('INSERT INTO opmx_tg_quota_v1 VALUES (1)');
 const cancel=createDuplicateCancellation({pool});
 const request=(id,receipt=301)=>({owner:'111',chat:'111',packageId:id,revision:9,receiptId:`telegram-111-${receipt}-${receipt}`});
 async function setup(ch){const id='tg_'+ch.repeat(40);await pool.execute("INSERT INTO opmx_tg_packages_v1 VALUES (?,?,'OPEN',9,UTC_TIMESTAMP(6))",[id,actor]);await pool.execute('INSERT INTO opmx_tg_sessions_v1 VALUES (?,?)',[actor,id]);await pool.execute('INSERT INTO opmx_tg_recovery_leases_v1 VALUES (?,?,?,?,9)',[id,actor,actor,'telegram-111-300-300']);await pool.execute("INSERT INTO opmx_tg_publication_fence_v1 VALUES (?,8,'RECOVERY_FENCED')",[id]);await pool.execute("INSERT INTO opmx_tg_motor_attempts_v1 VALUES (?,8,'REVOKED')",[id]);await pool.execute("INSERT INTO opmx_tg_items_v1 VALUES (?,?,'STORED','material original')",['ti_'+ch.repeat(40),id]);return id}
 async function clearSession(){await pool.execute('DELETE FROM opmx_tg_sessions_v1')}
 let id=await setup('a');let result=await cancel(request(id));assert.equal(result.status,'CANCELLED');
 const [[p]]=await pool.execute('SELECT state,revision FROM opmx_tg_packages_v1 WHERE package_id=?',[id]);assert.deepEqual([p.state,p.revision],['CANCELLED',9]);
 const [[i]]=await pool.execute('SELECT text_content FROM opmx_tg_items_v1 WHERE package_id=?',[id]);assert.equal(i.text_content,'material original');
 const [sessions]=await pool.execute('SELECT * FROM opmx_tg_sessions_v1 WHERE owner_key=?',[actor]);assert.equal(sessions.length,0);
 const [leases]=await pool.execute('SELECT * FROM opmx_tg_recovery_leases_v1 WHERE package_id=?',[id]);assert.equal(leases.length,0);
 assert.equal((await cancel(request(id))).status,'CANCELLED_REPLAY');assert.equal((await cancel(request(id,302))).status,'CANCELLATION_CONFLICT');
 id=await setup('b');await pool.execute("INSERT INTO opmx_tg_items_v1 VALUES (?,?,'PENDING','')",['ti_'+'c'.repeat(40),id]);assert.equal((await cancel(request(id,303))).status,'PENDING_RESERVATION');const [[p2]]=await pool.execute('SELECT state FROM opmx_tg_packages_v1 WHERE package_id=?',[id]);assert.equal(p2.state,'OPEN');await clearSession();
 id=await setup('d');const [r1,r2]=await Promise.all([cancel(request(id,304)),cancel(request(id,305))]);assert.deepEqual([r1.status,r2.status].sort(),['CANCELLATION_CONFLICT','CANCELLED'].sort());
 const [[audit]]=await pool.execute('SELECT COUNT(*) AS n FROM opmx_tg_duplicate_cancellations_v1 WHERE package_id=?',[id]);assert.equal(audit.n,1);
 async function writer(packageId){const c=await pool.getConnection();try{await c.beginTransaction();await c.execute('SELECT id FROM opmx_tg_quota_v1 WHERE id=1 FOR UPDATE');const [rows]=await c.execute('SELECT state FROM opmx_tg_packages_v1 WHERE package_id=? FOR UPDATE',[packageId]);let emitted=false;if(rows[0]?.state==='OPEN'){await c.execute('INSERT INTO opmx_tg_events_v1 VALUES (?,9)',[packageId]);emitted=true}await c.commit();return emitted}catch(e){await c.rollback();throw e}finally{c.release()}}
 for(let n=0;n<8;n++){await clearSession();const raceId=await setup(String(n));const receipt=request(raceId,400+n);const ops=n%2?[writer(raceId),cancel(receipt)]:[cancel(receipt),writer(raceId)];const values=await Promise.all(ops);const emitted=n%2?values[0]:values[1];const cancellation=n%2?values[1]:values[0];assert.ok(!(emitted&&cancellation.status==='CANCELLED'));assert.equal(cancellation.status,emitted?'RECONCILIATION_REQUIRED':'CANCELLED')}
 console.log('PASS MySQL: materiales, sesión, replay, reservas, cancelaciones simultáneas y carrera con emisor simulado');
}finally{await pool.end()}
