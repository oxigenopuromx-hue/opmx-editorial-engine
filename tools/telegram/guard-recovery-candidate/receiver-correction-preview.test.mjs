import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('./receiver/correction-preview-candidate.js',import.meta.url),'utf8');
const run=result=>new Function('$input',code)({first:()=>({json:result})})[0].json;
test('preview preserves all text in bounded escaped chunks and hides internal controls',()=>{
 const p={packageId:'tg_'+'a'.repeat(40),revision:8,previewHash:'c'.repeat(64),action:'CREATE',mode:'LITERAL',destination:'OPURO',posts:[{destination:'OPURO',postId:null}],changes:[{itemId:'ti_'+'1'.repeat(40),kind:'TEXT',change:'ADDED',sha256:'b'.repeat(64),text:'<&😀'.repeat(1500)},{itemId:'ti_'+'2'.repeat(40),kind:'TEXT',change:'ADDED',sha256:'b'.repeat(64),text:'OPMX-TELEGRAM-ORDER-0dda75de5e03b4c2f9b1844865aaa11fd15be97dca854a0d\n/listo'}]};
 const out=run({status:'PREVIEW_READY',preview:p});assert.equal(out.status,'PREVIEW_RENDERED');assert.ok(out.messages.length>1);assert.ok(out.messages.every(x=>x.length<=3000));const all=out.messages.join('');assert.ok(all.includes('&lt;&amp;😀'.repeat(1500)));assert.ok(!all.includes('OPMX-TELEGRAM-ORDER'));assert.ok(all.includes('/confirmar crear 8 '+p.previewHash));
});
test('a malformed or unavailable preview cannot provide a confirmation command',()=>{assert.equal(run({status:'PREVIEW_READY',preview:{action:'UPDATE'}}).status,'PREVIEW_NOT_CONFIRMED')});
