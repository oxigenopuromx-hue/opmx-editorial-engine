# Issue #13 — portada por categoría OPURO

Estado: **DEPLOYED**. Guard fue desplegado el 13 de noviembre de 2026 a las 03:07:57 UTC (12 de noviembre, 21:07:57 en Ciudad de México). El readback final confirmó las versiones activas de n8n, los borradores originales preservados y el mismo Motor habilitado. Fuente publicada: [4f775f1eeccb3ae8502fbf3492fb1b2ce5c804ac](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/commit/4f775f1eeccb3ae8502fbf3492fb1b2ce5c804ac).

El cambio permite declarar las categorías de OPURO cuya zona superior debe excluir una nota. No cambia la portada general, la categoría asignada ni la disponibilidad de la URL, búsqueda o archivo inferior. La extensión es opcional en EDITORIAL1.4.2 y LITERAL1.0.

## Operación y autoridad

En un paquete abierto, el operador puede enviar directamente:

| Comando | Resultado |
|---|---|
| `/opciones portada OPURO 30,61` | Seleccionar esos IDs exactos; deben pertenecer a las categorías finales asignadas. |
| `/opciones portada OPURO ninguna` | Enviar `[]` explícito para limpiar las exclusiones por categoría. |
| `/opciones portada OPURO conservar` | Retirar la orden; omitir el campo y preservar la metadata existente. |

CREATE actualmente asigna una categoría principal OPURO: sólo ese ID puede excluirse. Los números son ilustrativos; no amplían la taxonomía de la nota. Mensajes reenviados, respuestas, citas, archivos y textos de fuentes no acreditan una orden.

Guard persiste la orden fuera de los materiales editoriales y comprueba actor, sesión/ciclo, revisión, solicitud y listas exactas. El lector entrega al Motor una proyección estructurada separada de las fuentes. El conector comprueba Guard antes de aceptar o escribir, incluso si el MASTER omite el campo: una orden activa omitida se bloquea. Sólo Guard emite el sobre `EDITORIAL_PLACEMENT`; un MASTER o un booleano OAuth no lo sustituyen. UPDATE comprueba la decisión exacta antes del claim, incluidos los subdestinos de TODOS.

Se conservan el cierre atómico del issue18, el preflight estático del21, el autor3 de El Liberal, LITERAL, los destinos y las reglas de idempotencia. La suscripción existente del Motor se conserva: el cambio de prompt usó el mismo ID y omitió los campos de triggers.

## Componentes comprobados

Guard: `opmx-guard-category-home13.zip`, **212025 bytes /87 archivos**, SHA256 `456eaaa3fb3dfc5a6a7079f20f39de81df564a322549b27b9136a10890b06f35`. Parte del release18 de84 archivos;75 permanecen idénticos y doce rutas forman el delta explícito. No contiene mocks ni credenciales de QA.

| Componente | Workflow | Versión activa final | Nodos |
|---|---|---|---:|
| Shared | `4o7K5TmKc7joScqB` | `bef4649d-38eb-436a-9a13-728750da6b8f` |152|
| Form | `Mt7ts2EGPbyaTC2o` | `5e0e1875-2996-4b8c-99aa-e4d07f7d8822` |58|
| MCP | `bnzVMNkZuGO1GQCZ` | `d4d3a75e-aec9-42ce-9439-d2ea4a931e8f` |155|
| Receiver | `OSi8AcnzLlI0csRu` | `09d373b0-9d71-4cf1-99bd-c830f2275e7c` |52|
| Reader, sin cambio | `C4hk6fQQomueYC8f` | `1eca0334-b3af-45d9-ac80-341e99a09faa` |10|
| UPDATE, sin cambio n8n | `qBmLf0DmcMSfuWvm` | `d04fb5c2-ba36-48f9-9cd4-2958ab1f273e` |9|

Los borradores anteriores de Shared, Form y MCP se restauraron con fuente exacta después de activar las versiones nuevas. Sus IDs de guardado finales, distintos de las versiones activas, constan en `readback.json`. El Receiver conserva52 nodos,51 miembros originales del grupo y sólo cuatro parámetros Code modificados. El probe quedó inactivo con tres nodos y su retención original restaurada.

Motor: mismo ID `6ae9095256948191b33f1e023fbfbf8b`, habilitado; prompt54666 caracteres, SHA256 del texto real `a59f79e5ba63ddaebdb91b4aa9f1088638e95be2d2a72069e7243f1d40b34bb7`. El hash del archivo exportado con salto final es distinto y se conserva por separado en `readback.json`.

## Validación y límites

| Evidencia | Resultado y alcance |
|---|---|
| Node nativo de Guard |231 pruebas dirigidas PASS, incluidos store/SQL simulado, autoridad, wiring HTTP, UPDATE, metadata, preflight21 y cierre18. Es el runtime que usa Guard; no es una ejecución de su store dentro de n8n. |
| Startup aislado |CJS síncrono, un listen/una pool;19 casos sin autenticación401 y19 autenticados con DB no disponible503. Son16 rutas anteriores y tres casos de autoridad, no19 rutas distintas. Cero red externa, DB real, CMS o Telegram. `startup.json`. |
| n8n38554 |Comandos:20 comprobaciones de helpers PASS. No acredita las comprobaciones de identidad externas a esos helpers. |
| n8n38559 |Fuentes reales prepare/verify Shared/MCP y formatter de inventario:25 casos/147 aserciones PASS, sin shims ni cambios de prototipos. Fixtures sintéticas internas; sólo se simula la respuesta HTTP de Guard; cero escrituras. |
| REST38092 |Siete comprobaciones PASS sobre el borrador desechable10533, `qa13-226004193e90`: esquema array de strings, lista explícita, omisión que preserva, `[]` que limpia y bandera general independiente. Limpieza a papelera confirmada. Cero publicaciones y cero notas editoriales reales modificadas. `rest-38092.json`. |
| Público38192 |Lecturas HTTP de categoría, posiciones/listado, paginación, búsqueda y nota seleccionada desde la propia respuesta: PASS. Complementan ocho pruebas del contrato frontend real desplegado; no representan publicar un fixture. |
| Live38621 |Seis comprobaciones de sólo lectura PASS: capacidad, versiones sin writers activos en esa observación, omisión ordinaria/legacy admitida y listas explícitas sin orden rechazadas. Cero mutaciones de paquetes, escrituras editoriales o mensajes. `live.json`. |
| Lectura MCP real |Los dos paquetes pendientes se leyeron READY: servidores IA revisión9/seis elementos y comisión Morena revisión8/cuatro elementos, ambos sin placement. Regresión de inventario sin opción PASS; no se publicaron para esta prueba. |

La revisión independiente comprobó el ZIP/directorio exactos,288 imports relativos,86 fuentes JS con sintaxis válida, cinco pins, copia preflight21 exacta y callback Guard antes del claim UPDATE.

Los intentos38545/38550 de ejecutar el store Node dentro del sandbox Code no validaron ese componente: n8n oculta los prototipos. Se descartó ese arnés como evidencia n8n, se mantuvo intacta la validación de producción y se comprobó el store en Node nativo. El QA de Code38559 usa las fuentes que realmente ejecuta n8n, sin adaptar prototipos.

**HMAC de invalidación no observado.** La prueba REST fue un borrador y no acredita una notificación de caché de una publicación. Las lecturas públicas y el contrato de caché existente pasaron, pero no se afirma haber visto una revalidación HMAC HTTP200. Es un límite de observación del mecanismo previo, no una publicación nueva realizada para probarlo.

El diagnóstico live observó149 paquetes,53589593 bytes, cero elementos pendientes y cero casos del indicador de riesgo de cierre. Conservó una diferencia histórica de dos slots contables: `matchesCurrentRules:false`; no se borraron ni conciliaron para forzar igualdad. El diagnóstico no autoriza borrados, cambios de límites ni reintentos.

Las copias JSON anexas no contienen grafos, nodos, fuentes, credenciales ni prompts. Se adjuntan separadamente los textos exactos `motor-before.txt` y `motor-after.txt` para que el rollback pueda verificarse y reproducirse sin depender de archivos temporales; no contienen claves ni tokens de acceso. `live.json` omite identificadores de solicitudes/paquetes del muestreo; conserva resultados y contadores. Cada copia indica el SHA256 del archivo original de evidencia. El rollback coordinado está en `ROLLBACK.md`.
