import {createHash} from 'node:crypto';

// Server configuration approved explicitly by Dirección in Work. It selects
// prose, never mode, destinations, a write capability or a new request ID.
// Applies only to the editing cycle opened from reconciled revision 19.
// Other packages and historical confirmations keep their previous behaviour.
export const literalOriginalApprovals=Object.freeze([Object.freeze({
 packageId:'tg_ee2abeccf95ce88f6bafef38d32270aec528264b',baseRevision:19,
 itemId:'ti_35df9a3af3858c9808eadf67cfde846baaec8f40',
 sha256:'4acb98319e0d54438be9be38f7597a71447c332f0b09605734f04efb6938b14a',
 instructionItemId:'ti_6d1f3425631fda7f23bef9a7d7385e0a7b2ec622',
 instructionSha256:'09d8002b8a382f4e2f002b98a08a9d0b8e2805950f0ca7e5ea6713eca6964d86',
 discardedItemId:'ti_2c3fecb41858dc6e0bfcb45cec61d17af81a8a84',
 discardedSha256:'9ab3cfa1f08497e3759c83b7c29730b81c20065680ceeef38ec23a6c72070ee4',
 imageItemId:'ti_d092bbaac1d1f58489a9d34adf5af6367490377d',
 imageSha256:'4c6414049eab819b82a4ef4cdf4cb31b83f7042cbcb35d588b183350fa531a3f',
 titleLineCount:2,approvalReference:'WORK_DIRECTOR_20261124_LITERAL_ORIGINAL'
})]);
const sha=s=>createHash('sha256').update(s).digest('hex');
const fail=code=>{throw Object.assign(Error(code),{code,comparison:'SELECTED_LITERAL_ORIGINAL'})};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

// Call only with a package/session/decision already authenticated by Guard.
// No approval is ever read from source text, a caption or an HTTP assertion.
export function resolveApprovedLiteralOriginal({packageId,baseRevision,revision,action,mode,destination,items,controlItemIds=[]}={},approvals=literalOriginalApprovals){
 const a=approvals.find(x=>x.packageId===packageId&&x.baseRevision===baseRevision);
 if(!a||action!=='CREATE'||mode!=='LITERAL'||destination!=='AMBOS')return null;
 if(!Number.isSafeInteger(revision)||revision<=baseRevision||!Array.isArray(items)||!Array.isArray(controlItemIds)||new Set(controlItemIds).size!==controlItemIds.length)fail('LITERAL_ORIGINAL_SCOPE_UNCONFIRMED');
 const byId=new Map();
 for(const item of items){if(!item||byId.has(item.itemId)||!['STORED','DISCARDED'].includes(item.state))fail('LITERAL_ORIGINAL_INVENTORY_UNCONFIRMED');byId.set(item.itemId,item)}
 const source=byId.get(a.itemId),instruction=byId.get(a.instructionItemId),image=byId.get(a.imageItemId),discarded=byId.get(a.discardedItemId);
 // A preview material list omits discarded records. A full inventory includes
 // them. Either way the discarded document can never become active again.
 if(discarded&&(discarded.state!=='DISCARDED'||discarded.sha256!==a.discardedSha256))fail('LITERAL_DISCARDED_ORIGINAL_ACTIVE');
 for(const [item,id,digest] of [[source,a.itemId,a.sha256],[instruction,a.instructionItemId,a.instructionSha256]]){
  if(!item||item.itemId!==id||item.kind!=='TEXT'||item.state!=='STORED'||item.sha256!==digest||typeof item.text!=='string'||sha(item.text)!==digest)fail('LITERAL_ORIGINAL_BYTES_UNCONFIRMED');
 }
 if(!image||image.kind!=='FILE'||image.state!=='STORED'||image.sha256!==a.imageSha256)fail('LITERAL_ORIGINAL_IMAGE_CHANGED');
 const controls=new Set(controlItemIds);
 if(controls.has(a.itemId)||controls.has(a.instructionItemId)||controls.has(a.imageItemId)||[...controls].some(id=>byId.get(id)?.kind!=='TEXT'||byId.get(id)?.state!=='STORED'))fail('LITERAL_ORIGINAL_CONTROL_CONFLICT');
 const allowed=new Set([a.itemId,a.instructionItemId,a.imageItemId,...controls]);
 if(items.some(x=>x.state==='STORED'&&!allowed.has(x.itemId)))fail('LITERAL_ORIGINAL_ADDITIONAL_MATERIAL_REQUIRES_REVIEW');
 return {schema:'opmx.literal-original-selection.v1',packageId,baseRevision,itemId:a.itemId,sha256:a.sha256,instructionItems:[{itemId:a.instructionItemId,sha256:a.instructionSha256}],imageItemId:a.imageItemId,imageSha256:a.imageSha256,titleLineCount:a.titleLineCount,approvalReference:a.approvalReference};
}

export function sameLiteralOriginalSelection(a,b){return same(a,b)}

// Guard adapter, called only after readConfirmedCorrection has independently
// validated the server-owned decision, delivery receipts and exact preview.
export function bindApprovedLiteralOriginal({decisionSelection=null,legacySourceText,...scope}={}){
 const selection=resolveApprovedLiteralOriginal(scope);
 if(selection&&!same(selection,decisionSelection)||!selection&&decisionSelection!==null)fail('LITERAL_ORIGINAL_CONFIRMATION_UNCONFIRMED');
 if(!selection)return {sourceText:legacySourceText};
 const original=scope.items.find(x=>x.itemId===selection.itemId).text;
 return {literalOriginal:selection,sourceText:selectedLiteralLayout(original,selection.titleLineCount).sourceText};
}

// Joining explicitly selected whole title lines changes presentation whitespace
// only. No word, label, punctuation, paragraph or instruction is removed from
// the selected original. In particular this never edits a DOCX or its label.
export function selectedLiteralLayout(sourceText,titleLineCount){
 if(typeof sourceText!=='string'||!Number.isSafeInteger(titleLineCount)||titleLineCount<1||titleLineCount>10)fail('LITERAL_TITLE_LAYOUT_UNCONFIRMED');
 const lines=sourceText.replace(/\r\n?/g,'\n').split('\n'),first=lines.findIndex(x=>x.trim());
 if(first<0||lines.slice(first,first+titleLineCount).length!==titleLineCount||lines.slice(first,first+titleLineCount).some(x=>!x.trim()))fail('LITERAL_TITLE_LAYOUT_UNCONFIRMED');
 const title=lines.slice(first,first+titleLineCount).join(' '),rest=lines.slice(first+titleLineCount).join('\n');
 const canonicalSource=title+'\n'+rest;
 const normalize=s=>s.normalize('NFC').replace(/\s+/gu,' ').trim();
 if(normalize(canonicalSource)!==normalize(sourceText))fail('LITERAL_SELECTED_TEXT_CHANGED');
 const paragraphs=rest.split(/\n[^\S\n]*\n/u.test(sourceText)?/\n[^\S\n]*\n+/u:/\n/u).filter(x=>x.trim());
 if(!paragraphs.length)fail('LITERAL_SELECTED_BODY_EMPTY');
 return {title:title.trim(),subtitle:'',paragraphs,sourceText:canonicalSource};
}

// Motor adapter: this is candidate preparation, not authority. Guard must
// independently derive the actual base revision and bind the same selection
// into the new preview and confirmation before it will validate any payload.
export function selectApprovedLiteralSource(inventory,sources,policy){
 const packageId=inventory?.package_id,a=literalOriginalApprovals.find(x=>x.packageId===packageId);
 if(!a||!Number.isSafeInteger(inventory?.revision)||inventory.revision<=a.baseRevision)return null;
 if(policy?.authorized!==true||policy.content_mode!=='LITERAL'||policy.destination!=='AMBOS'||!['DRAFT','PUBLISH'].includes(policy.mode)||inventory.confirmed_correction?.action!=='CREATE')fail('LITERAL_ORIGINAL_POLICY_UNCONFIRMED');
 const items=inventory.items.map(x=>{
  const item={itemId:x.item_id,kind:x.kind,state:x.state,sha256:x.sha256};
  if(x.state==='STORED'&&x.kind==='TEXT'){
   const matches=sources.filter(s=>s.item_id===x.item_id&&s.stream==='text');
   if(matches.length!==1||!Buffer.isBuffer(matches[0].bytes)||matches[0].bytes.length!==x.text_bytes||sha(matches[0].bytes)!==x.sha256)fail('LITERAL_ORIGINAL_BYTES_UNCONFIRMED');
   item.text=new TextDecoder('utf-8',{fatal:true}).decode(matches[0].bytes);
  }
  return item;
 });
 const selection=resolveApprovedLiteralOriginal({packageId,baseRevision:a.baseRevision,revision:inventory.revision,action:'CREATE',mode:policy.content_mode,destination:policy.destination,items,controlItemIds:policy.control_item_ids});
 if(!selection)fail('LITERAL_ORIGINAL_SCOPE_UNCONFIRMED');
 const original=items.find(x=>x.itemId===selection.itemId).text;
 return {selection,originalText:original,...selectedLiteralLayout(original,selection.titleLineCount)};
}

export function literalComparisonDiagnostic({selection,expected,actual,phase='LOCAL_LITERAL_VALIDATION'}={}){
 if(selection?.schema!=='opmx.literal-original-selection.v1'||typeof expected!=='string'||typeof actual!=='string')fail('LITERAL_DIAGNOSTIC_SCOPE_UNCONFIRMED');
 const normalize=s=>s.normalize('NFC').replace(/\s+/gu,' ').trim(),a=normalize(expected),b=normalize(actual);
 let offset=0;while(offset<Math.min(a.length,b.length)&&a[offset]===b[offset])offset++;
 return {schema:'opmx.literal-comparison-diagnostic.v1',phase,sourceItemId:selection.itemId,sourceSha256:selection.sha256,equal:a===b,firstDifference:a===b?null:offset,expectedFragment:a.slice(Math.max(0,offset-30),offset+60),actualFragment:b.slice(Math.max(0,offset-30),offset+60)};
}
