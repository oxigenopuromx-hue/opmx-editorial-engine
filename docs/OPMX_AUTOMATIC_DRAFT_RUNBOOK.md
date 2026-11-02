# Entrada automática OPURO / OPOL — operación v2

## H108 — Publicación explícita desde el Motor implementada y activa (2 noviembre 2026, México)

Estado: IMPLEMENTADO Y DESPLEGADO; 105 pruebas locales y QA simulada pasan. Primera publicación real por estas acciones aún no validada en esta sesión. No se usaron notas reales como prueba.

### Acciones disponibles en el mismo Motor
- “Publícala en OPURO / OPOL / ambos”: publicar_nota_opmx recibe MASTER LISTO y los archivos originales, request_id estable y confirmar_publicacion=PUBLICAR. Reutiliza Publisher protegido para crear y verificar los borradores antes de publicar.
- Si ya se entregaron borradores: publicar_borradores_opmx recibe request_id, slug e IDs originales. NO vuelve a crear notas ni medios. Consulta el guard /v1/targets/status y exige reported/postId exacto para cada destino.
- preparar_borrador_opmx conserva su comportamiento sólo draft; validar_archivos_opmx sigue siendo lectura. No cambiar MASTER ni inventar IDs/URLs/Base64 para habilitar publicación.
- Ambas herramientas de publicación declaran readOnlyHint=false, destructiveHint=true, openWorldHint=true y requieren orden explícita del usuario. No se cambiaron permisos de ChatGPT ni OAuth workflow:execute.

### Ejecución y controles
Mismo adaptador bnzVMNkZuGO1GQCZ,60nodos, activo cc976feb-b414-4a7b-9b8c-f1b1a787ec38. Publisher hijo91nodos c29101d9-afaa-45b9-990e-1047ce2a19a9 sin cambios. El grafo nuevo está agrupado y la validación n8n final no reporta warnings. Rollback anterior a H108: d2f6af0b-91e9-4e9b-83c0-847c93284336 (H107 más anotación técnica, sin publicación).

Todos los destinos solicitados deben superar guard y preflight WordPress antes del primer POST de publicación: identidad, estado, Gutenberg, Hero OPURO, destacada, autor, categorías y SEO. Después sólo se envía {status:publish}; otro GET autenticado coteja el contenido y metadata editorial con la lectura previa. No sobrescribe contenido. Una respuesta POST perdida se resuelve mediante lectura, no repitiendo POST. En borradores existentes, destinos ya publish se verifican sin reenviar POST. Si OPURO queda incierto no se intenta OPOL. No hay transacción atómica entre los dos CMS: se informa PARTIAL_SUCCESS o UNCERTAIN con IDs y retryPermitted=false.

URLs OPURO planas; OPOL usa categoría primaria obtenida de WordPress, igual que el Publisher vigente. Se invalida caché OPURO con credencial existente y se lee cada frontend sin credenciales. Sólo SUCCESS con estado publish, contenido conservado y canonical público exacto en todos los destinos. Si CMS confirma publicación pero la web no está vigente: PUBLISHED_VISIBILITY_PENDING, no duplicar/recrear. Un rechazo preflight conserva request_id,slug,post_ids y publicationWritesStarted=false; drafts pueden existir. QA179 corrigió acceso a salida0/run0 en la rama de error.

Guard evita duplicar creación de notas y vincula IDs. NO existe todavía un claim atómico específico del POST de cambio de estado para dos órdenes de publicación simultáneas del mismo borrador; podrían repetir hooks de WordPress aunque actualicen el mismo ID. No afirmar exactamente una invocación ni habilitar social sobre esos hooks sin cerrar esa concurrencia. Las órdenes normales se procesan secuencialmente por destino y no se reenvían automáticamente.

### Evidencia
105 pruebas Node PASS (protocolo, guard, borradores y publicación). QA inactivo s7h6AbZ4nvJjMAdf,42nodos, todos los HTTP example.invalid y sin credenciales. test_workflow usa respuestas sintéticas fijadas; no son pruebas de escritura real:
162 nueva AMBOS SUCCESS;163 SEO inválido PUBLICATION_REJECTED sin POST;164 guard/ID incorrecto rechazado sin POST;165 incertidumbre OPURO deja OPOL NOT_ATTEMPTED;166 PARTIAL_SUCCESS;167 visibilidad pendiente;168 ya publicados sin POST ni ejecución del hijo;169 existentes AMBOS sin recrear;170 existentes OPOL sólo ese destino;171 nueva OPURO sólo ese destino;172 regresión draft sin POST de publicación.179 rechazo con IDs preservados.
Artefactos: workflows/publisher/OPMX_PUBLICACION_QA_H108_NO_ACTIVAR.json y fixtures/mcp-publication-h108-pins.json. Nunca activar la QA ni ejecutar esos IDs ficticios contra WordPress.

El catálogo del conector ChatGPT se actualizó y se comprobó visualmente: Write3 (preparar_borrador_opmx, publicar_borradores_opmx, publicar_nota_opmx),Read1(validar_archivos_opmx). También se actualizó descripción a validación/borradores/publicación explícita. Mismo app/plugin_asdk_app_6ae7e85c83b481919008919407f25779, OAuth y permisos sin cambios. No fue necesario conectar otra cuenta.

### Versionado, límites y siguiente paso
Repositorio editorial, rama feat/mcp-publisher-file-draft, PR9 sigue draft. Commits principales: dea0b2c protocolo inicial,1586da6 funciones,87100fe pruebas,2030986 builder,4627849/01e8086/8963353 separan generador base draft del grafo de publicación,073ddb4 retorno de IDs en errores. Base H104 debe conservar publicationEnabled=false; H108 se aplica después de instalar su grafo. No reaplicar generadores sobre el vivo a ciegas.
Retención del adaptador sigue none/none/saveManualExecutions=false; no se guardan URLs temporales. No secretos nuevos, no DNS ni cambios frontend. H10660s sigue activo y su PR frontend separado continúa pendiente E2E por conflicto previo de rutas. No merge automático de la rama editorial acumulada.
Siguiente validación operativa: una nota concreta aprobada desde el mismo Motor, orden explícita y destino, comprobando estados y URLs devueltos. No elegir ni publicar una nota real como fixture. Redes sociales aún no están integradas.


## H107 — Transferencia nativa comprobada desde el mismo Motor (2 noviembre 2026 UTC / 1 noviembre México)

El conector “OPMX Publisher — Archivos” quedó instalado y autenticado en ChatGPT con OAuth nativo de n8n. Consentimiento limitado a workflow:execute para el adaptador bnzVMNkZuGO1GQCZ; no se conservó la selección amplia de scopes de n8n. App: https://chatgpt.com/plugins/plugin_asdk_app_6ae7e85c83b481919008919407f25779 . Chat de prueba: https://chatgpt.com/g/g-p-6ab4aab3beac8191af830472b29869d0-motor-editorial-opmx/c/6ae578e9-66a4-83e8-a7a1-eccbee0a5c8c .

Se ejecutó validar_archivos_opmx desde ese Motor con los archivos originales, sin Work como puente, reconstrucción de JSON ni Base64 manual. Primeros dos intentos de sólo lectura revelaron que fileParams SÍ entregaba download_url, file_id, file_name y mime_type; nuestra regex rechazaba un identificador opaco de 48 caracteres. Se corrigió a cadena no vacía de hasta4096 caracteres; nunca se usa como ruta ni autorización. Se mantienen HTTPS, lista de orígenes, sin redirecciones, firma/MIME y tamaños. Diagnóstico sólo tipos/claves/longitudes, sin valores de identificador o URL.

Tercer intento, una sola llamada de lectura: FILES_VALIDATED, bytesVerified=true, destino AMBOS, estado LISTO, slug guadalupe-taddei-ramirez-cuellar-investigacion-ine-2026. MASTER45567bytes, Hero97824bytes y destacada70997bytes; total214388. No reservas, medios, borradores ni publicaciones. Esto valida transporte nativo hasta bytes y parsing; NO afirmar que este paquete pasó por la herramienta de escritura. El subflujo de borradores ya tiene entrega real previa H103/execution119; falta probar una solicitud nueva íntegra desde preparar_borrador_opmx con un paquete aprobado sin duplicados o fixture. No reenviar Chrome: usuario ya publicó9697/2787.

Adaptador activo a196b354-f72a-487e-8a65-6a84e4d45885,22nodos. Publisher hijo activo c29101d9-afaa-45b9-990e-1047ce2a19a9,91nodos, con list-item H105. Guard y recuperación no cambiaron. PUBLICAR=false y resultados inciertos requieren reconciliación, nunca reenvío automático. Retención de ejecuciones del adaptador continúa desactivada para proteger URLs temporales; no intentar eludir el rechazo de activar guardado manual de H104.

96pruebas locales PASS. Commits editorial rama feat/mcp-publisher-file-draft: 5021147 receptor, f344043 regresión de ID opaco, 4633ea1 snapshot sanitizado. PR9 editorial sigue draft: https://github.com/oxigenopuromx-hue/opmx-editorial-engine/pull/9 . H106 frontend sigue en producción60s; PR9 frontend separado y pendiente E2E por conflicto preexistente de parámetros de rutas, no merge ciego.

Siguiente paso seguro: usar preparar_borrador_opmx desde el Motor para una solicitud nueva aprobada en destino indicado y comprobar IDs/enlaces/readbacks; no hace falta llevar archivos a Work ni usar formulario manual. Publicación pública y redes sociales siguen pendientes de su flujo específico; no confundir borrador con publicación.


## H104 — Archivos nativos desde el mismo Motor (2026-11-01 México)

El usuario rechazó el puente Motor → Work de H103 como experiencia final: requiere generar la nota y pedir su envío en EL MISMO CHAT. H103 permanece como evidencia de entrega; no es el flujo de uso aceptado. No pedir mover archivos a otro chat ni usar el formulario manual.

Implementación desplegada, conexión ChatGPT pendiente:
- MCP OAuth: https://n8n.oxigenopuro.com.mx/webhook/opmx-publisher-files-mcp
- Workflow bnzVMNkZuGO1GQCZ, 22 nodos, activo 7014f00e-be78-4292-bef0-09a148b4151b. Herramientas validar_archivos_opmx (lectura) y preparar_borrador_opmx (escritura de drafts). Declaran openai/fileParams de nivel superior: master_file, hero, destacada. ChatGPT debe aportar referencias transferibles; nunca inventar URLs o Base64.
- Recibe destino OPURO/OPOL/AMBOS; la herramienta de escritura exige request_id estable. Descarga MASTER y destacada; Hero obligatorio para OPURO/AMBOS. Comprueba JSON, LISTO al escribir, firma/MIME y límites de 2 MiB MASTER / 10 MiB por imagen. HTTPS con orígenes OpenAI permitidos, sin redirecciones; sin credenciales de descarga. Los límites se comprueban después de recibir bytes: no es un límite de memoria del transporte.
- Llama al Publisher existente 4o7K5TmKc7joScqB mediante Execute Sub-workflow; nueva entrada passthrough y callerPolicy restringida al adaptador. Versión activa 28737376-bc88-4b6b-8178-1f4fc1a6e494, 91 nodos. Webhook anterior conservado. Se corrigió la huella: imágenes fuente se leen del preparador común y no de un trigger que puede no haberse ejecutado. Se conserva exactamente el JSON de huella anterior.
- Fuerza PUBLICAR=false; contrato Gutenberg/SEO/medios vigente, guard y readbacks existentes. Fallo/resultado parcial no permite reenvío automático. Respuesta incierta incluye execution_id para conciliación. El adaptador no guarda ejecuciones manuales ni de éxito/error; el hijo mantiene su política previa y recibe bytes, sin enlaces temporales.

Evidencia: 91 pruebas locales pasan, incluidos siete casos nuevos; nueve nodos Code del adaptador compilan. Configuraciones n8n sin advertencias. QA #124 descargó metadata OAuth pública como binario y verificó helper de bytes, descriptor fileParams y rechazo de escritura inválida; cero escrituras. #125 comprobó POST anónimo HTTP401 y challenge OAuth en versión publicada. #120/121 verificaron challenge y metadata antes de ampliar el endpoint. #122/123 no conservan resultados por política sin retención; no se usan como evidencia de éxito. NO se validó aún handshake autenticado del cliente ChatGPT, binding real de archivos ni la ruta MCP→draft integral. No afirmar terminado.

Conexión única pendiente: crear/conectar plugin MCP específico OAuth con URL anterior en ChatGPT y habilitarlo en Motor. El plugin genérico n8n execute_workflow no declara fileParams. No hay herramienta de gestión que cree esa conexión personalizada; se abrió ChatGPT en el navegador disponible y muestra Iniciar sesión. Requiere autenticación segura del usuario antes de completar configuración. La referencia OAuth publicada anuncia resource con ?method=POST; comprobar compatibilidad/audience al conectar, sin desactivar autenticación. Primera prueba desde Motor: validar_archivos_opmx con el paquete Chrome ya existente, SOLO LECTURA. No reenviar Chrome: #119 ya creó drafts9697/2787. Después probar nuevo fixture aprobado mediante preparar_borrador_opmx en ambos destinos.

Revisión automática rechazó temporalmente habilitar saveManualExecutions=true por retención de archivos/URLs. No aplicado ni eludido: las pruebas seguras usaron diagnóstico separado con sólo metadata pública y funciones sintéticas. La operación inválida setNodeParameter path=jsCode también se rechazó sin mutación; se corrigió mediante updateNodeParameters.

Código en feat/mcp-publisher-file-draft, PR #9 aún draft. Commits 06c291a protocolo, acc1a26 generador adaptador, 3cffb05 pruebas, 7410c1c referencia MCP, c3da4a9 generador v2, a716149 prueba huella, 6704e12 referencia v2. main/CI remoto sin verificación en este hito. Sin DNS ni escrituras WordPress en H104. Publicación pública automática y redes continúan pendientes.

Fuentes técnicas: https://developers.openai.com/plugins/reference (fileParams), https://developers.openai.com/plugins/build/auth (OAuth), https://developers.openai.com/api/docs/guides/custom-mcp-server (conexión). Parámetros n8n cotejados con tipos de esta instancia.


Estado: activa para OPURO, OPOL y AMBOS. Validada con fixtures y con entrega real mediante Work (#119, 2026-11-01). Crea borradores; publicación pública automática y Social pendientes.

## Recursos

- Proyecto personal OXÍGENO PURO <oxigenopuromx@gmail.com>, raíz, sin carpeta.
- Workflow: https://n8n.oxigenopuro.com.mx/workflow/4o7K5TmKc7joScqB
- Trigger: `Entrada automática protegida`.
- Versión activa v2: `ef6429a7-d56e-4600-82c9-05191aa49bb5`, 90 nodos.
- Rollback v1 OPURO: `c6ec4283-becb-4a1f-b83d-730ea2073934`.
- Webhook conservado: https://n8n.oxigenopuro.com.mx/webhook/opmx-automatic-opuro-draft-v1
- Autenticación n8n User Auth OAuth2 y permiso de ejecución. #110 probó rechazo anónimo HTTP401 en v1; v2 conserva esa configuración.
- Conector oficial ChatGPT → n8n existente. Node en Hostinger continúa como guard durable; no desplegar el servidor MCP Node experimental para usar esta ruta.

## Transferencia desde Library mediante Work — H103

El chat Motor del intento Chrome pudo localizar los archivos, pero no tenía disponible una vía para convertir y entregar los bytes. Ver un archivo no demuestra capacidad de enviarlo. Work sí completó esa entrega con el mismo identificador estable; no fue necesario modificar el workflow.

Ruta operativa comprobada cuando el Motor carece de esa capacidad:
1. Motor genera y aprueba MASTER, Hero y destacada y los conserva en Library.
2. El usuario pide a Work entregar esa nota; Work resuelve los archivos, usa la skill Library para materializarlos preservando identidad y prepara el cuerpo sin mostrar Base64 al usuario.
3. Utilizar tools/mcp-publisher/prepare-local.mjs con --master, --hero (si aplica), --featured, --destination, --request-id y --out. El comando fuerza PUBLICAR=false, conserva el MASTER, comprueba aprobación/formatos/límites y guarda el cuerpo con permisos0600 sin sobrescribir. Sólo prepara; no inicia n8n.
4. El orquestador Work lee ese JSON, llama al ejecutor oficial de n8n con executionMode=production para la entrega real aprobada y consulta el resultado de la misma ejecución. No colocar Base64 en el chat ni guardar paquetes editoriales reales en GitHub.
5. Si el intento previo ya tenía identificador, reutilizarlo. No reenviar ante resultado incierto: primero consultar ejecución/guard/CMS.

La transferencia directa desde el chat Motor sin runtime de archivos SIGUE SIN HABILITARSE. Este puente funciona en Work; una instrucción de prompt no concede esa capacidad al otro chat. No prometer transferencia automática de archivos sólo por tener el conector n8n.

Evidencia real H103: ejecución119, producción/webhook, request_id=opmx-chrome-319-c4419b28487cdaff. MASTER original LISTO y JPG reales (Hero250281bytes,1448x1086;destacada95083bytes,1200x630). SUCCESS/DRAFT en ambos: OPURO9697 y OPOL2787, slug extensiones-maliciosas-de-chrome-319-busquedas. Readbacks editoriales y SEO correctos. Nada publicado. El nuevo puente produjo localmente exactamente el mismo MASTER y bytes que el cuerpo enviado; no se repitió la solicitud. 84 pruebas locales pasan.

## Entrega desde Motor / Work

Consultar detalles del workflow antes de ejecutarlo. Mantener el contrato editorial vigente; nunca cambiar CONTROL_EDITORIAL para hacer pasar un paquete no aprobado.

```json
{
  "workflowId": "4o7K5TmKc7joScqB",
  "executionMode": "production",
  "triggerNodeName": "Entrada automática protegida",
  "inputs": {
    "webhookData": {
      "method": "POST",
      "body": {
        "request_id": "IDENTIFICADOR_ESTABLE_DE_16_A_128_CARACTERES",
        "CREAR_EN": "AMBOS",
        "PUBLICAR": false,
        "master": {},
        "hero_file": {"base64": "BYTES_HERO_BASE64"},
        "featured_file": {"base64": "BYTES_DESTACADA_BASE64"}
      }
    }
  }
}
```

El ejemplo es estructural: MASTER vacío y marcadores no son ejecutables. Para pruebas usar executionMode=manual y fixtures sintéticos autorizados.

CREAR_EN acepta OPURO, OPOL o AMBOS. PUBLICAR debe ser false.

- OPURO: MASTER con GUTENBERG_ENRIQUECIDO_FINAL, metadata/categoría OPURO y los archivos Hero + destacada.
- OPOL: MASTER con GUTENBERG_FINAL, metadata/categoría OPOL y sólo archivo destacada; hero_file puede omitirse.
- AMBOS: ambos campos Gutenberg y clasificaciones; Hero para OPURO y un archivo destacado que se carga independientemente a cada CMS.
- Placeholders según destino: HERO_OPURO.URL={{OPMX:HERO_OPURO}}, DESTACADA_OPURO.URL={{OPMX:DESTACADA_OPURO}}, DESTACADA_OPOL.URL={{OPMX:DESTACADA_OPOL}}.
- El validador heredado exige ambas clasificaciones del MASTER aun cuando se seleccione un solo sitio. Los IDs de autor son resueltos por Publisher; no añadir AUTOR_ID al MASTER.

Leer los adjuntos realmente accesibles y convertir sus bytes a base64. No sustituirlos por URLs temporales ni copiar HTML manualmente a WordPress. La entrega desde Work con dos JPG reales se verificó en H103. El chat Motor sin runtime de archivos debe usar el puente Work descrito arriba. PNG/JPEG/WebP admitidos; límite de 14,000,000 caracteres por cadena base64. H103 también comprobó JPG reales de 250281 y 95083 bytes.

request_id es estable para la misma entrega, de 16–128 caracteres A-Z/a-z/0-9/guion/guion bajo. No cambiarlo para eludir duplicados o incertidumbre.

## Resultado y fallos

La herramienta devuelve executionId. Consultar esa ejecución del mismo workflow y el nodo `Resultado consolidado OPMX`. Éxito requiere status=SUCCESS, mode=DRAFT y DRAFT para cada destino solicitado. Se devuelven edit_url_opuro/edit_url_opol y post_id_opuro/post_id_opol; el destino omitido queda SKIPPED. Iniciar ejecución no confirma éxito.

En AMBOS se consultan los dos CMS y se reservan ambos destinos antes de escribir. Después se procesa OPURO y luego OPOL. Si OPOL falla tras completar OPURO, devuelve PARTIAL_SUCCESS y conserva el enlace OPURO; nunca reenvía automáticamente ni elimina el borrador logrado. Si OPURO falla, se detiene antes de procesar OPOL y exige conciliación. No es una transacción entre WordPress: una falla no revierte publicaciones previas.

La recuperación de sólo lectura C4hk6fQQomueYC8f cubre los errores OPURO seleccionados y no verifica bytes ni snapshot. OPOL conserva estado guard e informe NEEDS_RECONCILIATION; su cotejo automatizado de recuperación con CMS no está implementado. No reintentar ante ese informe.

El Publisher formulario y otros publicadores omiten este guard: evitar envíos concurrentes para el mismo slug desde esas rutas.

## Evidencia

- H101 #108: OPURO completo, draft9681; #109 replay bloqueado; #110 webhook anónimo401; #111/112 guard/CMS concordantes.
- H102 #113: AMBOS, draft OPURO9685 y OPOL2771; Hero OPURO9683, destacada OPURO9684 y OPOL2770. Readback de ambos validó Gutenberg, autor, categorías, etiquetas, destacadas, metadata editorial y Rank Math; OPURO además Hero.
- #114: OPOL solo y una imagen, draft2776; OPURO SKIPPED.
- #115: replay AMBOS bloqueado antes de reserva/cargas.
- #116: OPURO solo, draft9689; OPOL SKIPPED.
- 84 pruebas locales Node. Grafo n8n actualizado sin advertencias. Resultado parcial probado con dobles localmente, no con fallo real provocado entre CMS.
- Objetos sintéticos persisten; nunca publicarlos.

## Reproducción

Fuente actual: workflows/publisher/OPMX_ENTRADA_AUTOMATICA_DESTINOS_v2.json (sanitizada, inactiva y sin credenciales para revisión); generador tools/mcp-publisher/build-automatic-both.mjs; pruebas automatic-both.test.mjs. Los exports OPURO v1 y su SDK se conservan como historial de H101.

```sh
node tools/mcp-publisher/build-automatic-both.mjs --check
node --test tools/mcp-publisher/*.test.mjs
```

Reutilizar el workflow operativo; no activar otra copia del export por accidente. La rama del PR contiene estos cambios; no declarar main actualizado ni CI remoto verde hasta verificarlo.
