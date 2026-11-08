import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('./receiver/confirm-candidate.js',import.meta.url),'utf8');
const run=(context,result)=>new Function('$input','$',code)({first:()=>({json:result})},()=>({first:()=>({json:context})}))[0].json;
const pkg='tg_'+'a'.repeat(40),item='ti_'+'b'.repeat(40);
const selection={package_operation:'SELECT',packageId:pkg,package_revision:11,selection_mode:'LITERAL',selection_destination:'OPOL,LIBERAL'};
test('selection acknowledges only the requested revision and options',()=>{
 const result={status:'SELECTED',packageId:pkg,revision:12,action:'CREATE',mode:'LITERAL',destination:'OPOL,LIBERAL'};
 assert.match(run(selection,result).reply_text,/Opciones registradas/);
 for(const bad of [{...result,revision:13},{...result,action:'UPDATE'},{...result,mode:'EDITORIAL'},{...result,packageId:'bad'},{...result,destination:'OPURO'}])assert.match(run(selection,bad).reply_text,/No pude confirmar/);
 assert.match(run(selection,{status:'SELECTION_REPLAY',revision:12}).reply_text,/Opciones registradas/);
});
test('confirmation only claims queuing and never claims publication',()=>{
 const context={package_operation:'CONFIRM'};
 assert.match(run(context,{status:'CONFIRMED',eventId:'evt_'+'a'.repeat(48)}).reply_text,/puesta en cola.*no se ha confirmado ninguna publicación/);
 assert.match(run(context,{status:'CONFIRMED',eventId:'bad'}).reply_text,/No pude confirmar/);
 assert.match(run(context,{status:'PREVIEW_DELIVERY_UNCONFIRMED'}).reply_text,/No se envió/);
});
test('discard acknowledgement requires the requested item',()=>{
 const context={package_operation:'DISCARD',recovery_session:true,discard_item_id:item};
 assert.match(run(context,{status:'DISCARDED_REPLAY',itemId:item}).reply_text,/historial se conservan/);
 assert.match(run(context,{status:'DISCARDED',itemId:'wrong'}).reply_text,/No pude confirmar/);
});
