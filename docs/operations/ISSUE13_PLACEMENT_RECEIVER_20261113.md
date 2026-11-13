# Issue13 D045 — orden directa de colocación desde Telegram

Fuente preparada, no desplegada. Este subtrabajo no modifica n8n, Guard, paquetes ni WordPress.

El receptor reconoce `/opciones portada OPURO 30,61` , `/opciones portada OPURO ninguna` o `/opciones portada OPURO conservar` como control separado de redacción/destinos. Sólo admite texto directo de un usuario/chat ya autorizado por el normalizador existente. Rechaza reenvío, respuesta, quote, edición, adjunto y caption; un JSON que diga EDITORIAL_PLACEMENT o DIRECT_OPERATOR permanece como datos, sin autenticación.

El comando no entra en las fuentes editoriales ni crea una reserva. El receptor consulta la sesión existente y envía al Guard autenticado:

`POST /v1/telegram/placement/select`

`{owner, chat, packageId, revision, receiptId, ids}`

No envía `confirmed`, `mode` ni una prueba de voluntad fabricada por el Motor. El Guard debe acreditar y persistir actor/sesión/lease/orden y derivar después el sobre DIRECT_OPERATOR ligado al request exacto. OPEN ordinario requiere owner/sesión; recuperación requiere además el lease/actor vigente. La autoridad real es responsabilidad del store y del gate del escritor; este parche sólo produce el control autenticado del receptor.

IDs: cadenas decimales positivas sin ceros iniciales, duplicados ni espacios entre IDs. Máximo100, cada uno entero JavaScript seguro. `ninguna` significa selección explícita `[]` para vaciar. `conservar` envía `ids:null` como retirada durable de la selección previa, preservando los metadatos actuales; no se convierte en `[]`. El ACK distingue conservar de vaciar y rechaza intercambiarlos. Ninguna de estas órdenes modifica la elección de destinos ni publica por sí misma.

ACK esperado: `PLACEMENT_SELECTED` o `PLACEMENT_REPLAY`, packageId/targetOPURO/ids exactos y revisión durable. SELECTED requiere revisión actual+1. REPLAY permite la revisión original≤actual, conserva la revisión actual y responde «ya estaba registrada». El Guard **no debe devolver REPLAY de un controlA después de un controlB vigente del mismo lease**. Ante cualquier falta de confirmación el receptor pide consultar /estado y no declara publicación ni repite escrituras.

Archivos:

- `receiver/placement-command.mjs`: parser y atestación de mensaje directo, sin red ni almacenamiento.
- `receiver/build-placement-receiver-operations.mjs`: cuatro `updateNodeParameters` sobre Normalizar entrada, Preparar paquete, Resolver paquete y Confirmar operación; valida versión y hashes de las cuatro fuentes antes de generar operaciones.
- `receiver/placement-command.test.mjs`:36pruebas PASS. Incluye la fuente posterior al cierre atómico18; su ruta packages/close y diagnóstico HTTP se conservan.
- `receiver/fixtures/placement-receiver-after18.mjs`: copia de las cuatro fuentes Code del snapshot preparado18, sin configuración de usuarios, credenciales, webhooks ni datos de ejecución. No se presenta ese snapshot como versión activa actual.

Uso por la instancia principal: releer el grafo publicado del receptor después del18, construir `{id,versionId:activeVersionId,nodes,connections}` y llamar `buildPlacementReceiverOperations(graph,placementReceiverBase(graph))`. Aplicar sólo tras instalar/QA del store y gate Guard correspondientes, conservando el resto del grafo y la suscripción. No aplicar las operaciones generadas desde un snapshot anterior sin comparar fuentes.

El archivo local `issue13-placement-receiver-operations-private.json` se generó para revisar anclas del snapshot18; no fue aplicado y debe regenerarse desde el publicado real al activar.

Arnés puro para Code QA: `receiver/build-placement-command-qa.mjs`, export `buildPlacementCommandQaCode()`, ejecuta20comprobaciones sintéticas de IDs/[]/null, controles reenviados/respuestas/ediciones/adjuntos y datos que no son órdenes. No hace I/O ni acredita por sí mismo identidad o permisos; la identidad sigue en el normalizador y la autoridad durable en Guard.
