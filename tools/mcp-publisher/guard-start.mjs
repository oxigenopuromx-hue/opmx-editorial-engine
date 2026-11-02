import mysql from 'mysql2/promise';
import {createGuard} from './guard-server.mjs';
import {createTelegramPackageStore} from '../telegram/package-store.mjs';
import {createMcpEventStore} from '../telegram/event-store.mjs';
import {createTelegramReviewStore} from '../telegram/review-store.mjs';

// In Hostinger this must be a local DB socket/host on the same hosting account.
const {OPMX_GUARD_SECRET,OPMX_DB_USER,OPMX_DB_PASSWORD,OPMX_DB_NAME,PORT}=process.env;
if(!OPMX_DB_USER||!OPMX_DB_PASSWORD||!OPMX_DB_NAME) throw new Error('Base no configurada');
const pool=mysql.createPool({host:'127.0.0.1',port:3306,user:OPMX_DB_USER,password:OPMX_DB_PASSWORD,database:OPMX_DB_NAME,connectionLimit:4,connectTimeout:5000});
const telegramEvents=createMcpEventStore({pool,guardSecret:OPMX_GUARD_SECRET,logger:console.error});
const server=createGuard({pool,secret:OPMX_GUARD_SECRET,telegramStore:createTelegramPackageStore(pool,{events:telegramEvents}),telegramEvents,telegramReviews:createTelegramReviewStore(pool)});
server.requestTimeout=60000;server.headersTimeout=10000;
server.listen(Number(PORT)||3000,'0.0.0.0');
telegramEvents.start();server.on('close',()=>telegramEvents.stop());
