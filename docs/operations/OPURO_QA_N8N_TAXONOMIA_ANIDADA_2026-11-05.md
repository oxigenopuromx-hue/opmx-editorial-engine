# QA real: jerarquía de categorías OPURO en n8n

Fecha: 5 noviembre 2026, México. Estado: **VERIFICADO — sólo lectura**.

- Workflow QA manual/inactivo: `oTukmjDFYXfYUhDp`. No es el Publisher activo.
- Versión actualizada mediante operación `setNodeParameter` en el nodo `Verificar lectura pública de taxonomía`, sin agregar disparadores ni credenciales.
- Prueba manual n8n `execution_id=5567`: `status=success`, sin nodos de escritura.
- Entrada: consulta GET a categorías públicas WordPress y elección de una subcategoría real con padre. Relectura individual del hijo y ancestro con límite de 12, detección de ciclo/identificador incorrecto.
- Salida real: `{status:"VERIFIED",source:"cms_wordpress_rest",sample_child_id:35,depth:2,ancestry:[{id:35,slug:"agua",parent:4},{id:4,slug:"noticias",parent:0}],eligible_ids:["35","4"],read_only:true}`.
- El cliente n8n `this.helpers.httpRequest` funcionó con el CMS productivo sin credenciales de edición.
- Se verificó el objeto de salida por `get_workflow_execution` del nodo Code.

## Alcance y limitaciones

La prueba demuestra que el preflight puede obtener y recorrer la jerarquía WordPress con un Code Node n8n. **No** prueba el flujo candidato completo de 92 nodos, el consumo del campo opcional del MASTER, autorización para editar WordPress, POST del meta, readback `context=edit`, HMAC WordPress→Vercel ni posicionamiento visual después de editar. Ninguna publicación ni taxonomía fue modificada.

Una búsqueda documental recuperó referencias a un staging histórico del repositorio **distinto** `oxigeno-puro-mx`. Ese proyecto NO es `oxigeno-puro-com-mx` y no autoriza a reutilizar sus entornos. Antes de probar POST deberá confirmarse un staging descartable de la plataforma correcta y credenciales aisladas.

## Siguiente validación

Ejecutar con WordPress descartable (WP >=6.6, PHP >=8.2) la escritura deliberada `meta.oxpuro_excluded_category_ids` bajo identidad autorizada, relectura `context=edit`, comprobación de categoría directa/ancestra y persistencia de listados/URL, sin tocar notas productivas. Registrar ID de fixture y reversión. Cualquier promoción a workflow productivo exige además snapshot completo, prueba de rollback y revalidación HMAC.
