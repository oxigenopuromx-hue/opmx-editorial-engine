import {createHash} from 'node:crypto';
// Call after publishing the writer and fetching its exact active version.
// Diagnostics identify that release; this does not grant write authorization.
export function bindWriterRelease(input,{writer,versionId}={}){
 if(!Array.isArray(input?.nodes)||!Array.isArray(writer?.nodes)||!/^[-a-f0-9]{36}$/.test(versionId??''))throw Error('WRITER_RELEASE_INVALID');
 const get=(nodes,name)=>{const a=nodes.filter(n=>n.name===name);if(a.length!==1||typeof a[0].parameters?.jsCode!=='string')throw Error('WRITER_RELEASE_CHANGED');return a[0]};
 const normalizer=get(writer.nodes,'Validar y normalizar OPMX MASTER').parameters.jsCode,prepare=get(writer.nodes,'Preparar MASTER y binarios').parameters.jsCode;
 const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
 const pin={workflowId:'4o7K5TmKc7joScqB',versionId,prepareSha256:hash(prepare),normalizerSha256:hash(normalizer)};
 const out=structuredClone(input),node=get(out.nodes,'MASTER — Validación estática Shared');let s=node.parameters.jsCode;
 const oldLegacy='pin={"workflowId":"4o7K5TmKc7joScqB","versionId":"2130cf37-0a61-4897-b4c9-d5365c4c6b8d","prepareSha256":"8db8e0c0aaafd824450551a91b174c073a02d2da4c7c8c5c4069a22766add645","normalizerSha256":"CANDIDATE_NOT_RELEASED"}';
 const oldV3="pin={workflowId:'issue44-candidate',versionId:'v3-unreleased',prepareSha256:'NOT_RELEASED',normalizerSha256:'NOT_RELEASED'}";
 for(const old of [oldLegacy,oldV3]){if(s.split(old).length!==2)throw Error('WRITER_RELEASE_CHANGED');s=s.replace(old,'pin='+JSON.stringify(pin))}
 node.parameters.jsCode=s;return {graph:out,pin};
}
