// Candidate transformer for the existing n8n category resolver Code nodes.
// Input is a single node's JavaScript, never a full workflow or credentials.
// Fail closed if the active source has changed; inspect before applying.
export function rejectAmbiguousCategoryMatches(source) {
  if (typeof source !== 'string') throw Error('CATEGORY_RESOLVER_INVALID');
  const old = 'const exact=rows.find(x=>norm(x.name)===norm(requested));';
  if (source.split(old).length !== 2) throw Error('CATEGORY_RESOLVER_SOURCE_CHANGED');
  const replacement = `const exactMatches=rows.filter(x=>norm(x.name)===norm(requested));
if(exactMatches.length>1) throw new Error('CATEGORY_SELECTION_AMBIGUOUS');
const exact=exactMatches[0];`;
  return source.replace(old, replacement);
}
