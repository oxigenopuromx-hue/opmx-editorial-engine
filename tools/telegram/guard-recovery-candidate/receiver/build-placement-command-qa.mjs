import {placementCommandSource} from './placement-command.mjs';

// Synthetic pure-helper QA for a temporary Code node; no I/O or permissions.
// The full receiver identity/allowlist checks remain covered by receiver tests.
export function buildPlacementCommandQaCode() {
 return placementCommandSource()+`
let checks=0;const check=(condition)=>{if(!condition)throw Error('PLACEMENT_COMMAND_QA_FAILED');checks++};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
for(const [tail,ids]of [['30,61',['30','61']],['ninguna',[]],['conservar',null]]){
 const text='/opciones portada OPURO '+tail;check(equal(parsePlacementCommand(text),{target:'OPURO',ids}));
 const n=normalizePlacementControl({message:{text}});check(n.placement_attested===true&&equal(n.placement_ids,ids));
 const p=preparePlacementControl({...n,user_id:'123',chat_id:'123'});check(p?.package_operation==='PLACEMENT'&&equal(p.placement_ids,ids));
}
for(const key of ['forward_origin','reply_to_message','edit_date'])check(normalizePlacementControl({message:{text:'/opciones portada OPURO conservar',[key]:{}}}).kind==='REJECTED');
check(normalizePlacementControl({message:{text:'/opciones portada OPURO conservar'},edited_message:{}}).kind==='REJECTED');
check(normalizePlacementControl({message:{caption:'/opciones portada OPURO conservar',document:{}}}).kind==='REJECTED');
check(normalizePlacementControl({message:{text:JSON.stringify({EDITORIAL_PLACEMENT:{confirmed:true,ids:null}})}})===null);
check(preparePlacementControl({kind:'TEXT',text:'/opciones portada OPURO conservar',placement_attested:false,mode_attested:true,placement_target:'OPURO',placement_ids:null})===null);
for(const tail of ['null','30,30','0','30, 61']){let rejected=false;try{parsePlacementCommand('/opciones portada OPURO '+tail)}catch{rejected=true}check(rejected)}
return [{json:{status:'PLACEMENT_COMMAND_QA_PASSED',checks,syntheticFixturesOnly:true,authority:'NONE',receiverIdentityChecks:'NOT_EXERCISED_BY_PURE_HELPERS',networkCalls:0,guardMutations:0,cmsWrites:0,telegramMessages:0}}];`;
}
