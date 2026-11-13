// Fixed diagnostics are observations, never publication authority or free text.
export const BLOCKER_DIAGNOSTIC_BASE=2**40;
export const BLOCKER_DIAGNOSTIC_STRIDE=16384;
export const BLOCKER_DIAGNOSTIC_ITEM_STRIDE=256;
export const BLOCKER_DIAGNOSTIC_MAX_REVISION=4294967295;
export const BLOCKER_DIAGNOSTIC_MAX_ITEMS=40;
export const BLOCKER_DIAGNOSTIC_ENTRIES=Object.freeze([
 [1,'IMAGE_CREDIT_REQUIRED','MEDIA_FAILED','Crédito obligatorio de la imagen','Falta un crédito que es obligatorio para esta imagen.','Indica el crédito o la procedencia que falta. Si confirmaste que se generó con IA, debe identificarse como tal; una fotografía ordinaria no exige inventar un crédito.','correct'],
 [2,'IMAGE_ORIGIN_UNCLEAR','MEDIA_FAILED','Origen de la imagen','No quedó claro el origen o tratamiento de la imagen.','Aclara si es fotografía, composición de fotografías o imagen generada con IA, e indica la procedencia conocida. No la declares como IA si no lo es.','correct'],
 [3,'IMAGE_FILE_UNREADABLE','MEDIA_FAILED','Archivo de imagen','No pude abrir o verificar el archivo de imagen.','Adjunta nuevamente el original de esa imagen en JPG o PNG y comprueba que se abra correctamente.','correct'],
 [4,'IMAGE_FORMAT_UNSUPPORTED','MEDIA_FAILED','Formato de imagen','El formato del archivo no es compatible con el procesamiento disponible.','Adjunta una copia en JPG o PNG conservando el original.','correct'],
 [5,'IMAGE_DIMENSIONS_INVALID','MEDIA_FAILED','Dimensiones de imagen','La imagen no cumple las dimensiones técnicas requeridas.','Aporta una imagen de tamaño suficiente para preparar el hero y la destacada sin deformarla.','correct'],
 [6,'IMAGE_CROP_UNVERIFIED','MEDIA_FAILED','Encuadre de imagen','No pude comprobar un recorte que preserve el contenido de la imagen.','Indica el encuadre deseado o aporta otra imagen que permita el formato requerido.','correct'],
 [7,'IMAGE_GENERATION_UNAVAILABLE','MEDIA_FAILED','Herramienta de imagen','La herramienta necesaria para generar o comprobar la imagen no está disponible.','Puedes adjuntar una imagen ya preparada; si prefieres generarla, se requiere resolver primero la disponibilidad de la herramienta.','correct'],
 [8,'IMAGE_GENERATION_FAILED','MEDIA_FAILED','Generación de imagen','La generación de la imagen falló o no produjo un archivo verificable.','Aporta el archivo final si ya lo tienes o solicita revisar el fallo de generación; conserva este paquete.','correct'],
 [9,'IMAGE_AI_DISCLOSURE_REQUIRED','MEDIA_FAILED','Identificación de imagen con IA','La imagen está confirmada como generada con IA, pero falta identificarla de esa forma.','El Motor debe añadir o conservar la identificación y el crédito estándar de IA antes de validar. No hace falta reenviar los materiales ni repetir una confirmación ya acreditada.','technical'],
 [10,'SOURCE_URL_UNAVAILABLE','SOURCE_UNAVAILABLE','Enlace de fuente','No pude recuperar el contenido del enlace de fuente.','Pega el texto íntegro o aporta un enlace accesible a la misma fuente.','correct'],
 [11,'SOURCE_PDF_UNREADABLE','SOURCE_UNAVAILABLE','Documento PDF','No pude extraer o verificar el texto del PDF.','Adjunta un PDF legible o pega el texto íntegro del documento.','correct'],
 [12,'SOURCE_TEXT_MISSING','CONTENT_INSUFFICIENT','Texto de fuente','Falta texto suficiente de la fuente para preparar la nota.','Pega el contenido íntegro que deseas utilizar o agrega la fuente faltante.','correct'],
 [13,'SOURCE_TEXT_TRUNCATED','CONTENT_INSUFFICIENT','Integridad del texto','El texto disponible está incompleto o cortado.','Aporta la parte faltante o el texto íntegro en este mismo paquete.','correct'],
 [14,'CONTENT_TOPICS_MIXED','COHERENCE_REQUIRED','Coherencia de materiales','Los materiales contienen temas distintos y no hay una selección editorial clara.','Indica qué materiales corresponden a esta nota. Revisa los elementos y descarta sólo los que decidas excluir antes de pedir otra vista.','correct'],
 [15,'CONTENT_FACTS_MISSING','CONTENT_INSUFFICIENT','Información de la nota','Falta información necesaria que no puedo completar sin inventarla.','Aporta los datos faltantes de la fuente o aclara el alcance de la nota.','correct'],
 [16,'FILE_INTEGRITY_MISMATCH','INTEGRITY_FAILED','Integridad del archivo','Los bytes o la huella del archivo no coinciden con el original registrado.','Conserva el original y adjunta de nuevo el archivo afectado; no reconstruyas su contenido de memoria.','correct'],
 [17,'FILE_ORIGINAL_MISSING','INTEGRITY_FAILED','Archivo original','No se confirmó la recepción del archivo original.','Revisa los elementos pendientes y adjunta el original faltante en este mismo paquete.','correct'],
 [18,'MASTER_TAGS_MISSING','VALIDATION_FAILED','Etiquetas editoriales','El archivo editorial no contiene etiquetas válidas.','Es una corrección del Motor: debe completar las etiquetas antes de enviar. No hace falta reenviar las fuentes.','technical'],
 [19,'MASTER_EXCERPT_MISSING','VALIDATION_FAILED','Extracto','El archivo editorial no contiene un extracto válido.','Es una corrección del Motor: debe completar el extracto con el material autorizado. No hace falta reenviar las fuentes.','technical'],
 [20,'MASTER_TITLE_INVALID','VALIDATION_FAILED','Título','El título no superó la validación técnica aplicable.','Se debe corregir el título según el campo rechazado, conservando el texto autorizado y su modalidad.','technical'],
 [21,'MASTER_SUBTITLE_TOO_LONG','VALIDATION_FAILED','Subtítulo','El subtítulo supera el límite técnico permitido.','Indica un subtítulo más corto o aclara su separación del cuerpo. No se truncará silenciosamente.','correct'],
 [22,'MASTER_CATEGORY_INVALID','VALIDATION_FAILED','Categoría del destino','La categoría no es válida para el sitio de destino.','Se debe elegir una categoría del catálogo de ese sitio; no reutilizar IDs de otro medio.','technical'],
 [23,'MASTER_STRUCTURE_INVALID','VALIDATION_FAILED','Estructura editorial','La estructura del archivo no cumple el perfil editorial acreditado.','El Motor debe corregir el campo o estructura rechazados sin cambiar la modalidad elegida.','technical'],
 [24,'LITERAL_TEXT_MISMATCH','VALIDATION_FAILED','Texto literal','El contenido preparado no coincide con el original autorizado en modo literal.','Se debe reconstruir el archivo desde el original completo, sin omitir, resumir ni reescribir su contenido.','technical'],
 [25,'AUTHOR_PERMISSION_DENIED','DRAFT_FAILED','Autor o permisos','No se confirmó el autor o el permiso requerido en el destino.','Requiere revisar la configuración del autor y los permisos del sitio. Conserva el paquete y consulta su estado antes de otro envío.','review'],
 [26,'REQUEST_CONFLICT','DRAFT_FAILED','Identidad de la solicitud','La solicitud entra en conflicto con un intento o publicación ya registrados.','Consulta /estado. Se debe conciliar la solicitud original y conservar sus IDs antes de continuar.','review'],
 [27,'PUBLISHER_REJECTED_BEFORE_WRITE','DRAFT_FAILED','Validación de Publisher','Publisher rechazó esta entrega antes de iniciar escrituras, según su respuesta explícita.','Se debe corregir el rechazo indicado y conservar la misma solicitud; no cambiar la clave para eludir el bloqueo.','review'],
 [28,'PUBLISHER_RESULT_UNCERTAIN','DRAFT_UNCERTAIN','Resultado de Publisher','El resultado de Publisher no quedó confirmado.','Consulta /estado y espera la conciliación de la solicitud. No repitas el envío ni abras un paquete nuevo para publicarla.','review'],
 [29,'PUBLISHER_PARTIAL_RESULT','DRAFT_UNCERTAIN','Resultado por destino','Sólo se confirmó una parte de los destinos solicitados.','Consulta /estado y revisa los destinos originales. No vuelvas a crear los destinos que ya estén confirmados.','review'],
 [30,'PREVIEW_DELIVERY_UNCONFIRMED','INTERNAL_ERROR','Entrega de vista previa','No quedó confirmada la entrega completa de la vista previa.','Consulta /estado y conserva esta revisión. Se debe comprobar la entrega antes de solicitar otra vista o confirmar cambios.','review'],
 [31,'PREVIEW_CONTEXT_UNCONFIRMED','INTERNAL_ERROR','Contexto de recuperación','No pude confirmar la revisión o el contexto requerido para preparar la vista.','Consulta /estado y revisa que esté abierto el paquete y la revisión esperados.','review'],
 [32,'TOOL_UNAVAILABLE','INTERNAL_ERROR','Herramienta del flujo','Una herramienta necesaria para continuar no está disponible en esta ejecución.','Requiere revisar la herramienta o el catálogo del servicio. Conserva el paquete; no hace falta reenviar sus fuentes.','technical'],
 [33,'INTERNAL_PROCESSING_ERROR','INTERNAL_ERROR','Procesamiento técnico','El flujo se detuvo por un fallo técnico comprobado.','Conserva el paquete y consulta /estado. Se debe revisar el fallo técnico de esta revisión antes de repetir el procesamiento.','technical'],
 [34,'IMAGE_FAILURE_UNSPECIFIED','MEDIA_FAILED','Imagen','Se detuvo la preparación de imagen, pero no quedó registrada una causa más específica.','Conserva la imagen y consulta /estado. Se necesita revisar el diagnóstico de esta revisión; no asumas que falta crédito ni que la imagen es de IA.','review'],
 [35,'SOURCE_FAILURE_UNSPECIFIED','SOURCE_UNAVAILABLE','Fuente','No pudo verificarse una fuente y no quedó registrado el motivo específico.','Consulta /estado y conserva el material. Se requiere identificar la fuente y el fallo antes de cambiarla.','review'],
 [36,'VALIDATION_FAILURE_UNSPECIFIED','VALIDATION_FAILED','Validación','La validación falló y no quedó registrado el campo concreto.','Es necesario recuperar el resultado del validador de esta revisión. No hace falta reenviar todas las fuentes.','technical'],
 [37,'IMAGE_FILE_MISSING','MEDIA_FAILED','Imagen requerida','No se encontró una imagen requerida para preparar la entrega.','Adjunta la imagen que corresponda a la nota o confirma expresamente la opción de generarla, si está disponible.','correct'],
 [38,'CONTENT_SOURCES_CONTRADICT','COHERENCE_REQUIRED','Contradicción de fuentes','Las fuentes contienen datos incompatibles que requieren aclaración.','Aclara qué dato está autorizado o aporta una fuente que resuelva la contradicción.','correct'],
 [39,'PUBLISHER_PERMISSION_DENIED','DRAFT_FAILED','Permiso del destino','El sitio de destino rechazó el permiso de la operación.','Se deben revisar las credenciales o permisos del destino; conserva la solicitud y consulta /estado antes de repetirla.','review'],
 [40,'PACKAGE_REVISION_CONFLICT','INTERNAL_ERROR','Revisión del paquete','La revisión solicitada ya no coincide con el estado del paquete.','Consulta /estado y continúa sólo con la revisión vigente; no reutilices confirmaciones anteriores.','review'],
 [41,'MASTER_CATEGORY_INVALID_OPURO','VALIDATION_FAILED','Categoría de OPURO','La categoría indicada no es válida para OPURO.','El Motor debe elegir una categoría del catálogo de OPURO, sin reutilizar IDs de otro sitio. No hace falta reenviar las fuentes.','technical'],
 [42,'MASTER_CATEGORY_INVALID_OPOL','VALIDATION_FAILED','Categoría de OPOL','La categoría indicada no es válida para OPOL.','El Motor debe elegir una categoría del catálogo de OPOL, sin reutilizar IDs de otro sitio. No hace falta reenviar las fuentes.','technical'],
 [43,'MASTER_CATEGORY_INVALID_LIBERAL','VALIDATION_FAILED','Categoría de LIBERAL','La categoría indicada no es válida para LIBERAL.','El Motor debe elegir una categoría del catálogo de LIBERAL, sin reutilizar IDs de otro sitio. No hace falta reenviar las fuentes.','technical'],
 [44,'PUBLISHER_PERMISSION_DENIED_OPURO','DRAFT_FAILED','Permiso de OPURO','OPURO rechazó el permiso necesario para esta operación.','Se deben revisar las credenciales o permisos de OPURO. Conserva la solicitud original y consulta /estado antes de otro envío.','review'],
 [45,'PUBLISHER_PERMISSION_DENIED_OPOL','DRAFT_FAILED','Permiso de OPOL','OPOL rechazó el permiso necesario para esta operación.','Se deben revisar las credenciales o permisos de OPOL. Conserva la solicitud original y consulta /estado antes de otro envío.','review'],
 [46,'PUBLISHER_PERMISSION_DENIED_LIBERAL','DRAFT_FAILED','Permiso de LIBERAL','LIBERAL rechazó el permiso necesario para esta operación.','Se deben revisar las credenciales o permisos de LIBERAL. Conserva la solicitud original y consulta /estado antes de otro envío.','review']
]);

export function blockerDiagnosticSpec(code){
 const row=BLOCKER_DIAGNOSTIC_ENTRIES.find(x=>x[1]===code);
 if(!row)throw Error('BLOCKER_DIAGNOSTIC_CODE_INVALID');
 return {id:row[0],code:row[1],reason:row[2],field:row[3],cause:row[4],action:row[5],remediation:row[6]};
}
export function validateBlockerDiagnostic(reason,diagnostic){
 if(!diagnostic||typeof diagnostic!=='object'||Array.isArray(diagnostic)||Object.keys(diagnostic).sort().join(',')!=='code,itemOrdinal,version'||diagnostic.version!==1||!Number.isSafeInteger(diagnostic.itemOrdinal)||diagnostic.itemOrdinal<0||diagnostic.itemOrdinal>BLOCKER_DIAGNOSTIC_MAX_ITEMS)throw Error('BLOCKER_DIAGNOSTIC_INVALID');
 const spec=blockerDiagnosticSpec(diagnostic.code);if(spec.reason!==reason)throw Error('BLOCKER_DIAGNOSTIC_REASON_MISMATCH');
 return {version:1,code:spec.code,itemOrdinal:diagnostic.itemOrdinal};
}
export function encodeBlockerDiagnosticRevision({revision,code,itemOrdinal=0}){
 const spec=blockerDiagnosticSpec(code);validateBlockerDiagnostic(spec.reason,{version:1,code,itemOrdinal});
 if(!Number.isSafeInteger(revision)||revision<1||revision>BLOCKER_DIAGNOSTIC_MAX_REVISION)throw Error('BLOCKER_DIAGNOSTIC_REVISION_INVALID');
 const result=BLOCKER_DIAGNOSTIC_BASE+revision*BLOCKER_DIAGNOSTIC_STRIDE+itemOrdinal*BLOCKER_DIAGNOSTIC_ITEM_STRIDE+spec.id;
 if(!Number.isSafeInteger(result))throw Error('BLOCKER_DIAGNOSTIC_ENCODING_INVALID');return result;
}
export function decodeBlockerDiagnosticRevision(value){
 if(!Number.isSafeInteger(value))throw Error('BLOCKER_DIAGNOSTIC_REVISION_INVALID');
 if(value<BLOCKER_DIAGNOSTIC_BASE)return null;
 const encoded=value-BLOCKER_DIAGNOSTIC_BASE,revision=Math.floor(encoded/BLOCKER_DIAGNOSTIC_STRIDE),tail=encoded-revision*BLOCKER_DIAGNOSTIC_STRIDE,itemOrdinal=Math.floor(tail/BLOCKER_DIAGNOSTIC_ITEM_STRIDE),id=tail-itemOrdinal*BLOCKER_DIAGNOSTIC_ITEM_STRIDE;
 const row=BLOCKER_DIAGNOSTIC_ENTRIES.find(x=>x[0]===id);
 if(revision<1||revision>BLOCKER_DIAGNOSTIC_MAX_REVISION||!row)throw Error('BLOCKER_DIAGNOSTIC_ENCODING_INVALID');
 const reason=row[2],blockerDiagnostic=validateBlockerDiagnostic(reason,{version:1,code:row[1],itemOrdinal});
 return {revision,reason,blockerDiagnostic};
}
export function formatBlockerDiagnosticStage(reason,diagnostic){
 const d=validateBlockerDiagnostic(reason,diagnostic);return 'DIAG|'+reason+'|'+d.code+'|'+d.itemOrdinal;
}
export function parseBlockerDiagnosticStage(stage){
 if(typeof stage!=='string'||!stage.startsWith('DIAG|'))return null;
 const fields=stage.split('|');if(fields.length!==4||!/^(?:0|[1-9][0-9]?)$/.test(fields[3]))throw Error('BLOCKER_DIAGNOSTIC_STAGE_INVALID');
 const blockerDiagnostic=validateBlockerDiagnostic(fields[1],{version:1,code:fields[2],itemOrdinal:Number(fields[3])});return {reason:fields[1],blockerDiagnostic};
}
export function renderBlockerDiagnostic({reason,diagnostic=null,packageId,revision,items}={}){
 if(!/^tg_[a-f0-9]{40}$/.test(packageId??'')||!Number.isSafeInteger(revision)||revision<1||revision>BLOCKER_DIAGNOSTIC_MAX_REVISION)throw Error('BLOCKER_DIAGNOSTIC_SCOPE_INVALID');
 if(diagnostic===null||diagnostic===undefined){
  const labels={SOURCE_UNAVAILABLE:'la fuente',CONTENT_INSUFFICIENT:'el contenido',MEDIA_FAILED:'la imagen',VALIDATION_FAILED:'la validación editorial',DRAFT_FAILED:'la operación de Publisher',DRAFT_UNCERTAIN:'el resultado de Publisher',PUBLISH_UNCERTAIN:'el resultado de Publisher',INTERNAL_ERROR:'un fallo técnico',COHERENCE_REQUIRED:'la coherencia de las fuentes',INTEGRITY_FAILED:'la integridad de los materiales',REVIEW_NOT_CONFIRMED:'la revisión de las fuentes'};
  if(!Object.hasOwn(labels,reason))throw Error('BLOCKER_DIAGNOSTIC_REASON_INVALID');
  return {code:null,field:null,itemOrdinal:0,cause:'Se registró un problema con '+labels[reason]+', pero esa revisión no guardó una causa más específica.',action:'Consulta /estado y conserva este paquete. Se requiere revisar el diagnóstico de esta revisión antes de modificar materiales o repetir un envío.'};
 }
 const d=validateBlockerDiagnostic(reason,diagnostic),spec=blockerDiagnosticSpec(d.code);let itemId;
 if(items!==undefined){
  if(!Array.isArray(items)||items.length>40)throw Error('BLOCKER_DIAGNOSTIC_INVENTORY_INVALID');
  if(d.itemOrdinal){
   const ids=items.map(item=>{if(!item||typeof item!=='object'||Array.isArray(item)||item.item_id!==undefined&&item.itemId!==undefined&&item.item_id!==item.itemId)throw Error('BLOCKER_DIAGNOSTIC_ITEM_UNCONFIRMED');const id=item.item_id??item.itemId;if(!/^ti_[a-f0-9]{40}$/.test(id??''))throw Error('BLOCKER_DIAGNOSTIC_ITEM_UNCONFIRMED');return id;});
   if(new Set(ids).size!==ids.length)throw Error('BLOCKER_DIAGNOSTIC_ITEM_UNCONFIRMED');
   const item=items[d.itemOrdinal-1];if(!item||item.state!=='STORED')throw Error('BLOCKER_DIAGNOSTIC_ITEM_UNCONFIRMED');if(spec.code.startsWith('IMAGE_')&&item.kind!=='FILE')throw Error('BLOCKER_DIAGNOSTIC_ITEM_UNCONFIRMED');itemId=ids[d.itemOrdinal-1];
  }
 }
 let action=spec.action;
 if(spec.remediation==='correct'){
  const replaceCodes=['IMAGE_FILE_UNREADABLE','SOURCE_PDF_UNREADABLE','FILE_INTEGRITY_MISMATCH','SOURCE_URL_UNAVAILABLE'];
  const replacement=itemId&&replaceCodes.includes(spec.code)?' Si vas a sustituir ese material, excluye únicamente esa copia con /descartar '+itemId+'; se conserva en el historial.':'';
  action='Primero abre el mismo paquete con /abrir '+packageId+'.'+replacement+' '+spec.action+' Después usa /listo para solicitar y revisar la vista antes de confirmar.';
 }
 return {code:d.code,field:spec.field,cause:spec.cause,action,itemOrdinal:d.itemOrdinal,...(itemId?{itemId}:{})};
}
export function blockerDiagnosticSource(){
 return 'const BLOCKER_DIAGNOSTIC_BASE=2**40,BLOCKER_DIAGNOSTIC_STRIDE=16384,BLOCKER_DIAGNOSTIC_ITEM_STRIDE=256,BLOCKER_DIAGNOSTIC_MAX_REVISION=4294967295,BLOCKER_DIAGNOSTIC_MAX_ITEMS=40;\nconst BLOCKER_DIAGNOSTIC_ENTRIES='+JSON.stringify(BLOCKER_DIAGNOSTIC_ENTRIES)+';\n'+[blockerDiagnosticSpec,validateBlockerDiagnostic,encodeBlockerDiagnosticRevision,decodeBlockerDiagnosticRevision,formatBlockerDiagnosticStage,parseBlockerDiagnosticStage,renderBlockerDiagnostic].map(fn=>fn.toString()).join('\n');
}
