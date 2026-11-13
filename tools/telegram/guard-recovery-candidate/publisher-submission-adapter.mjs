// Pure adapters embedded in the existing n8n MCP graph. The authenticated
// routing ledger supplies identity; source documents cannot choose it.
const submissionId=/^tg_[a-f0-9]{64}$/;
const hash=/^[a-f0-9]{64}$/;
export function preparePublisherSubmission(request,payload,identity,executionId){
 const isTelegram=submissionId.test(request?.request_id??'');
 if(!isTelegram)return {submissionRequired:false,payload};
 if(!['publicar_nota_opmx','preparar_borrador_opmx'].includes(request?.operation)||request.operation==='publicar_nota_opmx'&&request.confirmar_publicacion!=='PUBLICAR'||!identity||identity.owner!==identity.chat||!/^[1-9][0-9]{0,15}$/.test(identity.owner??'')||!/^\d{1,32}$/.test(executionId??'')||payload?.request_id!==request.request_id||payload.CREAR_EN!==request.destino||payload.PUBLICAR!==false||typeof payload.master?.SEO?.SLUG!=='string')throw Error('SUBMISSION_SCOPE_UNCONFIRMED');
 return {submissionRequired:true,payload,body:{owner:identity.owner,chat:identity.chat,requestId:request.request_id,phase:request.operation==='publicar_nota_opmx'?'PUBLISH':'DRAFT',destination:request.destino,slug:payload.master.SEO.SLUG,executionId}};
}
export function finishPublisherSubmission(prepared,response,request){
 const fail=()=>({submissionAccepted:false,earlyResponse:true,continueWriter:false,payload:prepared?.payload,response:{httpStatus:200,response:{jsonrpc:'2.0',id:request?.id??null,result:{content:[{type:'text',text:'La aceptación del envío no pudo confirmarse. No reenviar; consultar el paquete.'}],structuredContent:{status:'SUBMISSION_UNCONFIRMED',request_id:request?.request_id,retryPermitted:false},isError:true}}}});
 const r=response?.body??response,b=prepared?.body;
 if(prepared?.submissionRequired===true&&b&&hash.test(b.fingerprint??'')&&!response?.error&&(response?.statusCode===undefined||response.statusCode===200)&&r?.status==='SUBMISSION_SYNC_REQUIRED'&&r.legacyHistorical===true&&r.requestId===b.requestId&&r.phase===b.phase&&r.destination===b.destination&&r.slug===b.slug&&r.fingerprint===b.fingerprint&&/^tg_[a-f0-9]{40}$/.test(r.packageId??'')&&Number.isSafeInteger(r.revision)&&r.revision>0&&r.retryPermitted===false&&r.writeAuthorized===false)return {submissionAccepted:false,earlyResponse:false,synchronousLegacy:true,continueWriter:true,payload:prepared.payload};
 if(prepared?.submissionRequired!==true||!b||!hash.test(b.fingerprint??'')||response?.error||response?.statusCode!==undefined&&response.statusCode!==200||!['SUBMISSION_RECORDED','SUBMISSION_REPLAY'].includes(r?.status)||r.requestId!==b.requestId||r.phase!==b.phase||r.destination!==b.destination||r.slug!==b.slug||r.fingerprint!==b.fingerprint||!/^tg_[a-f0-9]{40}$/.test(r.packageId??'')||!Number.isSafeInteger(r.revision)||r.revision<1||!hash.test(r.submissionHash??'')||r.retryPermitted!==false||r.writeAuthorized!==false)return fail();
 const data={status:b.phase+'_SUBMITTED',package_id:r.packageId,revision:r.revision,request_id:r.requestId,phase:r.phase,destino:r.destination,submission_hash:r.submissionHash,result_pending:true,retryPermitted:false,writeAuthorized:false,message:'Envío aceptado y registrado; el escritor continúa. Consultar leer_paquete_telegram_opmx sin volver a enviar.'};
 return {submissionAccepted:true,earlyResponse:true,continueWriter:r.status==='SUBMISSION_RECORDED',payload:prepared.payload,body:b,response:{httpStatus:200,response:{jsonrpc:'2.0',id:request.id,result:{content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:false}}}};
}
export function preparePublisherSubmissionReport(response,context){
 if(context?.submissionAccepted!==true||context.continueWriter!==true)return {reportRequired:false,response};
 const r=response?.response?.result?.structuredContent,b=context.body;
 const notice=b.phase==='PUBLISH'?r?.telegram_publication_notice:r?.telegram_draft_notice;
 return {reportRequired:true,response,body:{requestId:b.requestId,executionId:b.executionId,fingerprint:b.fingerprint,outcome:r?.status==='SUCCESS'?'SUCCESS':r?.writesStarted===false?'REJECTED':'UNCERTAIN',telegramNotice:notice==='SENT'?'SENT':notice==='UNCERTAIN'?'UNCERTAIN':'NOT_RECORDED'}};
}
export function publicPublisherSubmissionResult(result,packageId,revision){
 if(result===undefined)return undefined;
 const fail=()=>({schema:'opmx.publisher-submission-result.v1',status:'SUBMISSION_UNCONFIRMED',package_id:packageId,revision,retryPermitted:false,write_authorized:false});
 if(!result||result.schema!=='opmx.publisher-submission-result.v1'||result.packageId!==packageId||result.revision!==revision||result.retryPermitted!==false||result.writeAuthorized!==false||!['SUBMISSION_UNCONFIRMED','SUBMISSION_PENDING','SUBMISSION_UNCERTAIN','WRITER_RESULT_CONFIRMED'].includes(result.status)||result.currentCmsState!=='NOT_CHECKED'||result.publicVisibility!=='NOT_CHECKED')return fail();
 if(result.status==='SUBMISSION_UNCONFIRMED')return fail();
 if(!submissionId.test(result.requestId??'')||!['DRAFT','PUBLISH'].includes(result.phase)||!['OPURO','OPOL','AMBOS','LIBERAL','OPURO,LIBERAL','OPOL,LIBERAL','TODOS'].includes(result.destination)||!hash.test(result.submissionHash??'')||!['NOT_RECORDED','SENT','UNCERTAIN'].includes(result.telegramNotice)||typeof result.slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.slug))return fail();
 const out={schema:result.schema,status:result.status,package_id:packageId,revision,request_id:result.requestId,phase:result.phase,destino:result.destination,slug:result.slug,submission_hash:result.submissionHash,telegram_notice:result.telegramNotice,current_cms_state:'NOT_CHECKED',public_visibility:'NOT_CHECKED',retryPermitted:false,write_authorized:false};
 if(result.status==='WRITER_RESULT_CONFIRMED'){
  const sites=result.destination==='TODOS'?['OPURO','OPOL','LIBERAL']:result.destination==='AMBOS'?['OPURO','OPOL']:result.destination.split(',');
  if(result.historical!==true||!hash.test(result.receiptHash??'')||!Array.isArray(result.targets)||result.targets.length!==sites.length||result.targets.some((t,i)=>t?.destination!==sites[i]||!Number.isSafeInteger(t.postId)||t.postId<1||t.slug!==result.slug||t.status!==(result.phase==='PUBLISH'?'publish':'draft')))return fail();
  out.historical=true;out.receipt_hash=result.receiptHash;out.targets=result.targets.map(t=>({destination:t.destination,post_id:t.postId,slug:t.slug,status:t.status}));
 }
 return out;
}
