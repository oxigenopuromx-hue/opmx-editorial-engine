// Offline candidate: no sends. Validate each target and canonical URL before notice.
import {destinationRegistry,resolveDestinations,destinationLabel} from '../mcp-publisher/destinations.mjs';
const names={OPURO:'OXígeno Puro',OPOL:'OXígeno Político',LIBERAL:'El Liberal'};
function requestTargets(request,identity,operation){
 if(!identity||identity.owner!==identity.chat||!/^[1-9][0-9]{0,15}$/.test(identity.chat??''))return null;
 if(request?.operation!==operation||!/^tg_[a-f0-9]{64}$/.test(request.request_id??''))return null;
 if(operation==='publicar_nota_opmx'&&request.confirmar_publicacion!=='PUBLICAR')return null;
 try{const targets=resolveDestinations(request.destino);if(destinationLabel(targets)!==request.destino)return null;return targets;}catch{return null;}
}
export function prepareDraftNotice(response,request,identity){
 const no={notify:false,response},sites=requestTargets(request,identity,'preparar_borrador_opmx');if(!sites)return no;
 const result=response?.response?.result,v=result?.structuredContent;
 if(result?.isError!==false||v?.status!=='SUCCESS'||v.mode!=='DRAFT'||v.request_id!==request.request_id||v.destino!==request.destino)return no;
 const reg=destinationRegistry(),lines=[];
 for(const d of sites){const key=d.toLowerCase(),id=v[`post_id_${key}`],url=v[`edit_url_${key}`];
  if(v.summary?.[key]!=='DRAFT'||!Number.isSafeInteger(id)||id<1||url!==`${reg[d].cms}/wp-admin/post.php?post=${id}&action=edit`)return no;
  lines.push(`${names[d]}: ${url}`);
 }
 return {notify:true,chatId:identity.chat,text:`OPMX · Borrador listo\n\n${lines.join('\n')}\n\nLas notas están en borrador y no se han publicado.`,response};
}
export function preparePublicationNotice(response,request,identity){
 const no={notify:false,response},sites=requestTargets(request,identity,'publicar_nota_opmx');if(!sites)return no;
 const r=response?.response?.result?.structuredContent;
 if(!r||r.mode!=='PUBLISH'||r.request_id!==request.request_id||r.destino!==request.destino||!['SUCCESS','PUBLISHED_VISIBILITY_PENDING','PARTIAL_SUCCESS','UNCERTAIN'].includes(r.status)||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.slug??''))return no;
 const reg=destinationRegistry(),lines=[];
 for(const d of sites){const t=r.targets?.[d];if(!t||!['PUBLISHED','UNCERTAIN','NOT_ATTEMPTED'].includes(t.status))return no;
  if(t.status==='PUBLISHED'){
   if(t.cms_verified!==true||!Number.isSafeInteger(t.post_id)||t.post_id<1)return no;
   const origin=reg[d].publicOrigin+'/',path=typeof t.public_url==='string'&&t.public_url.startsWith(origin)?t.public_url.slice(origin.length):'';
   if(!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*\/?$/.test(path)||path.replace(/\/$/,'').split('/').at(-1)!==r.slug)return no;
   lines.push(`${names[d]}: publicado en WordPress\n${t.public_url}`);
  }else lines.push(`${names[d]}: ${t.status==='UNCERTAIN'?'resultado incierto; revisar antes de repetir':'publicación no iniciada'}.`);
 }
 const warning=sites.some(d=>r.targets[d].status!=='PUBLISHED')?'\n\nNo vuelvas a enviarla si algún resultado está pendiente o incierto.':'';
 return {notify:true,chatId:identity.chat,text:`OPMX · Resultado de publicación\n\n${lines.join('\n\n')}${warning}`,response};
}
