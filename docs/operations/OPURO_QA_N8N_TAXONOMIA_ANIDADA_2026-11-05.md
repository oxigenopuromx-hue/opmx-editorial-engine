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


## Ampliación — QA #5576 (5 noviembre, 09:05 UTC)

El workflow manual de QA fue extendido de 2 a 3 nodos con un Code Node de **simulación de intención de exclusión, sin escrituras ni credenciales**. Se conservaron trigger manual y lectura GET de categorías. Prueba n8n real #5576 `SUCCESS`, `get_workflow_execution` mostró:

```json
{"status":"PASS","dry_run":true,"writes":0,"eligible_ids":["35","4"],"selected_parent":"4","omitted_means_no_write":true,"explicit_selection":["4"],"wordpress_meta":"oxpuro_excluded_category_ids"}
```

El QA confirma que n8n recuperó jerarquía real Agua 35 → Noticias 4, distinguió ausencia de selección frente a selección explícita de la categoría ancestro y **no intentó un POST**. La validación de producción por lectura inmediata confirmó el Publisher automático `4o7K5TmKc7joScqB` ACTIVO, 91 nodos, versión publicada y borrador `c29101d9-afaa-45b9-990e-1047ce2a19a9` sin cambios; el QA `oTukmjDFYXfYUhDp` sigue INACTIVO (3 nodos, versión `6d0a83a4-7eff-413b-afef-9968f5040429`).

**Límite:** sigue siendo ensayo dry-run con llamada GET, no escritura de posts ni ejecución del workflow completo de 92 nodos. El flujo principal y los secretos no se tocaron.


## Ampliación — QA #5578 de readback sintético (5 noviembre, 09:09 UTC)

El QA manual/inactivo se amplió a **cuatro nodos**, añadiendo un Code Node de comprobación sintética de readback después de la consulta de jerarquía y la normalización de intención, **sin ningún POST a WordPress**. `test_workflow` ejecutó **#5578 SUCCESS** y `get_workflow_execution` confirmó `status:PASS`, `dry_run:true`, `remote_writes:0`, `eligible_ids:["35","4"]`. Los seis escenarios comprobados fueron: selección correcta, falta de readback rechazada, duplicados rechazados, valor incorrecto rechazado, lista vacía explícita reconocida y ausencia de respuesta de limpieza rechazada.

**Límite:** el Code Node construyó respuestas de WordPress sintéticas en memoria; esta prueba no demuestra que WordPress guardaría correctamente esas respuestas, ni que el Publisher completo haya sido ejecutado. El CI WordPress descartable del PR frontend #21 (runs #220 y #243 SUCCESS) es la evidencia separada de POST/readback REST real sobre instalación de prueba.

Próximo requisito antes de habilitar el workflow de 92 nodos: establecer frontera de autorización explícita para la preferencia de ubicación editorial. El hecho de que un MASTER transportado por Telegram contenga un campo no debe permitir a una fuente documental controlar automáticamente la portada; verificar intención atribuible al operador y no a las fuentes.
