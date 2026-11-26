// Issue #62. Role selection is content preparation, never publication authority.
// Dimensions must come from decoding the verified original image bytes.
export const IMAGE_ROLE_LIMITS = Object.freeze({images:18,featuredWidth:1200,featuredHeight:630});

export function parseImageRoleCaption(caption='') {
  if(typeof caption!=='string'||caption.length>4096)throw Error('IMAGE_CAPTION_INVALID');
  const lines=caption.replace(/\r\n?/g,'\n').split('\n');
  const first=lines[0].trim();
  const match=/^(hero|thumbnail|destacada)\s*:?$/i.exec(first);
  return {role:match?(match[1].toLowerCase()==='hero'?'HERO':'FEATURED'):null,
    label:match?first:null,caption:match?lines.slice(1).join('\n').trim():caption.trim()};
}

export function selectImageRoles(images) {
  if(!Array.isArray(images)||images.length>IMAGE_ROLE_LIMITS.images)throw Error('IMAGE_COUNT_INVALID');
  const seen=new Set();
  const rows=images.map(image=>{
    if(!image||typeof image.id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(image.id)||seen.has(image.id)||
      !Number.isSafeInteger(image.width)||image.width<1||image.width>100000||
      !Number.isSafeInteger(image.height)||image.height<1||image.height>100000)throw Error('IMAGE_METADATA_INVALID');
    seen.add(image.id);
    return {...image,...parseImageRoleCaption(image.caption??'')};
  });
  if(!rows.length)return {status:'NO_IMAGES',hero:null,featured:null,interiors:[],review:[]};
  const heroLabels=rows.filter(x=>x.role==='HERO'),featuredLabels=rows.filter(x=>x.role==='FEATURED');
  if(heroLabels.length>1)throw Error('MULTIPLE_HERO_LABELS');
  if(featuredLabels.length>1)throw Error('MULTIPLE_FEATURED_LABELS');
  if(rows.length>1&&!heroLabels.length)throw Error('HERO_LABEL_REQUIRED_FOR_MULTIPLE_IMAGES');
  const hero=rows.length===1?rows[0]:heroLabels[0];
  let featured=rows.length>1?featuredLabels[0]:null;
  let method=featured?'EXPLICIT_LABEL':null;
  if(!featured&&rows.length>1){
    const candidates=rows.filter(x=>x.id!==hero.id&&x.width===1200&&x.height===630);
    if(candidates.length>1)throw Error('FEATURED_DIMENSIONS_AMBIGUOUS');
    if(candidates.length===1){featured=candidates[0];method='EXACT_1200_630';}
  }
  const featuredSource=featured??hero;
  const interiors=rows.filter(x=>x.id!==hero.id&&x.id!==featured?.id);
  return {status:'IMAGE_ROLES_SELECTED',hero:{id:hero.id,method:rows.length===1?'SINGLE_IMAGE':'EXPLICIT_LABEL'},
    featured:{id:featuredSource.id,method:method??'DERIVE_FROM_HERO',width:1200,height:630,
      prepare:featuredSource.width===1200&&featuredSource.height===630?'VERIFY_ORIGINAL':'EXISTING_FRAMING_PIPELINE'},
    interiors:interiors.map(x=>({id:x.id,caption:x.caption})),
    review:rows.map(x=>({id:x.id,width:x.width,height:x.height,roles:[...(x.id===hero.id?['HERO']:[]),
      ...(x.id===featuredSource.id?['FEATURED_SOURCE']:[]),...(interiors.some(y=>y.id===x.id)?['INTERIOR']:[])],
      caption:x.caption}))};
}
