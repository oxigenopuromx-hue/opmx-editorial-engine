import test from 'node:test';import assert from 'node:assert/strict';import {patchV4Code} from './v4-graph.mjs';
test('v4 follows four-site paths without broadening historical policies',()=>{
 const src="const registries={'publish-todos-v3':Object.freeze(['OPURO','OPOL','LIBERAL','HORIZONTE'])}; function route(policy){return policy==='publish-todos-v3'?'four':'old'}; return [registries,route];";
 const [r,route]=new Function(patchV4Code(src))();assert.equal(route('publish-ambos-v4'),'four');assert.equal(route('publish-todos-v3'),'four');assert.equal(route('publish-todos-v2'),'old');assert.equal(r['publish-ambos-v4'].length,4);
});
test('v4 adds an allowed policy while retaining old ones',()=>{const f=new Function('scope',patchV4Code("return ['publish-ambos-v1','publish-todos-v2','publish-todos-v3'].includes(scope.policy)"));assert.equal(f({policy:'publish-ambos-v4'}),true);assert.equal(f({policy:'unknown'}),false)});
