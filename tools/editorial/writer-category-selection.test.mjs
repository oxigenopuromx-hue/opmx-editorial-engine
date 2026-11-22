import test from 'node:test';import assert from 'node:assert/strict';
import {selectWriterCategory as select} from './writer-category-selection.mjs';
const row=(id,name,parent=0)=>({id,name,slug:`cat-${id}`,parent});
const rows=[row(21,'Deporte'),row(4,'Noticias'),row(43,'Deporte',4)];
const fetch=async({site,page})=>({status:200,totalPages:1,body:site==='OPURO'&&page===1?rows:[]});
test('real OPURO duplicate requires and preserves the selected category identity',async()=>{
 await assert.rejects(select('OPURO',{name:'Deporte'},fetch),/AMBIGUOUS/);
 const root=await select('OPURO',{name:'Deporte',id:21},fetch),child=await select('OPURO',{name:'Deporte',id:43,slug:'cat-43'},fetch);
 assert.equal(root.principal.id,21);assert.equal(child.principal.id,43);assert.equal(child.principal.parent,4);
 await assert.rejects(select('OPURO',{name:'Deporte',id:43,slug:'cat-21'},fetch),/UNCONFIRMED/);
});
test('IDs cannot override site, name, hierarchy or server-owned transport',async()=>{
 const pol=async()=>({status:200,totalPages:1,body:[row(10,'ESTADOS'),row(1731,'GUERRERO',10),row(4,'CONGRESO')]});
 assert.equal((await select('OPOL',{name:'ESTADOS',secondaryName:'GUERRERO'},pol)).secondary.id,1731);
 await assert.rejects(select('OPOL',{name:'CONGRESO',secondaryName:'GUERRERO'},pol),/HIERARCHY/);
 await assert.rejects(select('OPOL',{name:'ESTADOS',id:1731},pol),/UNCONFIRMED/);
 await assert.rejects(select('OPOL',{name:'ESTADOS',url:'https://attacker.example'},pol),/INVALID/);
 await assert.rejects(select('LIBERAL',{name:'ESTADOS',secondaryName:'GUERRERO'},pol),/NOT_ALLOWED/);
});
test('rejects stale or inaccessible live catalog instead of reusing old IDs',async()=>{
 await assert.rejects(select('OPURO',{name:'Deporte',id:21},async()=>({status:401,totalPages:1,body:[]})),/CATALOG/);
 await assert.rejects(select('OPURO',{name:'Deporte',id:21},async()=>({status:200,totalPages:1,body:[row(43,'Deporte')]})),/UNCONFIRMED/);
});
