// Stable additions to the existing encoded blocker catalog. Never forward raw
// validator errors, text or exception details to Telegram.
export const featuredBlockerEntries=[
 [47,'MASTER_FEATURED_OPOL_URL_MISSING','VALIDATION_FAILED','URL de destacada OPOL','Falta el campo URL de la destacada de OPOL en el archivo editorial.','El Motor debe completar el campo desde la imagen acreditada y volver a validar. No hace falta reenviar las fuentes.','technical'],
 [48,'MASTER_FEATURED_OPOL_ALT_MISSING','VALIDATION_FAILED','Texto alternativo de destacada OPOL','Falta el texto alternativo de la destacada de OPOL en el archivo editorial.','El Motor debe completar el campo con una descripción verificada y volver a validar. No hace falta reenviar las fuentes.','technical'],
 [49,'MASTER_FEATURED_OPURO_URL_MISSING','VALIDATION_FAILED','URL de destacada OPURO','Falta el campo URL de la destacada de OPURO en el archivo editorial.','El Motor debe completar el campo desde la imagen acreditada y volver a validar. No hace falta reenviar las fuentes.','technical'],
 [50,'MASTER_FEATURED_OPURO_ALT_MISSING','VALIDATION_FAILED','Texto alternativo de destacada OPURO','Falta el texto alternativo de la destacada de OPURO en el archivo editorial.','El Motor debe completar el campo con una descripción verificada y volver a validar. No hace falta reenviar las fuentes.','technical'],
 [51,'MASTER_FEATURED_OPOL_METADATA_MISSING','VALIDATION_FAILED','URL y texto alternativo de destacada OPOL','Faltan la URL y el texto alternativo de la destacada de OPOL en el archivo editorial.','El Motor debe completar ambos campos desde la imagen acreditada y volver a validar. No hace falta reenviar las fuentes.','technical'],
 [52,'MASTER_FEATURED_OPURO_METADATA_MISSING','VALIDATION_FAILED','URL y texto alternativo de destacada OPURO','Faltan la URL y el texto alternativo de la destacada de OPURO en el archivo editorial.','El Motor debe completar ambos campos desde la imagen acreditada y volver a validar. No hace falta reenviar las fuentes.','technical'],
];

// A result can describe several other missing fields; do not hide them behind
// a narrower notice. Only map exact, bounded, pre-write validation evidence.
export function featuredDiagnosticFromPreflight(result) {
 if(!result||result.status!=='VALIDATION_FAILED'||result.code!=='REQUIRED_FIELDS'||result.writesStarted!==false||!Array.isArray(result.fields)||!result.fields.length||new Set(result.fields).size!==result.fields.length)return null;
 const fields=[...result.fields].sort(),matches={
  'IMAGENES.DESTACADA_OPOL.URL':'MASTER_FEATURED_OPOL_URL_MISSING',
  'IMAGENES.DESTACADA_OPOL.ALT':'MASTER_FEATURED_OPOL_ALT_MISSING',
  'IMAGENES.DESTACADA_OPURO.URL':'MASTER_FEATURED_OPURO_URL_MISSING',
  'IMAGENES.DESTACADA_OPURO.ALT':'MASTER_FEATURED_OPURO_ALT_MISSING',
  'IMAGENES.DESTACADA_OPOL.ALT|IMAGENES.DESTACADA_OPOL.URL':'MASTER_FEATURED_OPOL_METADATA_MISSING',
  'IMAGENES.DESTACADA_OPURO.ALT|IMAGENES.DESTACADA_OPURO.URL':'MASTER_FEATURED_OPURO_METADATA_MISSING',
 };
 const code=matches[fields.join('|')];return code?{code,itemOrdinal:0,version:1}:null;
}
