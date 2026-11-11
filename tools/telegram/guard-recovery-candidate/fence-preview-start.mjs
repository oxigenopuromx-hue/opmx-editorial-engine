import mysql from 'mysql2/promise';
import {createGuard} from '../../mcp-publisher/guard-server.mjs';
import {beginTargetWrite} from '../../mcp-publisher/target-progress.mjs';
import {beginMediaUpload} from '../../mcp-publisher/media-progress.mjs';
import {createTelegramPackageStore} from '../package-store.mjs';
import {createMcpEventStore} from '../event-store.mjs';
import * as delivery from '../event-delivery.mjs';
import {createTelegramReviewStore} from '../review-store.mjs';
import {prepareCutoverFence} from './fence-cutover-wiring.mjs';
import {preparePreviewIntegration} from './preview-integration.mjs';
import {preparePreviewServices} from './preview-services.mjs';
import {createRuntimeObserver} from './runtime-observation-client.mjs';

// Synchronous module evaluation is required by LiteSpeed's require() loader.
// Initializers may fail independently; a failed fence never restores the old
// unguarded write implementation. Existing reads and event registration remain
// available while all write claims and sealing await the durable migration.
const {OPMX_GUARD_SECRET,OPMX_DB_USER,OPMX_DB_PASSWORD,OPMX_DB_NAME,OPMX_TELEGRAM_SHARED_OPERATORS,OPMX_PREVIEW_SUBSCRIPTION_ID,PORT}=process.env;
if(!OPMX_DB_USER||!OPMX_DB_PASSWORD||!OPMX_DB_NAME)throw Error('Base no configurada');
const pool=mysql.createPool({host:'127.0.0.1',port:3306,user:OPMX_DB_USER,password:OPMX_DB_PASSWORD,database:OPMX_DB_NAME,connectionLimit:4,connectTimeout:5000});
let sharedOperators=null;
if(OPMX_TELEGRAM_SHARED_OPERATORS){try{sharedOperators=JSON.parse(OPMX_TELEGRAM_SHARED_OPERATORS)}catch{throw Error('Invalid shared event configuration')}}
const readyEvents=createMcpEventStore({pool,guardSecret:OPMX_GUARD_SECRET,logger:console.error,sharedOperators});
const fenceReady=prepareCutoverFence({pool,legacyTargetBegin:beginTargetWrite,legacyMediaBegin:beginMediaUpload}).catch(()=>{console.error('guard.fence: initialization_failed');return null});
const requireFence=async()=>{const fence=await fenceReady;if(!fence)throw Error('FENCE_UNAVAILABLE');return fence};
const servicesReady=preparePreviewServices({pool,adminUserIds:sharedOperators?.subscriber?[sharedOperators.subscriber]:[]}).catch(()=>{console.error('guard.preview_services: initialization_failed');return null});
const requirePreviewServices=async()=>{const services=await servicesReady;if(!services)throw Error('PREVIEW_SERVICES_UNAVAILABLE');return services};
// Only a configured, authenticated subscription receives work, and only after
// the preview services have initialized. Their readers still require a valid
// independently reconciled snapshot, editor lease and exact OPEN revision.
const previewReady=servicesReady.then(services=>preparePreviewIntegration({pool,guardSecret:OPMX_GUARD_SECRET,readyEvents,delivery,sharedOperators,allowedSubscriptionId:services?(OPMX_PREVIEW_SUBSCRIPTION_ID??null):null})).catch(()=>{console.error('guard.preview: initialization_failed');return null});
let previewIntegration=null,closed=false;
const telegramEvents={
 initialize:(...args)=>readyEvents.initialize(...args),
 enqueue:(...args)=>readyEvents.enqueue(...args),
 async run(action,input){if(input?.params?.name!=='opmx.package.preview')return readyEvents.run(action,input);const preview=await previewReady;return preview?preview.telegramEvents.run(action,input):{rpcError:{code:-32603,message:'Preview event unavailable'}}},
 start(){readyEvents.start();previewReady.then(x=>{previewIntegration=x;if(x&&!closed)x.telegramEvents.start()})},
 stop(){closed=true;if(previewIntegration)previewIntegration.telegramEvents.stop();else readyEvents.stop()}
};
const store=createTelegramPackageStore(pool,{events:telegramEvents,initializePublicationFence:async(...args)=>(await requireFence()).initializePublicationFence(...args)});
const telegramStore={capabilities:(...args)=>store.capabilities(...args),async run(action,input){if(action==='seal')await requireFence();return store.run(action,input)}};
const server=createGuard({pool,secret:OPMX_GUARD_SECRET,runtimeObserver:createRuntimeObserver({secret:OPMX_GUARD_SECRET}),telegramStore,telegramEvents,telegramReviews:createTelegramReviewStore(pool),
 targetBegin:async(...args)=>(await requireFence()).targetBegin(...args),
 mediaBegin:async(...args)=>(await requireFence()).mediaBegin(...args),
 telegramPublicationBegin:async(...args)=>(await requireFence()).telegramPublicationBegin(...args),
 telegramPreviewPayloads:{stage:async(...args)=>(await requirePreviewServices()).telegramPreviewPayloads.stage(...args),context:async(...args)=>(await requirePreviewServices()).telegramPreviewPayloads.context(...args)},
 telegramPreviewMaterializer:async(...args)=>(await requirePreviewServices()).telegramPreviewMaterializer(...args),
 telegramPreviewDelivery:Object.fromEntries(['initialize','claim','report'].map(method=>[method,async(...args)=>(await requirePreviewServices()).telegramPreviewDelivery[method](...args)]))
});
server.requestTimeout=60000;server.headersTimeout=10000;
server.listen(Number(PORT)||3000,'0.0.0.0');
telegramEvents.start();server.on('close',()=>telegramEvents.stop());
