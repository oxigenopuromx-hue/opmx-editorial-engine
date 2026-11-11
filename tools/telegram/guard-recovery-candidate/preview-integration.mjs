import {createMcpPreviewEventStore} from './preview-event-store.mjs';
import {enqueuePreviewGeneration,createPreviewGenerationDispatcher,previewGenerationSchema} from './preview-generation-outbox.mjs';
import {readRecoverySelectionInTransaction as readCorrectionSelectionInTransaction} from './recovery-selection-default.mjs';

// Explicitly assembled into the existing Guard only when the existing Motor
// has subscribed to the preview event. No server, subscription or migration is
// started by importing this file. Without an allowed subscription ID the
// bootstrap permits registration but never starts the preview dispatcher.
export async function preparePreviewIntegration({pool,guardSecret,readyEvents,delivery,allowedSubscriptionId,sharedOperators=null,post,logger=()=>{}}){
 allowedSubscriptionId??=null;
 if(!pool?.getConnection||!readyEvents||typeof readyEvents.initialize!=='function'||typeof readyEvents.enqueue!=='function'||typeof readyEvents.run!=='function'||typeof readyEvents.start!=='function'||typeof readyEvents.stop!=='function'||(allowedSubscriptionId!==null&&allowedSubscriptionId!==undefined&&!/^sub_[a-f0-9]{48}$/.test(allowedSubscriptionId)))throw Error('PREVIEW_INTEGRATION_INCOMPLETE');
 const c=await pool.getConnection();try{await c.execute(previewGenerationSchema)}finally{c.release()}
 const previewEvents=createMcpPreviewEventStore({pool,guardSecret,delivery,allowedSubscriptionId,sharedOperators,post,logger,readSelection:readCorrectionSelectionInTransaction});
 await previewEvents.initialize();
 const dispatcher=createPreviewGenerationDispatcher({pool,deliver:previewEvents.acceptJob,readSelection:readCorrectionSelectionInTransaction});
 let timer,running=false;
 const tick=async()=>{if(running)return;running=true;try{for(let i=0;i<4;i++)if((await dispatcher.dispatchNext()).status==='NO_PREVIEW_REQUEST')break}catch{logger('mcp.preview.dispatch: unavailable')}finally{running=false}};
 const telegramEvents={
  initialize:async()=>{await readyEvents.initialize();await previewEvents.initialize()},
  enqueue:(...args)=>readyEvents.enqueue(...args),
  run:(action,input)=>input?.params?.name==='opmx.package.preview'?previewEvents.run(action,input):readyEvents.run(action,input),
  start(){readyEvents.start();previewEvents.start();if(allowedSubscriptionId&&!timer){timer=setInterval(tick,10000);timer.unref?.();void tick()}},
  stop(){clearInterval(timer);timer=undefined;previewEvents.stop();readyEvents.stop()}
 };
 return Object.freeze({telegramEvents,enqueuePreviewGeneration,dispatchNext:dispatcher.dispatchNext});
}
