# Telegram editorial — estado actual H111

Bot: @opmxpublisherbot. Credencial existente conectada. Receptor n8n activo: https://n8n.oxigenopuro.com.mx/workflow/OSi8AcnzLlI0csRu .

## Única acción del propietario pendiente ahora

Enviar /id al bot y avisar que respondió. No es necesario copiar los números: Work consulta la tabla mínima de candidaturas y confirmará qué identidad corresponde al propietario antes de autorizar adjuntos. Si aparece más de una candidatura no escoger automáticamente.

No enviar token al chat ni volver a crear el bot/credencial. El piloto sólo confirma recepción; no agrupa paquetes, no envía eventos Work ni genera/publica notas.

## H111 — @opmxpublisherbot conectado; identificación /id activa (2 noviembre 2026, México)

El propietario confirmó credencial lista y bot @opmxpublisherbot. La credencial Telegram API “OPMX — Telegram editorial” existe en el proyecto personal correcto y ya estaba asociada por el propietario a trigger, descarga y acuse. Se reutilizó sin leer token ni crear otra credencial. Antes de tocar se leyó el estado real: versión92b2cd48-ff58-473b-bf67-fe056f45cfc8,binaryMode=separate,allowlists vacías,retenciónnone.

Piloto OSi8AcnzLlI0csRu ahora ACTIVO,11nodos, versión9a45fd99-4ccf-490d-a6fb-ee77eaa9750a. n8n confirmó activación y lectura posterior active=true/sameAsDraft. Esto confirma configuración/activación, no recepción real de un mensaje Telegram: falta el /id del propietario. No se enviaron mensajes reales de prueba a terceros ni se generaron/publicaron notas.

Para evitar pedir copiar números al chat, /id privado registra sólo bot_username,user_id,chat_id,last_update_id,last_message_id,observed_at en la tabla personal “OPMX Telegram — identidades candidatas”,1NHMjthWiPVcAMPB. Es una candidatura de identidad, NO una autorización automática ni elección del primer remitente. Se deberá confirmar al propietario en esta conversación y resolver ambigüedad si aparece más de una identidad; después llenar la allowlist. No guardar IDs personales reales en GitHub ni registrar cuerpos, tokens o archivos en esa tabla.

Se añadieron IF de identificación, upsert con filtros bot+user+chat y restauración de contexto antes del acuse. Durante QA se usó dryRun=true y Telegram trigger/acuse/descarga fijados con datos sintéticos. QA263 success y consulta posterior tabla0filas: ninguna identidad ficticia persistida. Luego se cambió dryRun=false antes de activar; las allowlists reales siguen vacías. Retención none/none/saveManualExecutions=false,timeout90s y binaryMode separado se conservaron. Grafo agrupado,validación sin warnings. /id puede responder al remitente sus propios IDs; el resto del contenido no se descarga mientras no esté autorizado.

Estado posterior a activar: consulta de candidaturas0filas. El usuario debe enviar /id al bot. Work podrá recuperar los IDs desde n8n, sin pedir token ni que el usuario copie números. Hasta confirmar esa recepción, no declarar probado transporte real de archivos.

Siguen pendientes: autorización del chat, foto/PDF/DOC/texto reales de prueba, almacenamiento durable de paquetes y originales, agrupación/versiones, MCP Events y lectura por Work, generación de MASTER y draft fixture. PublisherH108 activo sin cambios; Social posterior. Esta tabla mínima no es almacenamiento de originales, idempotencia de publicación ni un listener Work.

Versionado: misma rama feat/mcp-publisher-file-draft/PR9editorial. SnapshotH111 sanitizado, sin credenciales/webhook IDs; H110 queda como histórico inactivo. Guía docs/OPMX_TELEGRAM_PILOT.md actualizada. Siguiente paso seguro: /id real del propietario; confirmar identidad y permitir recepción sólo en su chat. No DNS,credenciales nuevas ni publicaciones de contenido.


## Registro histórico H110

# Telegram editorial — piloto de recepción H110

## H110 — Telegram priorizado; receptor piloto preparado (2 noviembre 2026, México)

El usuario indicó Telegram antes de Social y autorizó automatizar el desarrollo, con intervención mínima. Se elige comenzar por recepción y validar la ruta Work/MCP Events de H109 por etapas. No se habilita generación/publicación automática ni se contrata API alternativa en este hito.

### Trabajo realizado
Workflow nuevo de entrada, sin reconstruir Publisher: OSi8AcnzLlI0csRu, “OPMX — Telegram recepción piloto · H110”,8nodos, proyecto personal OXÍGENO PURO (WyiSsL1U3KChdMw1), INACTIVO, versión99fcc2d9-6b6a-4736-9d9b-75a1dba241c4.
Telegram Trigger sin descarga inicial → configuración → normalización/autorización → descarga de adjunto sólo si el remitente y chat están permitidos → comprobación de bytes/firma → acuse al mismo chat → resultado RECEIPT_ONLY. /id sólo devuelve los IDs propios del remitente privado y no descarga contenido. El resto se deniega por defecto hasta completar allowlists. No acepta grupos, bots ni edited_message. Conserva update_id,message_id,media_group_id en la recepción, sin afirmar batching ni deduplicación durable. No interpreta “publica” dentro de texto/captions como autorización.

Tipos piloto: PDF,DOC,DOCX,TXT,JPEG,PNG,WEBP; límite10MiB antes y después de descarga cuando hay tamaño declarado. Firma básica, no parser completo de documentos. El original NO se conserva todavía. No usa URLs Telegram en el adaptador fileParams OpenAI existente. No llama Publisher, WordPress, MCP Events ni IA. Native Telegram es el canal de respuesta; sin atribución n8n. Rutas de publicación/web y Social existentes no cambian.

### Evidencia
SDK validado,8nodos.7pruebasunitarias específicas pasan; suite combinada112PASS. n8n245: /id con datos fijados → RECEIPT_CONFIRMED/IDENTITY.246: remitente no permitido → termina en normalización, sin descarga ni respuesta.247: PDF sintético16bytes → RECEIPT_CONFIRMED/FILE; publisher_called=false,work_event_sent=false,original_stored=false. Se restauraron allowlists vacías después de usar usuario ficticio1001; no es una identidad autorizada real. No se enviaron mensajes Telegram reales ni se usaron credenciales en QA. Luego retención none/none/saveManualExecutions=false; timeout90s. Grafo agrupado y validación sin warnings finales.

### Bloqueo y siguiente paso
list_credentials(type=telegram) devolvió0; no hay bot/API token accesible. Se pidió crear un bot con BotFather(/newbot) y guardar su token directamente en una credencial n8n “Telegram API” llamada “OPMX — Telegram editorial”, sin pegarlo en el chat. Cuando exista, asociarla a trigger/descarga/acuse y activar únicamente el piloto de recepción. El usuario enviará /id al bot; con esa respuesta se configurarán sus IDs reales antes de procesar adjuntos. No activar archivos para todo remitente.
Después: recepción real foto+PDF/DOC/texto; almacenamiento durable de paquetes/medios y agrupación; eventos MCP autenticados y persistentes; suscripción Work dentro del proyecto Motor; recuperación real de adjuntos; generación MASTER y fixture draft. Sigue pendiente resolver las pruebas/limitaciones H108 antes de conectar Social. Bot token no basta para declarar completo Telegram→Work→Publisher.

### Social queda como fase posterior
Se encontraron docs/SOCIAL_DISTRIBUTION_ARCHITECTURE.md y docs/SOCIAL_PLATFORM_MATRIX.md: v1.0.1,preflight offline35tests, sin publicación API. No asumir plataforma activa ni permisos verificados por esos documentos históricos.
Nuevo alcance del usuario: (1) Instagram+Facebook como una operación coordinada estilo Business Manager; (2) un segundo destino Facebook específico para compartir la URL OPURO; (3) TikTok,LinkedIn,Google Business Profile,YouTube,X,Threads. Identidad del segundo destino FB y formato YouTube pendientes; no inventar cuenta, Page ID ni capacidad de publicación de perfiles personales. La UI en combo no implica endpoint único: mantener resultados e idempotencia por destino. Contrato actual tiene un target Facebook; versionar su evolución antes de múltiples destinos. No prometer enlaces clicables/formato idéntico en todas las redes. El asset social independiente y el estado manual de YouTube Community pertenecen al diseño histórico, no una decisión sobre nuevos formatos. No se cambian contratos ni activan redes aquí.

Versionado: repositorio existente, rama feat/mcp-publisher-file-draft/PR9editorial.85feb3d funciones,c21b4e2 pruebas,fc7a183 generadorSDK,15eda7d snapshot inactivo. Siguiente intervención humana indispensable: bot y credencial. No DNS, no secretos en repositorio, no publicaciones reales como prueba.


## Pasos del propietario

1. En Telegram, abrir el BotFather oficial y usar /newbot. Nombre sugerido: OPMX Editorial. Elegir un username disponible terminado en bot.
2. En n8n crear una credencial Telegram API con nombre OPMX — Telegram editorial y guardar allí el Access Token. No enviarlo por chats ni guardarlo en GitHub.
3. Informar únicamente el @username del bot y que la credencial está guardada. Work buscará su ID por metadata, la asociará a los tres nodos y comprobará la configuración antes de activar el piloto.
4. Tras activación, enviar /id al bot. Work completará la allowlist con los IDs reales; después se probarán adjuntos. No habilitar envío de notas ni publicar contenido real como fixture.

Workflow: https://n8n.oxigenopuro.com.mx/workflow/OSi8AcnzLlI0csRu
Documentación oficial de credenciales: https://docs.n8n.io/integrations/builtin/credentials/telegram/
BotFather oficial: https://telegram.me/BotFather

## Reproducción técnica

node --test tools/telegram/*.test.mjs
node tools/telegram/build-intake.mjs

El generador produce SDK en /tmp/opmx-telegram-intake-sdk.js. Validar con validate_workflow antes de crear. El workflow ya existe: no crearlo nuevamente. Export inactivo: workflows/telegram/OPMX_TELEGRAM_RECEPCION_PILOTO_H110_NO_ACTIVAR.json. No contiene credenciales.

