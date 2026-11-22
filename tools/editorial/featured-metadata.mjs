// Ensure the canonical featured-image metadata exists for every destination.
// Only structural metadata is completed. Never fabricate an image, URL, ALT,
// publishing authorization, or change an existing nonempty description.
const TOKENS={OPURO:'{{OPMX:DESTACADA_OPURO}}',OPOL:'{{OPMX:DESTACADA_OPOL}}'};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function prepareFeaturedMetadata(master,{featuredAlt,destinations}={}) {
 if(!object(master)||!object(master.IMAGENES)) throw Error('FEATURED_METADATA_IMAGES_REQUIRED');
 if(destinations!==undefined&&(!Array.isArray(destinations)||!destinations.length||destinations.some(d=>!['OPURO','OPOL','LIBERAL','HORIZONTE'].includes(d))||new Set(destinations).size!==destinations.length))throw Error('FEATURED_METADATA_DESTINATIONS_INVALID');
 const result=structuredClone(master), images=result.IMAGENES;
 const targets=['OPURO',...(destinations?.includes('OPOL')?['OPOL']:[])];
 for(const target of targets){
  const key='DESTACADA_'+target,token=TOKENS[target];
  if(images[key]===undefined) images[key]={};
  const featured=images[key];
  if(!object(featured))throw Error('FEATURED_METADATA_INVALID');
  if(featured.URL===undefined||featured.URL===null||featured.URL==='') featured.URL=token;
  if(featured.URL!==token)throw Error('FEATURED_METADATA_URL_INVALID');
  if(featured.ALT===undefined||featured.ALT===null||featured.ALT==='') {
   if(typeof featuredAlt!=='string'||!featuredAlt.trim())throw Error('FEATURED_METADATA_ALT_REQUIRED');
   featured.ALT=featuredAlt.trim();
  }
  if(typeof featured.ALT!=='string'||!featured.ALT.trim())throw Error('FEATURED_METADATA_ALT_REQUIRED');
 }
 return result;
}
