import test from 'node:test';import assert from 'node:assert/strict';import {patchFeaturedAdminGraph as patch} from './featured-admin-graph.mjs';
const entries=Array.from({length:46},(_,i)=>[i+1,i===45?'PUBLISHER_PERMISSION_DENIED_LIBERAL':'CODE_'+i]);
const source='const BLOCKER_DIAGNOSTIC_ENTRIES='+JSON.stringify(entries)+';\nfunction blockerDiagnosticSpec(){}';
const input={nodes:['Seleccionar alertas de administrador','Preparar comprobación de alertas'].map(name=>({name,parameters:{jsCode:source}}))};
test('extends the two administrative copies consistently',()=>{const out=patch(input);for(const n of out.nodes)assert.match(n.parameters.jsCode,/MASTER_FEATURED/);assert.equal(input.nodes[0].parameters.jsCode,source);assert.throws(()=>patch(out),/CHANGED/)});
test('rejects an absent or divergent copy',()=>{const x=structuredClone(input);x.nodes[1].parameters.jsCode=x.nodes[1].parameters.jsCode.replace('CODE_0','DIFFERENT');assert.throws(()=>patch(x),/CHANGED/)});
