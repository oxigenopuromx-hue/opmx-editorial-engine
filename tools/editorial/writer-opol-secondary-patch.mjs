// Candidate only: requires the authenticated OPOL catalog proof and ID
// preservation. A secondary category must not be sent from caller data alone.
export function patchOpolSecondary(writeExpression,readbackCode) {
 if(typeof writeExpression!=='string'||typeof readbackCode!=='string')throw Error('OPOL_SECONDARY_PATCH_INVALID');
 const old=`categories: [
    Number(
      $('OPOL — Resolver categoría').first().json.category_id
    )
  ],`;
 const replacement=`categories: [
    Number($('OPOL — Resolver categoría').first().json.category_id),
    ...($('Validar y normalizar OPMX MASTER').first().json.canonical.categories.opol.secundaria_id === undefined ? [] : [Number($('Validar y normalizar OPMX MASTER').first().json.canonical.categories.opol.secundaria_id)])
  ],`;
 const marker="!p.categories?.includes($('OPOL — Resolver categoría').first().json.category_id)";
 const readReplacement=marker+"||(c.categories.opol.secundaria_id!==undefined&&!p.categories?.includes(c.categories.opol.secundaria_id))";
 if(writeExpression.split(old).length!==2||readbackCode.split(marker).length!==2)throw Error('OPOL_SECONDARY_SOURCE_CHANGED');
 return {writeExpression:writeExpression.replace(old,replacement),readbackCode:readbackCode.replace(marker,readReplacement)};
}
