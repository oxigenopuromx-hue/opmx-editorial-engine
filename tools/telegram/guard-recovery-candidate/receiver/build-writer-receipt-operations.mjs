// Apply to a snapshot of the existing active writer, never an unrelated draft.
// This adds acknowledgements after CMS writes; it creates no event consumer.
export function buildWriterReceiptOperations({workflow,phase,protocol,guardCredential}){
 const expected={bnzVMNkZuGO1GQCZ:['PUBLISH','Resultado publicación MCP'],Mt7ts2EGPbyaTC2o:['PUBLISH','Resultado publicación MCP'],'4o7K5TmKc7joScqB':['DRAFT','Resultado consolidado OPMX']};
 const match=expected[workflow?.id];
 if(!match||match[0]!==phase||!Array.isArray(workflow.nodes)||!workflow.connections||typeof protocol!=='string'||!protocol.includes('export function prepareWriterReceipt')||!guardCredential?.id||!guardCredential.name)throw Error('WRITER_GRAPH_UNCONFIRMED');
 const source=match[1],original=workflow.nodes.filter(n=>n.name===source);if(original.length!==1||original[0].type!=='n8n-nodes-base.code')throw Error('WRITER_GRAPH_UNCONFIRMED');
 const prefix=`Acuse ${phase}`,names={prepare:`${prefix} — Preparar`,branch:`${prefix} — ¿Registrar?`,call:`${prefix} — Guard`,finish:`${prefix} — Conservar resultado`};
 if(workflow.nodes.some(n=>Object.values(names).includes(n.name)))throw Error('WRITER_RECEIPT_ALREADY_INSTALLED');
 const module=protocol.replaceAll('export function ','function ');if(/\b(?:import|export)\s/.test(module))throw Error('WRITER_PROTOCOL_INVALID');
 const common=`const receipts=(()=>{\n${module}\nreturn {prepareWriterReceipt,finishWriterReceipt};\n})();\n`;
 const prepare=common+`return [{json:receipts.prepareWriterReceipt($input.first().json)}];`;
 const finish=common+`const prepared=$(${JSON.stringify(names.prepare)}).first(0,0).json;return [{json:receipts.finishWriterReceipt(prepared,$input.first().json)}];`;
 const [x,y]=original[0].position??[2000,1000];
 const ops=[
  {type:'addNode',node:{name:names.prepare,type:'n8n-nodes-base.code',typeVersion:2,position:[x+220,y],parameters:{mode:'runOnceForAllItems',jsCode:prepare}}},
  {type:'addNode',node:{name:names.branch,type:'n8n-nodes-base.if',typeVersion:2.2,position:[x+440,y],parameters:{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict'},conditions:[{leftValue:'={{ $json.receiptRequired }}',rightValue:true,operator:{type:'boolean',operation:'equals'}}],combinator:'and'},options:{}}}},
  {type:'addNode',node:{name:names.call,type:'n8n-nodes-base.httpRequest',typeVersion:4.5,position:[x+660,y-100],parameters:{method:'POST',url:'https://publisher.oxigenopuro.com.mx/v1/telegram/writers/report',authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',sendBody:true,specifyBody:'json',jsonBody:'={{ JSON.stringify($json.body) }}',options:{timeout:30000,redirect:{redirect:{followRedirects:false}},response:{response:{responseFormat:'json',neverError:true}}}},credentials:{httpHeaderAuth:guardCredential}}},
  {type:'setNodeSettings',nodeName:names.call,settings:{retryOnFail:false,onError:'continueRegularOutput'}},
  {type:'addNode',node:{name:names.finish,type:'n8n-nodes-base.code',typeVersion:2,position:[x+880,y],parameters:{mode:'runOnceForAllItems',jsCode:finish}}},
 ];
 const next=workflow.connections[source]?.main?.[0]??[];
 for(const edge of next)ops.push({type:'removeConnection',source,target:edge.node,sourceIndex:0,targetIndex:edge.index??0});
 const connect=(from,to,index=0)=>({type:'addConnection',source:from,target:to,sourceIndex:index});
 ops.push(connect(source,names.prepare),connect(names.prepare,names.branch),connect(names.branch,names.call),connect(names.branch,names.finish,1),connect(names.call,names.finish));
 for(const edge of next)ops.push({...connect(names.finish,edge.node),targetIndex:edge.index??0});
 ops.push({type:'addNodeGroup',name:`Acuse de fase ${phase}`,nodeNames:Object.values(names),description:'Registra el resultado verificado después de las escrituras; conserva la respuesta editorial si el acuse es incierto.'});
 return {names,operations:ops};
}
