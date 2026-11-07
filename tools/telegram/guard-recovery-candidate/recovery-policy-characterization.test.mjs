import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {attestedControl,chooseTelegramMode} from '../default-publication-policy.mjs';

// These fixtures model two different Telegram private chats. Message IDs are
// scoped to a chat: an administrator's /listo may be smaller than, or equal
// to, the original operator's /nuevo. The existing resolver has no actor
// metadata and cannot safely decide a recovered revision by comparing those IDs.
const pkg='tg_'+'a'.repeat(40);
function inventoryWithAdminClose(adminMessageId){
 const texts=[attestedControl('/nuevo',pkg,100,101),'original',attestedControl('/listo',pkg,102),'aclaración',attestedControl('/listo',pkg,adminMessageId)];
 const sources=[];
 const items=texts.map((text,i)=>{const bytes=Buffer.from(text);const item_id='item-'+i;sources.push({item_id,stream:'text',bytes});return {item_id,kind:'TEXT',state:'STORED',text_bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};});
 return [{package_id:pkg,state:'READY',items},sources];
}
test('existing mode resolver rejects a valid administrator close with an earlier per-chat ID',()=>{
 const [inventory,sources]=inventoryWithAdminClose(5);
 assert.throws(()=>chooseTelegramMode(inventory,sources),/PACKAGE_BOUNDARY_INVALID/);
});
test('existing mode resolver treats matching IDs from different chats as duplicates',()=>{
 const [inventory,sources]=inventoryWithAdminClose(100);
 assert.throws(()=>chooseTelegramMode(inventory,sources),/CONTROL_MESSAGE_DUPLICATE/);
});
