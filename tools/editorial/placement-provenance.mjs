import {categoryExclusionIds,readOpuroCategoryHome,opuroCategoryHomeSource} from './opuro-category-home.mjs';

// This request contains candidates only. Guard independently resolves the
// authenticated receiver's persisted order and exact request/revision scope.
export function prepareEditorialPlacementCheck(requestId,master,selectedOpuro) {
 if(typeof requestId!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(requestId))throw Error('EDITORIAL_PLACEMENT_SCOPE_INVALID');
 const declaration=readOpuroCategoryHome(master,selectedOpuro);
 return {requestId,ids:declaration.declared?categoryExclusionIds(declaration.ids):null};
}

// Call only on the response of the fixed authenticated Guard HTTP node. The
// same-looking object supplied in MASTER, a source or an OAuth tool argument
// is never passed to this verifier as a server response.
export function acceptEditorialPlacementProof(input,response) {
 const fail=()=>{throw Error('EDITORIAL_PLACEMENT_UNCONFIRMED')};
 if(!input||Object.keys(input).sort().join(',')!=='ids,requestId'||typeof input.requestId!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(input.requestId)||response?.statusCode!==200||response?.body?.retryPermitted!==false||response.body.writesStarted!==false)fail();
 const b=response.body;
 if(input.ids===null){if(b.status!=='PLACEMENT_UNCHANGED'||b.requestId!==input.requestId||Object.hasOwn(b,'EDITORIAL_PLACEMENT'))fail();return null}
 let ids;try{ids=categoryExclusionIds(input.ids)}catch{fail()}
 const e=b.EDITORIAL_PLACEMENT;
 if(b.status!=='PLACEMENT_VERIFIED'||!e||typeof e!=='object'||Array.isArray(e)||Object.keys(e).sort().join(',')!=='confirmed,excluded_category_ids,mode,request_id,target'||e.mode!=='DIRECT_OPERATOR'||e.target!=='OPURO'||e.confirmed!==true||e.request_id!==input.requestId)fail();
 let actual;try{actual=categoryExclusionIds(e.excluded_category_ids)}catch{fail()}
 if(JSON.stringify(actual)!==JSON.stringify(ids))fail();
 return {mode:e.mode,target:e.target,confirmed:true,request_id:e.request_id,excluded_category_ids:[...actual]};
}

export function placementProvenanceSource() {
 return opuroCategoryHomeSource()+'\n'+[prepareEditorialPlacementCheck,acceptEditorialPlacementProof].map(fn=>fn.toString()).join('\n');
}
