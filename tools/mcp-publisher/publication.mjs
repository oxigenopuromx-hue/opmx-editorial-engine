// Publication acts only on fresh, successfully verified drafts from the protected
// child in this SAME request. No arbitrary post IDs, edits, or retry endpoint.
export function preparePublication(request,receipt) {
 if(request?.operation!=='publicar_nota_opmx'||request.confirmar_publicacion!=='PUBLICAR')throw Error('Falta orden PUBLICAR');
 if(!/^[A-Za-z0-9_-]{16,128}$/.test(request.request_id??'')||receipt?.request_id!==request.request_id||receipt.status!=='SUCCESS'||receipt.mode!=='DRAFT')throw Error('Entrega de borradores no confirmada');
 const requested=request.destino==='AMBOS'?['OPURO','OPOL']:['OPURO','OPOL'].includes(request.destino)?[request.destino]:[];
 if(!requested.length)throw Error('Destino inválido');
 const targets={};let slug=null;
 for(const destination of requested){const key=destination==='OPURO'?'oxigenopuro':'oxigenopolitico';const r=receipt.targets?.[key];const id=receipt[destination==='OPURO'?'post_id_opuro':'post_id_opol'];
  if(r?.status!=='DRAFT'||!Number.isSafeInteger(id)||id<1||r.post_id!==id||typeof r.slug!=='string'||r.slug.length>200||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.slug)||slug&&r.slug!==slug)throw Error('Borrador o identidad de destino inválido');
  slug=r.slug;targets[destination]={post_id:id,status:'NOT_ATTEMPTED'};
 }
 return {operation:request.operation,request_id:request.request_id,destino:request.destino,slug,requested,targets,retryPermitted:false};
}

export function prepareExistingPublication(request) {
 if(request?.operation!=='publicar_borradores_opmx'||request.confirmar_publicacion!=='PUBLICAR'||!/^[A-Za-z0-9_-]{16,128}$/.test(request.request_id??'')||typeof request.slug!=='string'||request.slug.length>200||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(request.slug))throw Error('Identidad de borradores existentes inválida');
 const requested=request.destino==='AMBOS'?['OPURO','OPOL']:['OPURO','OPOL'].includes(request.destino)?[request.destino]:[];
 if(!requested.length)throw Error('Destino inválido');
 const targets={};for(const d of requested){const id=request['post_id_'+d.toLowerCase()];if(!Number.isSafeInteger(id)||id<1)throw Error('Falta ID original');targets[d]={post_id:id,status:'NOT_ATTEMPTED'};}
 return {operation:request.operation,request_id:request.request_id,destino:request.destino,slug:request.slug,requested,targets,retryPermitted:false};
}

export function editorialSnapshot(post) {
 // Dates, permalinks, generated SEO head and capabilities legitimately change
 // on publication. Editorial data must remain exactly as read before publishing.
 const meta={};for(const key of ['rank_math_title','rank_math_description','rank_math_focus_keyword','opmx_editorial','oxpuro_hero_media_id','oxpuro_editorial','site-post-title'])if(Object.hasOwn(post.meta??{},key))meta[key]=post.meta[key];
 return {id:post.id,slug:post.slug,type:post.type,title:post.title?.raw,content:post.content?.raw,excerpt:post.excerpt?.raw,author:post.author,featured_media:post.featured_media,categories:[...(post.categories??[])].sort((a,b)=>a-b),tags:[...(post.tags??[])].sort((a,b)=>a-b),meta};
}

export function checkPublicationPreflight(plan,responses,opolCategory,guards) {
 const next=JSON.parse(JSON.stringify(plan));
 for(const destination of plan.requested){const r=responses[destination],p=r?.body,g=guards?.[destination];
  if(g?.statusCode!==200||g.body?.status!=='reported'||String(g.body?.postId)!==String(plan.targets[destination].post_id))throw Error('Guard no confirma identidad del post: '+destination);
  const existingPublic=plan.operation==='publicar_borradores_opmx'&&p?.status==='publish';
  if(r?.statusCode!==200||!p||p.id!==plan.targets[destination].post_id||p.slug!==plan.slug||!(p.status==='draft'||existingPublic)||p.type!=='post'||typeof p.title?.raw!=='string'||!p.title.raw.trim()||typeof p.content?.raw!=='string'||!p.content.raw.includes('<!-- wp:')||p.content.raw.includes('{{OPMX:')||!Number.isSafeInteger(p.featured_media)||p.featured_media<1||!Number.isSafeInteger(p.author)||p.author<1||!Array.isArray(p.categories)||!p.categories.length||!Array.isArray(p.tags))throw Error('Preflight de borradores no coincide: '+destination);
  for(const key of ['rank_math_title','rank_math_description','rank_math_focus_keyword'])if(typeof p.meta?.[key]!=='string'||!p.meta[key].trim())throw Error('SEO no confirmado: '+destination);
  if(destination==='OPURO'&&(!Number.isSafeInteger(p.meta?.oxpuro_hero_media_id)||p.meta.oxpuro_hero_media_id<1||!p.meta.oxpuro_editorial))throw Error('Hero no confirmado');
  let path='/'+plan.slug+'/';
  if(destination==='OPOL'){const c=opolCategory?.body;const primary=p.meta?.opmx_editorial?.primary_category;
   if(opolCategory?.statusCode!==200||!c||!p.categories.includes(c.id)||Number(primary)!==c.id||typeof c.slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.slug))throw Error('Ruta de categoría OPOL no confirmada');
   path='/'+c.slug+path;
  }
  next.targets[destination]={...next.targets[destination],guard_verified:true,before:editorialSnapshot(p),status:existingPublic?'PUBLISHED':'NOT_ATTEMPTED',cms_verified:existingPublic,public_url:'https://'+(destination==='OPURO'?'oxigenopuro.com.mx':'oxigenopolitico.com.mx')+path};
 }
 return next;
}

export function recordPublication(plan,destination,response) {
 const next=JSON.parse(JSON.stringify(plan)),t=next.targets[destination],p=response?.body;
 if(!t?.before)throw Error('Falta preflight');
 // Even a lost POST response is reconciled by a separate authenticated GET.
 // Never resend the POST automatically.
 const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 const ok=response?.statusCode===200&&p?.status==='publish'&&stable(editorialSnapshot(p))===stable(t.before);
 t.status=ok?'PUBLISHED':'UNCERTAIN';t.cms_verified=ok;
 return next;
}

export function recordPublicVisibility(plan,destination,response) {
 const next=JSON.parse(JSON.stringify(plan)),t=next.targets[destination];
 if(t.status!=='PUBLISHED')return next;
 const html=response?.body;const escaped=t.public_url.replaceAll('&','&amp;');
 // Exact canonical URL, not a generic 200 error page or an unrelated slug.
 const canonicals=typeof html==='string'?[...html.matchAll(/<link\b[^>]*>/gi)].filter(x=>/\brel=["']canonical["']/i.test(x[0])).map(x=>x[0].match(/\bhref=["']([^"']+)["']/i)?.[1]):[];
 t.public_verified=response?.statusCode===200&&(canonicals.includes(t.public_url)||canonicals.includes(escaped));
 return next;
}

export function summarizePublication(plan) {
 const targets=Object.fromEntries(plan.requested.map(d=>{const t=plan.targets[d];return [d,{post_id:t.post_id,status:t.status,cms_verified:t.cms_verified===true,public_verified:t.public_verified===true,public_url:t.status==='PUBLISHED'?t.public_url:null}];}));
 const rows=Object.values(targets),published=rows.filter(t=>t.status==='PUBLISHED').length;
 const all=published===rows.length&&rows.length>0;
 const status=all?(rows.every(t=>t.public_verified)?'SUCCESS':'PUBLISHED_VISIBILITY_PENDING'):published?'PARTIAL_SUCCESS':'UNCERTAIN';
 return {status,mode:'PUBLISH',request_id:plan.request_id,slug:plan.slug,destino:plan.destino,targets,retryPermitted:false,cache_revalidation:plan.cache_revalidation??'NOT_REQUESTED',message:status==='SUCCESS'?'Publicación y enlaces verificados.':all?'WordPress confirma publicación; falta confirmar visibilidad pública. No reenviar.':'Publicación no confirmada en todos los destinos. Revisar IDs y estados; no reenviar automáticamente.'};
}
