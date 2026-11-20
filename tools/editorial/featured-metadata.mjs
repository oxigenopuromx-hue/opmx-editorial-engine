// Ensure the canonical featured-image metadata exists for every destination.
// Only structural metadata is completed. Never fabricate an image, URL, ALT,
// publishing authorization, or change an existing nonempty description.
const TOKEN='{{OPMX:DESTACADA_OPURO}}';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function prepareFeaturedMetadata(master,{featuredAlt}={}) {
 if(!object(master)||!object(master.IMAGENES)) throw Error('FEATURED_METADATA_IMAGES_REQUIRED');
 const result=structuredClone(master), images=result.IMAGENES;
 if(images.DESTACADA_OPURO===undefined) images.DESTACADA_OPURO={};
 const featured=images.DESTACADA_OPURO;
 if(!object(featured))throw Error('FEATURED_METADATA_INVALID');
 if(featured.URL===undefined||featured.URL===null||featured.URL==='') featured.URL=TOKEN;
 if(featured.URL!==TOKEN)throw Error('FEATURED_METADATA_URL_INVALID');
 if(featured.ALT===undefined||featured.ALT===null||featured.ALT==='') {
  if(typeof featuredAlt!=='string'||!featuredAlt.trim())throw Error('FEATURED_METADATA_ALT_REQUIRED');
  featured.ALT=featuredAlt.trim();
 }
 if(typeof featured.ALT!=='string'||!featured.ALT.trim())throw Error('FEATURED_METADATA_ALT_REQUIRED');
 return result;
}
