import {categoryExclusionIds,opuroCategoryHomeSource} from './opuro-category-home.mjs';

export function normalizePlacementInventory(projection,revision,state) {
 const fail=()=>{throw Error('EDITORIAL_PLACEMENT_MANIFEST_UNCONFIRMED')};
 if(!projection||typeof projection!=='object'||Array.isArray(projection)||!['OPEN','READY'].includes(state)||!Number.isSafeInteger(revision)||projection.current_revision!==revision||!Number.isSafeInteger(projection.control_revision)||projection.control_revision<1||projection.control_revision>revision||projection.mode!=='DIRECT_OPERATOR'||projection.target!=='OPURO'||projection.confirmed!==true||projection.source!=='GUARD_TELEGRAM_CONTROL'||!['PLACEMENT_SELECTION','PLACEMENT_PRESERVE'].includes(projection.status))fail();
 if(state==='READY'&&!/^tg_[a-f0-9]{64}$/.test(projection.request_id??'')||state==='OPEN'&&Object.hasOwn(projection,'request_id'))fail();
 const out={status:projection.status,mode:'DIRECT_OPERATOR',target:'OPURO',confirmed:true,source:'GUARD_TELEGRAM_CONTROL',current_revision:revision,control_revision:projection.control_revision,...(state==='READY'?{request_id:projection.request_id}:{})};
 if(projection.status==='PLACEMENT_SELECTION'){try{out.excluded_category_ids=categoryExclusionIds(projection.excluded_category_ids)}catch{fail()}}
 else if(Object.hasOwn(projection,'excluded_category_ids'))fail();
 return out;
}

export function placementInventorySource(){return opuroCategoryHomeSource()+'\n'+normalizePlacementInventory.toString();}
