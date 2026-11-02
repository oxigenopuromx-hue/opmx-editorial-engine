# Entrada automática OPURO / OPOL — operación v2

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
