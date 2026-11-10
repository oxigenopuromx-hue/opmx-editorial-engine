import {createHash} from 'node:crypto';
import {chooseTelegramMode,decodeControl,ORDER_PREFIX} from './original-destination-policy.mjs';
import {destinationLabel,resolveDestinations} from './original-destinations.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const fail=()=>{throw Error('RECOVERED_POLICY_UNCONFIRMED')};

// inventory must be the exact trusted MCP response for this event, never a
// source's text or an LLM-generated object. Sources must be verified buffers.
export function chooseMotorPolicy(inventory,sources,{packageId,revision}){
 if(!inventory||inventory.status!=='PACKAGE_FOUND'||inventory.package_id!==packageId||inventory.revision!==revision||inventory.state!=='READY'||!Array.isArray(inventory.items)||!Array.isArray(sources))fail();
 if(!Object.hasOwn(inventory,'recovered_policy')){if(Object.hasOwn(inventory,'confirmed_correction'))fail();return chooseTelegramMode(inventory,sources)}
 const p=inventory.recovered_policy;
 if(!p||typeof p!=='object'||Array.isArray(p)||p.authorized!==true||!['PUBLISH','DRAFT'].includes(p.mode)||typeof p.explicit!=='boolean'||
    !['DIRECT_MODE_COMMAND','ANNOUNCED_DEFAULT_AND_DIRECT_CLOSE'].includes(p.authorization)||
    (p.authorization==='DIRECT_MODE_COMMAND'&&!p.explicit)||(p.authorization==='ANNOUNCED_DEFAULT_AND_DIRECT_CLOSE'&&(p.explicit||p.mode!=='PUBLISH'))||
    !Array.isArray(p.control_item_ids)||!p.control_item_ids.length||new Set(p.control_item_ids).size!==p.control_item_ids.length)fail();
 try{if(destinationLabel(resolveDestinations(p.destination))!==p.destination)fail()}catch{fail()}
 const ids=new Set(),controls=new Map();let last=null,substantive=0;
 for(const item of inventory.items){
  if(!/^ti_[a-f0-9]{40}$/.test(item.item_id??'')||ids.has(item.item_id))fail();ids.add(item.item_id);
  if(item.state==='DISCARDED')continue;
  if(item.state!=='STORED')fail();last=item;
  if(item.kind==='FILE'){substantive++;continue}
  if(item.kind!=='TEXT')fail();
  const matches=sources.filter(s=>s.item_id===item.item_id&&s.stream==='text');
  if(matches.length!==1||!Buffer.isBuffer(matches[0].bytes)||matches[0].bytes.length!==item.text_bytes||hash(matches[0].bytes)!==item.sha256)fail();
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(matches[0].bytes).trim()}catch{fail()}
  let control;try{control=decodeControl(text,packageId)}catch{fail()}
  if(control)controls.set(item.item_id,control);else if(text&&!text.startsWith(ORDER_PREFIX))substantive++;
 }
 if(!substantive||!last||last.kind!=='TEXT'||!p.control_item_ids.includes(last.item_id)||controls.get(last.item_id)?.command!=='/listo'||p.control_item_ids.some(id=>!controls.has(id))||[...controls.keys()].some(id=>!p.control_item_ids.includes(id)))fail();
 const result={mode:p.mode,authorized:true,explicit:p.explicit,authorization:p.authorization,destination:p.destination,control_item_ids:[...p.control_item_ids]};
 if(Object.hasOwn(inventory,'confirmed_correction')){
  const c=inventory.confirmed_correction;
  if(!c||typeof c!=='object'||Array.isArray(c)||c.package_id!==packageId||c.revision!==revision||!['CREATE','UPDATE'].includes(c.action)||!['LITERAL','EDITORIAL'].includes(c.content_mode)||!/^[a-f0-9]{64}$/.test(c.preview_hash??''))fail();
  try{if(destinationLabel(resolveDestinations(c.destination))!==c.destination)fail()}catch{fail()}
  result.destination=c.destination;result.content_mode=c.content_mode;result.confirmed_preview_hash=c.preview_hash;
  if(c.action==='UPDATE'){
   const destinations=resolveDestinations(c.destination);
   if(!Array.isArray(c.posts)||c.posts.length!==destinations.length||c.posts.some((post,i)=>!post||Object.keys(post).sort().join(',')!=='destination,post_id'||post.destination!==destinations[i]||!Number.isSafeInteger(post.post_id)||post.post_id<1))fail();
   // The legacy Motor only accepts PUBLISH or DRAFT. A separate UPDATE mode
   // must never fall through the creation or publication path.
   result.mode='UPDATE';result.action='UPDATE';result.posts=c.posts.map(post=>({destination:post.destination,post_id:post.post_id}));
  }
 }
 return result;
}
