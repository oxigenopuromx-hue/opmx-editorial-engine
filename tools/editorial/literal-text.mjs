const MAX_BYTES=2*1024*1024;
const badControls=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
const htmlTags=new Set(['p','div','br','strong','b','em','i','u','s','a','h1','h2','h3','h4','h5','h6','ul','ol','li','blockquote','span']);
const blockTags=new Set(['p','div','br','h1','h2','h3','h4','h5','h6','ul','ol','li','blockquote']);
const blocks=new Set(['paragraph','heading','list','list-item','quote']);
const entities={amp:'&',AMP:'&',lt:'<',LT:'<',gt:'>',GT:'>',quot:'"',QUOT:'"',apos:"'",nbsp:'\u00a0'};
const safeClasses=new Set(['wp-block-paragraph','wp-block-heading','wp-block-list','wp-block-quote','has-text-align-left','has-text-align-center','has-text-align-right','has-text-align-justify']);
const fail=()=>{throw Error('LITERAL_TEXT_UNCONFIRMED')};
function text(value,max=MAX_BYTES){
 if(typeof value!=='string'||badControls.test(value)||new TextEncoder().encode(value).length>max)fail();
 return value;
}
export function normalizeLiteralText(value){return text(value).normalize('NFC').replace(/\s+/gu,' ').trim();}
function decode(value){
 let out='',offset=0;
 while(offset<value.length){
  const index=value.indexOf('&',offset);
  if(index<0){out+=value.slice(offset);break}
  out+=value.slice(offset,index);const end=value.indexOf(';',index+1);
  if(end<0||end-index>32)fail();const name=value.slice(index+1,end);
  if(Object.hasOwn(entities,name))out+=entities[name];
  else if(/^#(?:[0-9]+|x[a-f0-9]+)$/i.test(name)){
   const cp=/^#x/i.test(name)?parseInt(name.slice(2),16):Number(name.slice(1));
   if(!Number.isSafeInteger(cp)||cp<1||cp>0x10ffff||cp>=0xd800&&cp<=0xdfff||cp%0x10000>=0xfffe)fail();
   const char=String.fromCodePoint(cp);if(badControls.test(char))fail();out+=char;
  }else fail();
  offset=end+1;
 }
 return text(out);
}
function classes(value){
 const tokens=value.trim().split(/\s+/u);
 if(!tokens.length||tokens.some(x=>!safeClasses.has(x)))fail();
}
function safeHttpUrl(value){
 // The n8n Code sandbox does not expose URL. Validate only this conservative
 // HTTP(S) vocabulary locally; never resolve a hostname or fetch the link.
 if(/[\\\u0000-\u0020\u007f]/u.test(value))return false;
 const match=/^https?:\/\/([A-Za-z0-9.-]+)(?::([0-9]{1,5}))?(?:[/?#][\s\S]*)?$/i.exec(value);
 if(!match||match[2]&&(Number(match[2])<1||Number(match[2])>65535))return false;
 const host=match[1].endsWith('.')?match[1].slice(0,-1):match[1];
 if(!host||host.length>253)return false;
 if(/^[0-9.]+$/.test(host)){
  const octets=host.split('.');
  return octets.length===4&&octets.every(x=>/^(?:0|[1-9][0-9]{0,2})$/.test(x)&&Number(x)<=255);
 }
 if(/^(?:0x[a-f0-9]+|[0-9]+)(?:\.(?:0x[a-f0-9]+|[0-9]+))*$/i.test(host)||/^[0-9]+$/.test(host.split('.').at(-1)))return false;
 return host.split('.').every(x=>x.length<=63&&/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(x));
}
function blockAttributes(name,value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)fail();
 const allowed={paragraph:['align','className','anchor','dropCap'],heading:['align','textAlign','className','anchor','level'],list:['ordered','start','reversed','className'], 'list-item':['className'],quote:['className']}[name];
 for(const [key,v] of Object.entries(value)){
  if(!allowed.includes(key))fail();
  if(key==='className'){if(typeof v!=='string')fail();classes(v)}
  else if(key==='anchor'){if(typeof v!=='string'||! /^[A-Za-z][A-Za-z0-9_-]{0,159}$/.test(v))fail()}
  else if(['align','textAlign'].includes(key)){if(!['left','center','right','justify'].includes(v))fail()}
  else if(key==='level'){if(!Number.isSafeInteger(v)||v<1||v>6)fail()}
  else if(key==='start'){if(!Number.isSafeInteger(v)||v<1||v>1000000)fail()}
  else if(typeof v!=='boolean')fail();
 }
}
function attributes(raw,tag){
 let remaining=raw;const seen=new Set();
 while(remaining.trim()){
  const match=/^\s+([A-Za-z][A-Za-z0-9-]*)\s*=\s*(?:"([^"<>]*)"|'([^'<>]*)')/.exec(remaining);
  if(!match)fail();const name=match[1].toLowerCase(),value=decode(match[2]??match[3]);remaining=remaining.slice(match[0].length);
  if(seen.has(name)||!['class','id','title','lang','dir','href','rel','target'].includes(name))fail();seen.add(name);
  if(name==='class')classes(value);
  else if(name==='id'){if(!/^[A-Za-z][A-Za-z0-9_-]{0,159}$/.test(value))fail()}
  else if(name==='lang'){if(!/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(value))fail()}
  else if(name==='dir'){if(!['ltr','rtl','auto'].includes(value))fail()}
  else if(name==='title'){text(value,8192)}
  else if(tag!=='a')fail();
  else if(name==='href'){
   if(value.startsWith('#')){if(!/^#[A-Za-z][A-Za-z0-9_-]{0,159}$/.test(value))fail()}
   else if(!safeHttpUrl(value))fail();
  }else if(name==='target'){if(!['_blank','_self'].includes(value))fail()}
  else if(name==='rel'){if(value.trim().split(/\s+/u).some(x=>!['noopener','noreferrer','nofollow','sponsored','ugc'].includes(x)))fail()}
 }
}

// This intentionally handles only the small, deterministic markup vocabulary
// used by the literal renderer. It does not run a browser, fetch a link, decode
// an HTML entity into markup, execute a source instruction or discard unknown
// HTML. Anything outside this vocabulary requires explicit reconciliation.
export function extractLiteralVisibleText(markup){
 text(markup);const stack=[],blockStack=[];let offset=0,visible='',tokens=0;
 while(offset<markup.length){
  if(++tokens>100000)fail();const index=markup.indexOf('<',offset);
  if(index<0){visible+=decode(markup.slice(offset));offset=markup.length;break}
  visible+=decode(markup.slice(offset,index));
  if(markup.startsWith('<!--',index)){
   const end=markup.indexOf('-->',index+4);if(end<0)fail();const body=markup.slice(index+4,end).trim();
   const m=/^(\/?)wp:(?:core\/)?([a-z-]+)(?:\s+(\{[\s\S]*\}))?(\s*\/)?$/.exec(body);
   if(!m||!blocks.has(m[2])||body.includes('<!--')||body.includes('--'))fail();
   const closing=m[1]==='/',selfClosing=!!m[4];
   if(closing){if(m[3]||selfClosing)fail();const last=blockStack.pop();if(!last||last.name!==m[2]||last.depth!==stack.length)fail()}
   else {if(m[3]){let parsed;try{parsed=JSON.parse(m[3])}catch{fail()}blockAttributes(m[2],parsed)}if(!selfClosing){blockStack.push({name:m[2],depth:stack.length});if(blockStack.length>64)fail()}}
   offset=end+3;continue;
  }
  let end=index+1,quote=null;
  for(;end<markup.length;end++){
   const char=markup[end];
   if(quote){if(char===quote)quote=null;else if(char==='<')fail()}
   else if(char==='"'||char==="'")quote=char;
   else if(char==='>')break;
   else if(char==='<')fail();
  }
  if(end>=markup.length||quote)fail();
  const token=markup.slice(index,end+1),m=/^<(\/?)([A-Za-z][A-Za-z0-9]*)([\s\S]*?)>$/.exec(token);
  if(!m)fail();const closing=m[1]==='/',name=m[2].toLowerCase();if(!htmlTags.has(name))fail();
  let rest=m[3],selfClosing=false;
  if(/\/\s*$/.test(rest)){selfClosing=true;rest=rest.replace(/\/\s*$/,'')}
  if(closing){if(rest.trim()||selfClosing||name==='br'||stack.pop()!==name)fail()}
  else {
   if(selfClosing&&name!=='br'||name==='a'&&stack.includes('a'))fail();
   if(blockTags.has(name)&&name!=='br'&&stack.some(x=>['p','strong','b','em','i','u','s','a','span','h1','h2','h3','h4','h5','h6'].includes(x)))fail();
   if(name==='li'&&!['ul','ol'].includes(stack.at(-1))||['ul','ol'].includes(stack.at(-1))&&name!=='li')fail();
   attributes(rest,name);if(name!=='br'){stack.push(name);if(stack.length>128)fail()}
  }
  if(blockTags.has(name))visible+='\n';
  offset=end+1;
 }
 if(stack.length||blockStack.length)fail();return normalizeLiteralText(visible);
}

export function assertLiteralCanonicalText({sourceText,title,subtitle,html,gutenberg,enriched}={}){
 text(title,2048);text(subtitle,8192);
 if(!normalizeLiteralText(title)||/<\/?[a-z!]/i.test(title)||/<\/?[a-z!]/i.test(subtitle))fail();
 for(const value of [html,gutenberg,enriched])if(!text(value).trim())fail();
 const normalizedBody=extractLiteralVisibleText(gutenberg);
 if(!normalizedBody||extractLiteralVisibleText(html)!==normalizedBody||extractLiteralVisibleText(enriched)!==normalizedBody)fail();
 const block=/<!--\s*wp:(?:core\/)?(?:paragraph|heading|list|quote)(?:\s|--)/;
 if(!block.test(gutenberg)||!block.test(enriched))fail();
 if(normalizeLiteralText([title,subtitle,normalizedBody].join('\n'))!==normalizeLiteralText(sourceText))fail();
 return {title,subtitle,html,gutenberg,enriched,normalizedBody};
}
