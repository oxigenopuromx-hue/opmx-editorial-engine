// Candidate transformation of the current Code-node category resolver.
// It is not safe to deploy until canonical principal_id is preserved by the
// normalizer and authenticated live preflight enforces scope and completeness.
export function patchWriterResolverId(source,site) {
 if(typeof source!=='string'||!['OPURO','OPOL','LIBERAL'].includes(site))throw Error('CATEGORY_RESOLVER_INVALID');
 const marker='const exact=rows.find(x=>norm(x.name)===norm(requested));';
 if(source.split(marker).length!==2)throw Error('CATEGORY_RESOLVER_SOURCE_CHANGED');
 const key=site.toLowerCase();
 const replacement=`const requestedId=c.categories?.${key}?.principal_id;
if(requestedId!==undefined&&(!Number.isSafeInteger(requestedId)||requestedId<1))throw Error('CATEGORY_ID_INVALID');
const matches=rows.filter(x=>norm(x.name)===norm(requested));
if(requestedId===undefined&&matches.length>1)throw Error('CATEGORY_SELECTION_AMBIGUOUS');
const exact=requestedId===undefined?matches[0]:matches.find(x=>Number(x.id)===requestedId);
if(requestedId!==undefined&&!exact)throw Error('CATEGORY_ID_UNCONFIRMED');`;
 return source.replace(marker,replacement);
}
