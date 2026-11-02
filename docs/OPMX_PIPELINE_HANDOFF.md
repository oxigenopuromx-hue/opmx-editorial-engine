# OPMX Pipeline — Handoff maestro

## H115 — Almacenamiento privado de paquetes desplegado y validado (2 noviembre 2026, México)

H114 confirmó recepción real de3mensajes: texto,JPEG150508bytes,PDF300310bytes. Ahora se añadió el almacenamiento backend; todavía NO está conectado al receptor Telegram. Éste continúaH113/12nodos/d8ffd9a9-bb23-48d6-bb95-a061316f5fff en RECEIPT_ONLY. No se pide repetir la prueba H114 ni se afirma que aquellos originales se conservaron.

Infraestructura: credencial MySQL existente rw21TkrAUdcLF27k rechazada en consulta sólo lectura desde n8n (QA276,ER_ACCESS_DENIED_ERROR). No se cambió contraseña ni se abrió MySQL remoto/IP. No hay credencial GoogleDriveOAuth en n8n. Se reutiliza guardNode de Hostinger, que ya accede localmente a MariaDB mediante las variables existentes. Sesión hPanel válida; al entrar apareció registro de dominio pendiente ajeno al proyecto, se salió sin registrar ni modificarlo. Publisherguard tenía desplegado opmx-guard-recuperacion-h092.zip; respaldado y conservado como rollback.

Actualización en publisher.oxigenopuro.com.mx: opmx-guard-telegram-storage-h115.zip,Hostinger “Se ha completado/Actual” a14:13:50México. No DNS,cuentas,secretos,permisos ni variables modificadas. Mismo mysql2 3.24.6; siguen intactos direct-claim,target-progress,media-progress. server.js importa el guard desde tools/mcp-publisher para mantener rutas relativas de módulos. Nuevas tablas InnoDB separadas opmx_tg_quota_v1,opmx_tg_packages_v1,opmx_tg_sessions_v1,opmx_tg_items_v1; inicialización perezosa sólo al acceder a endpoints Telegram. Fallo de inicialización no impide arrancar las rutas históricas del guard.

API privada POST /v1/telegram/packages/{capabilities,current,open,reserve,complete,manifest,asset,seal,discard}, con la MISMA autenticación HeaderAuth del guard, sin URLs públicas de originales. owners/chats privados deben coincidir y normalizador n8n debe aplicar allowlist antes de llamar. El guard no es un servidor multitenant: el cliente autenticado es el operador del pipeline y aporta owner/chat. La API no interpreta ni publica texto.

Paquetes/sesión durables y IDs opacos derivados de identidad+recibo. Una reserva captura paquete y recibo ANTES de descargar. Texto se guarda directamente; archivos quedan PENDING y se completan con bytesBase64 canónicos, MIME/firma básica,tamaño exacto declarado y SHA256. SQL parametrizado y BLOB, sin rutas construidas de nombres. Reenvío de reserva/archivo devuelve replay o conflicto; cierre se bloquea con PENDING y fija READY+revisión al terminar. Manifest/asset verifican dueño/paquete; asset vuelve a comprobar hash. discard sólo marca PENDING sin original, conserva registro. No hay borrado automático de originales ni callback/evento Work.

Límites de piloto:10MiBarchivo,25MiBpaquete,20items/paquete,128MiBglobal y100paquetes acumulados. Cuota/reservas/sesión/cierre serializados en transacciones mediante fila cuota FOR UPDATE; no afirmar ensayo concurrente real aún. Paquetes READY inmutables y repetición de completar con hashigual permitida como lectura/replay. Captions son datos; no autorización editorial. JSONcomplete≤14MiB,resto64KiB; rutas antiguasconservan4KiB; timeoutservidor60s para cargas. Corpuscompleto/máximo10MiB a través del proxy Hostinger todavía no validado: sólo validador local máximo y fixtureSQL16bytes.

Pruebas:119NodePASS (112anteriores+7almacenamiento), sin cambio de rutas editoriales. QA277 STORAGE_READY,max_allowed_packet1073741824preexistente,publicationEnabled=false. Workflowdiagnóstico6ayHzqpXUTD2eczp en proyecto personal OXÍGENO PURO,INACTIVO,15nodos,versiónda17eb2d-80ac-4408-bda4-efad26f830a5,manual,sin webhook. Contiene sólo fixtures estáticos; nunca cargar datos reales con retención por defecto.
QA278 falló al parsear expresión n8n de objeto anidado, después de guardar sólo texto de fixture. Se espaciaron cierres de objeto y se reusó la misma identidad, sin duplicar paquete/texto.
QA279 SUCCESS/STORAGE_FIXTURE_VERIFIED: paquete de2items,textoUTF8/apóstrofe yPDF16bytes recuperado idéntico; cierre pendiente NOT_READY(pending1/stored1); completar STORED,duplicadoSTORED_REPLAY; reserva repetidaRESERVATION_REPLAY; READYrevision5 y cierre repetidoREADY; manifiesto2STORED y sesión vacía. No notas ni medios WordPress.
QA280 canarydeguardhistórico,sólo/v1/targets/status para solicitudChrome existente: reported/postId9697, sin escribir/republicar. Se retiró el nodo temporal de canary y restauró grafo15nodos,sin warnings.

Versionado en feat/mcp-publisher-file-draft/PR9editorial draft:881af9a(store),b371cba(tests),cb53833(builderZIP),ab2dc9b(guardserver),1f770d0(start),acd7073(QAJSONinactivo). Archivo reproducible mediante node tools/telegram/build-guard-storage.mjs. Snapshot workflows/telegram/OPMX_TELEGRAM_STORAGE_QA_H115_NO_ACTIVAR.json sin credenciales; fixture ya cerrado, no considerar rerun completo una prueba nueva. No merge a main.

Siguiente: conectar receptor al backend mediante comandos de paquete y reserva antes de descarga; conservar allowlist real y retenciónnone. Validar transporte bot→BLOB+manifiesto sin notas reales. Después MCP Events/suscripción Work/lectura de originales,MASTER y fixture draft. Sigue pendiente cierre concurrencia publicaciónH108 y CIfrontend antes de Social. H115 no significa que Telegram→Motor→publicación esté terminado.


## H114 — Recepción real Telegram validada (2 noviembre 2026, México)

Propietario informó “listo” tras reenviar. Consulta de tablaT7kVEMKmX1w2viLz devolvió3recibos reales del chat autorizado: TEXT, JPEG150508bytes y PDF300310bytes, todosRECEIPT_CONFIRMED y RECEIPT_ONLY. Fechas14:05:16–14:05:17México. Se comprobaron descarga, firma básica,bytes y acuse al chat original; no sólo ejecución exitosa. No se incluyen receipt_id/IDs personales reales ni contenido en GitHub. Workflow12nodos activo d8ffd9a9-bb23-48d6-bb95-a061316f5fff.

Este hito valida Telegram→n8n→verificación→acuse. No valida conservación de originales,agrupación,lectura por Work,eventos,Máster ni publicación. El piloto sigue descartando originales tras comprobarlos y guarda sólo metadatos mínimos. No reenvío de contenido a WordPress ni publicación de pruebas.

Siguiente acción autorizada: implementar persistencia y paquetes antes del puente al Motor. Inventario de credencialesn8n: Telegram existente y MySQL disponible; GoogleDriveOAuth0. Evaluar baseMySQL existente para metadatos y originales con límites/cuotas/queries preparadas, sin mezclar tablas del guard ni habilitar logging de archivos. Si la conexión no funciona, reportar bloqueo concreto; no tratar file_id Telegram como almacenamiento durable de originales.

Versionado: misma rama feat/mcp-publisher-file-draft/PR9editorial draft. Cambio documental; código/grafoH113 sin cambios. H113112tests yQA269–272 permanecen como evidencia sintética adicional; los3recibos reales son la evidencia nueva. Social posterior. No DNS,secretos nuevos ni publicaciones reales.


## H113 — Evidencia mínima de recepción Telegram (2 noviembre 2026, México)

El propietario informó que ya envió texto/foto/documento. La consulta de ejecuciones de OSi8AcnzLlI0csRu después de /id devolvió0 registros porque el piloto conserva saveDataSuccessExecution=none,saveDataErrorExecution=none,saveManualExecutions=false. Por ello los envíos reportados NO se declaran verificados desde n8n ni fallidos: el resultado anterior no puede reconstruirse con las herramientas disponibles. Se explicó la limitación y se pidió reenviar las pruebas después de instrumentar evidencia mínima.

Cambio: tabla personal “OPMX Telegram — recepciones verificables”,T7kVEMKmX1w2viLz, columnasreceipt_id,status,kind,mime_type,bytes_received,mode,observed_at. Sin texto,caption,nombre de archivo,file_id,URL,token ni binario. receipt_id incluye IDs de Telegram por diseño existente y sólo persiste en n8n. No se guardan datos personales de recepción reales en GitHub. Un DataTableupsert después del resultado conserva el estado final; esto permite verificar bytes y acuse sin activar retención general. El upsert es por receipt_id y NO demuestra exclusión atómica ni evita repetir acuses ante updates duplicados.

Resultado piloto ahora incluye MIME. El nodo de acuse usa continueRegularOutput sin retry para que un fallo de Telegram llegue al clasificador RECEIPT_NOT_CONFIRMED y su evidencia. Fallos anteriores al resultado o en la propia tabla siguen sin registro persistente; no es un monitor exhaustivo ni almacenamiento de originales. Los archivos sólo se comprueban en memoria; Publisher/Motor no llamados.

QA269PDF sintético16bytes+acuse,270texto+acuse,271texto+fallo de acuse,272remitente no autorizado:4ejecuciones success con Telegram fijado y DataTabledryRun=true. La ejecución success del caso271 no significa acuse confirmado: el código clasifica error de transporte como RECEIPT_NOT_CONFIRMED. Consulta posterior tabla0filas; ninguna prueba ficticia persistida. Se restauraron allowlists reales y dryRun=false antes de publicar; nunca se publicó la configuración QA1001. Suite local112PASS. No se enviaron mensajes reales desde QA.

Live:12nodos,versiónd8ffd9a9-bb23-48d6-bb95-a061316f5fff,active=true,sameAsDraft=true; credencial existente y retenciónnone/binaryModeseparate/timeout90 preservados,validación sin warnings. Tabla vacía antes de activar evidencia. La recepción real de los adjuntos con esta versión sigue pendiente. Reenviar texto,foto y PDF/DOCX≤10MiB para comprobar resultados mediante tabla.

Snapshot sanitizado workflows/telegram/OPMX_TELEGRAM_RECEPCION_H113_REFERENCIA.json,commit5bb3fbd42eafa346a307a6a9901681d7b1b6cf41. Contiene allowlists vacías y sin credenciales/webhookIds,active=false como referencia,NO desplegar directamente sobre el receptor. Misma rama feat/mcp-publisher-file-draft,PR9editorial draft. H110builder histórico y H111snapshot ya no representan el grafo actual.

Pendientes después de recepción: paquetes/originales durables,agrupación/versionado,lecturas autenticadas,MCP Events y suscripción Work,MASTER y fixture draft; cierre de concurrencia publicaciónH108 y CIfrontend antes de Social. No se conecta API de IA de pago ni se publican notas como prueba. Siguiente acción: consultar tabla tras reenvío real; no afirmar transporteTelegram→Motor funcional por este hito.


## H112 — Identidad Telegram real autorizada (2 noviembre 2026, México)

El propietario confirmó “listo” después de enviar /id a @opmxpublisherbot. Consulta de la tabla personal de candidaturas: una sola identidad privada, con user_id=chat_id, observada el 2 noviembre2026 a las13:54:57 de México. No hubo ambigüedad ni autorización del primer remitente sin confirmación. Los IDs personales quedan sólo en n8n; no se incluyen en repositorio ni este registro.

Se configuraron allowedUserIds y allowedChatIds exclusivamente con esa identidad y se publicó OSi8AcnzLlI0csRu,11nodos,versión4add8a03-d554-49d6-a214-03d43772b1b6. Readback: active=true,activeVersion.sameAsDraft=true,ambas allowlists correctas. Credencial existente preservada,retenciónnone/none/saveManualExecutions=false,binaryMode=separate,timeout90s. Actualización1operación,sin warnings. La llegada real de /id queda comprobada por el registro del trigger; la prueba real de descarga de archivos sigue pendiente.

Verificación local:112PASS,0FAIL,ejecutando desde la raíz recovery-pr9. Primer intento desde el directorio padre falló por rutas relativas de fixtures; repetido desde la raíz correcta pasó sin modificar código. No se generaron notas ni se llamó Publisher/WordPress/Social. No se almacenaron originales ni se implementaron eventos Work en este hito.

Siguiente prueba del propietario: enviar al mismo bot un texto corto, una foto y un PDF o DOCX de prueba (cada archivo≤10MiB). Se espera acuse individual; aún RECEIPT_ONLY, sin agrupación,generación ni publicación. Después implementar paquetes y originales durables, lecturas autenticadas, MCP Events/Work y fixture draft con el contrato existente. No reutilizar el adaptador OpenAI con URLs Telegram. Social posterior; limitacionesH108 y CI frontend permanecen.

Versionado: rama existente feat/mcp-publisher-file-draft,PR9editorial draft. El grafo H111 sanitizado sigue siendo referencia: no cambia el grafo, sólo configuración privada de identidad. No sustituir configuración live por el snapshot de referencia con allowlists vacías.


## H111 — @opmxpublisherbot conectado; identificación /id activa (2 noviembre 2026, México)

El propietario confirmó credencial lista y bot @opmxpublisherbot. La credencial Telegram API “OPMX — Telegram editorial” existe en el proyecto personal correcto y ya estaba asociada por el propietario a trigger, descarga y acuse. Se reutilizó sin leer token ni crear otra credencial. Antes de tocar se leyó el estado real: versión92b2cd48-ff58-473b-bf67-fe056f45cfc8,binaryMode=separate,allowlists vacías,retenciónnone.

Piloto OSi8AcnzLlI0csRu ahora ACTIVO,11nodos, versión9a45fd99-4ccf-490d-a6fb-ee77eaa9750a. n8n confirmó activación y lectura posterior active=true/sameAsDraft. Esto confirma configuración/activación, no recepción real de un mensaje Telegram: falta el /id del propietario. No se enviaron mensajes reales de prueba a terceros ni se generaron/publicaron notas.

Para evitar pedir copiar números al chat, /id privado registra sólo bot_username,user_id,chat_id,last_update_id,last_message_id,observed_at en la tabla personal “OPMX Telegram — identidades candidatas”,1NHMjthWiPVcAMPB. Es una candidatura de identidad, NO una autorización automática ni elección del primer remitente. Se deberá confirmar al propietario en esta conversación y resolver ambigüedad si aparece más de una identidad; después llenar la allowlist. No guardar IDs personales reales en GitHub ni registrar cuerpos, tokens o archivos en esa tabla.

Se añadieron IF de identificación, upsert con filtros bot+user+chat y restauración de contexto antes del acuse. Durante QA se usó dryRun=true y Telegram trigger/acuse/descarga fijados con datos sintéticos. QA263 success y consulta posterior tabla0filas: ninguna identidad ficticia persistida. Luego se cambió dryRun=false antes de activar; las allowlists reales siguen vacías. Retención none/none/saveManualExecutions=false,timeout90s y binaryMode separado se conservaron. Grafo agrupado,validación sin warnings. /id puede responder al remitente sus propios IDs; el resto del contenido no se descarga mientras no esté autorizado.

Estado posterior a activar: consulta de candidaturas0filas. El usuario debe enviar /id al bot. Work podrá recuperar los IDs desde n8n, sin pedir token ni que el usuario copie números. Hasta confirmar esa recepción, no declarar probado transporte real de archivos.

Siguen pendientes: autorización del chat, foto/PDF/DOC/texto reales de prueba, almacenamiento durable de paquetes y originales, agrupación/versiones, MCP Events y lectura por Work, generación de MASTER y draft fixture. PublisherH108 activo sin cambios; Social posterior. Esta tabla mínima no es almacenamiento de originales, idempotencia de publicación ni un listener Work.

Versionado: misma rama feat/mcp-publisher-file-draft/PR9editorial. SnapshotH111 sanitizado, sin credenciales/webhook IDs; H110 queda como histórico inactivo. Guía docs/OPMX_TELEGRAM_PILOT.md actualizada. Siguiente paso seguro: /id real del propietario; confirmar identidad y permitir recepción sólo en su chat. No DNS,credenciales nuevas ni publicaciones de contenido.


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


## H109 — Factibilidad Telegram → Motor editorial (2 noviembre 2026, México)

Alcance autorizado: evaluación de factibilidad previa a implementación. No se activaron bots, webhooks, suscripciones, tareas ni publicaciones. No se modificó código ni configuración de n8n/Publisher.

Hallazgo documental confirmado: MCP Events permite que ChatGPT se suscriba a eventos de un servidor MCP y reciba avisos en el chat suscrito. Está documentado para Work web, Work desktop con Cloud y dots, sujeto a controles de cuenta/workspace. Un proyecto ChatGPT puede contener chats normales y Work y compartir archivos, instrucciones y fuentes; eso no equivale a compartir automáticamente todo el historial de otro chat. Por tanto, la hipótesis del listener tiene una vía oficial: un chat Work específico DENTRO del proyecto Motor Editorial, no una API supuesta para inyectar mensajes al chat normal existente.

Arquitectura candidata A: Telegram bot → n8n agrupa fotos/documentos/texto por paquete → evento MCP con ID/resumen → chat Work del Motor recupera adjuntos por herramientas autenticadas y genera MASTER vigente → Publisher existente → estado/enlaces por Telegram. Eventos son avisos, no transporte de originales; máximo documentado256KiB por evento. Requiere implementar events/list,events/subscribe,events/unsubscribe, verificar callback, guardar suscripciones y renovación, y exponer lectura del paquete/medios. Aprobación editorial y publicación deben asociarse a un paquete/versión y usuario autorizado; el texto de documentos no debe convertirse en instrucciones de publicación.

Arquitectura candidata B: Telegram → n8n → Responses API con maestros editoriales versionados → validación MASTER → Publisher → Telegram. Es una alternativa para ejecución independiente del chat. Responses admite PDF y documentos/texto; PDFs con modelo visual incluyen imágenes de página, DOC/DOCX se procesan como texto y sus imágenes embebidas requieren tratamiento separado. No se heredan automáticamente las instrucciones, memoria ni archivos del proyecto ChatGPT. No se eligió modelo ni se estimó coste en esta evaluación.

Estado propio leído: adaptador bnzVMNkZuGO1GQCZ activo cc976feb-b414-4a7b-9b8c-f1b1a787ec38,60nodos,H108. initialize anuncia herramientas, no eventos; no implementa events/subscribe. Búsqueda por Telegram en nombres/descripciones de workflows devolvió0; esto no es auditoría exhaustiva de todos los nodos ni prueba de que no exista otro bot. El catálogo n8n sí dispone de Telegram Trigger1.5 y Telegram file/get, con descarga de adjuntos. No se accedió a tokens.

Reutilización: conservar contratos/editorial/guard/WordPress. El adaptador fileParams actual sólo admite orígenes de archivos OpenAI; NO enviar URLs Telegram a ese adaptador ni ampliar su lista a ciegas. La nueva entrada necesita almacenar y entregar originales desde n8n y reutilizar la publicación común. El grafo H108 usa contexto de nodos MCP: hay adaptación de canal, no simple enchufar un listener. Sigue pendiente la concurrencia del POST de publicación señalada en H108.

Prueba mínima propuesta, NO ejecutada: mensaje Telegram +foto+PDF/DOC/texto, paquete único, evento firmado aceptado en Work y lectura real de los adjuntos; generar MASTER y un borrador de fixture con el contrato vigente. Comprobar reenvíos, orden de llegada, asociación de archivos y respuesta Telegram. Publicación pública sólo con orden explícita sobre una nota concreta. Disponibilidad efectiva de eventos, permisos de acciones en background y calidad editorial deben comprobarse en la cuenta; factibilidad documental no equivale a validación end-to-end.

Fuentes primarias consultadas2nov2026:
https://developers.openai.com/plugins/build/mcp-events
https://learn.chatgpt.com/docs/projects
https://developers.openai.com/api/docs/guides/file-inputs
https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.telegramtrigger/
https://core.telegram.org/bots/api

Recomendación para la siguiente decisión: probar primero A si se prioriza conservar el contexto del proyecto; B si se prioriza un servicio independiente del chat. No hay decisión de implementación tomada ni registro de aprobación nuevo.


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


## H106 — Frescura de ediciones WordPress a 60 segundos, PRODUCCIÓN (1 noviembre 2026, México)

Usuario rechazó15min y pidió editar WordPress y ver cambios con ventana30–60s, incluyendo /ni-ingenuos-ni-populistas-mexico-en-la-era-de-la-ia/. Diagnóstico: layoutISR60s pero cliente WordPressdatos900s y reglasCDN editoriales adicionales900s; edición manual no llama invalidación de Publisher. Chrome9697 sí estaba primero en APIhome; portada vieja correspondía a caché. No se alteró contenido de notas.

Desplegado en proyecto correcto oxigeno-puro-com-mx, prj_2VETh50RkVNY5Rmpx3EHVlAzXoDB, equipo team_sVtKADMiX547FdpceiUUMbb1: producción dpl_CYaYKnNThrEnn4uRDumSx4x1m19y READY, alias oxigenopuro.com.mx/www asignados por Vercel sin DNS. Commit a1c7a848028fc5e9d5a8ffd6af2d4d601ec6deb6, rama fix/home-publication-freshness, PR9 DEL REPO FRONTEND (no confundir con PR9 editorial). Main frontend sigue aa30ce8; no merge mientras CI de navegador no cierre. Producción fue desplegada desde la rama de hotfix con entorno production; no se promovió un preview noindex.

Todas las consultas editoriales home/artículos/categorías usan60s. Se retiraron reglasCDN extra900s y se usa caché nativa Next; layoutISR60s preservado. Invalidación autenticada Publisher cambia revalidateTag(max) por revalidateTag({expire:0}) para no regenerar con datos marcados stale. Cachés de imágenes/sitemaps y límites de gasto no cambiaron. Son60s bajo demanda, con posible primera respuesta stale durante regeneración; no es push ni recarga automática de pestañas abiertas. Recargar consulta la revisión; no prometer tiempo cero o máximo rígido ante fallos de origen. No se introdujo flag experimental staleTimes de cliente (sigue comportamiento de navegación de Next).

Evidencia: preview final dpl_AU4muJtJ18EJKTvcsrguQJp8pdLw READY,200/nota vigente/noindex. Producción200 en / y nota, data-dpl-id confirmado, sin noindex de preview. Nota9701 revisiónCMS2026-11-02T01:23:12Z: coincide dateModified y cuerpo HTML literal con respuesta pública19:25MX. QA130 leyó revisión previa01:14;132 invalidó sólo caché vía credencial existente (HTTP200,tags/rutas correctos,0escrituras contenido);133 leyó revisión más reciente y se cotejó con frontend. Diagnóstico restaurado a GET público sin credenciales, inactivo.

CI head a1c7a84: lint,TypeScript,56unitarias y build PASS; WordPress6.6/latest PASS run41371809638. E2E sigue sin aprobar: next start detecta conflicto PREEXISTENTE de carpetas dinámicas app/[category]/… y app/[slug]/… ('category' !== 'slug'); identificado en logs del run41370100765, no causado por TTL. PR queda abierto; no declararCI completoverde. Preview y producción Vercel fueron verificados por su runtime, distinto de next start del runner. Se alinearon pruebas antiguas de marca,tags,URLs; catálogo agregado elimina5slugs repetidos conservando primera entrada, sin cambiar menús; fixturePHP aparta a draft el post de ejemplo inicial sólo en base explícitamente desechable.

Dos erroresTLS ECONNRESET hacia CMS observados en precargas /suscribete y /category/noticias tras despliegue; / y nota objetivo200 y cuerpo vigente. Sin reintentos globales ni reactivación de Observability. Registrar seguimiento de origen; no confundir con error list-item ya cerradoH105.

Siguiente: cerrar conflicto de rutas y CI en cambio acotado antes de merge; conservar hotfix vivo al hacerlo. Continuar conexión nativa MotorH104: sesión ChatGPT ya autenticada; formulario MCP preparado, OAuth/DCR detectado y recurso POST correcto. Se están retirando scopes administrativos; conector AÚN NO CREADO ni autorizado. No afirmar binding real de archivos. Hotfixlist-itemH105 continúa activo (formulario4d477bfd…, automática c29101d9…). Redes y publicación automática pública siguen pendientes.


## H105 — Hotfix list-item desplegado en Publisher operativo (2026-11-01 México)

El usuario reportó un formulario con error `GUTENBERG_ENRIQUECIDO_FINAL usa bloques no autorizados: list-item. [line 259]`. Ejecución126 terminó con error capturado por el formulario: el normalizador emitió por su salida de error antes de subir medios/crear notas. Fue una omisión de la allowlist de listas nativas en el contrato y en el validador. Se añadió core/list-item a contrato enriquecido v1.0, salida v1.4 e instrucción v1.1, y a ambos validadores. No se elimina contenido ni se transforma a HTML libre. HTML y bloques custom siguen bloqueados.

ACTIVO/VERIFICADO: formulario Mt7ts2EGPbyaTC2o versión4d477bfd-ab9d-46f9-b174-7f9a7b923e8a,68nodos; entrada automática4o7K5TmKc7joScqB versiónc29101d9-afaa-45b9-990e-1047ce2a19a9,91nodos. Draft y versión publicada cotejados. Advertencias de defaultValue del formulario y disposición preexistentes sin modificar; sin advertencias nuevas. Prueba n8n128 ejecutó los dos normalizadores exactos con fixture sintético:6comprobaciones, listas anidadas preservadas y HTML/custom rechazados,0escrituras. 95 pruebas locales pasan, incluidas4nuevas para ambos validadores y serialización core/list-item con/sin namespace. Referencias regeneradas coherentes; nueva exportación sanitizada OPMX_Publisher_MEDIA_v1.3.5_H105_LISTAS.json. No reenviar la nota Chrome#119 ya existente.

Commits29fc722,d433953,7195af2,25105fe,19bf644,648578f,3e5d92a,dda6929,4db1a29,1eb4d67, rama/PR9 editorial existentes. H105 y D-033 en Drive. No DNS, publicaciones ni nuevas cargas CMS en este hotfix.

Tareas paralelas aún pendientes: usuario exigió portada60s (15min rechazados). CMS público QA127 entrega Chrome9697 como primer Hero y latest; fetchVercel al consultar0051UTC ya lo contiene, mientras lector web anterior mostraba caché vieja. Datos home900s contradicen layoutISR60s y documento guardrails60s. PR9 DEL REPO FRONTEND (no confundir con PR9 editorial), rama fix/home-publication-freshness, head9b98727: home60s/resto900s; expira tags con expire0 al publicar y retira cabeceraCDN adicional de portada. CI en curso antes de merge/despliegue; no afirmar todavía corregido en producción. El usuario priorizó primero este hotfix Publisher.

MCP archivos H104 sigue pendiente de conexión única: autenticación segura ChatGPT eligió Google; navegador en MFA de OpenAI/clave de acceso. Sin sesión completada ni prueba nativa de archivos. No confundir hotfix del formulario con cierre de la experiencia desde Motor. Publicación pública automática y redes siguen pendientes.


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


## HISTÓRICO H103 — primera entrega REAL desde Library mediante Work (2026-11-01 México)

El usuario compartió un reporte del Motor: MASTER Chrome e imágenes localizados, pero envío no iniciado por falta de capacidad para transferir bytes; identificador previsto opmx-chrome-319-c4419b28487cdaff. Se comprobó que no había ejecución nueva en la entrada. Work leyó el MASTER vigente (CONTROL_EDITORIAL=LISTO) y materializó mediante Library los JPG Hero250281bytes/1448x1086 y destacada95083bytes/1200x630, preservando su metadata. No se modificó el paquete editorial ni se cambió el identificador.

Entrega real aprobada executionMode=production: #119, modo webhook, 2026-11-02T00:14:25.114Z–00:15:07.803Z (1nov18:14–18:15 México), SUCCESS/DRAFT en ambos. OPUROpost9697, OPOLpost2787, slug extensiones-maliciosas-de-chrome-319-busquedas. URLs de edición devueltas por n8n. Readbacks verificaron contenido, medios y SEO; no revisión visual ni cotejo byte-a-byte de archivos CMS. No publicación pública. No reenviar: los borradores ya existen y la identidad está consumida en guard.

Se agregó puente Work tools/mcp-publisher/prepare-local.mjs: lee MASTER e imágenes ya materializados, exige LISTO y request_id estable, comprueba firmas/límites y fuerza PUBLICAR=false; guarda payload0600 sin sobrescribir y no hace llamadas remotas. Su resultado se cotejó localmente con el payload #119: MASTER, identidad y bytes coinciden; no hubo segundo envío. 84 pruebas locales pasan. Commits b00123e,dcefe19,508a64d; guía311279d. Workflow v2 permanece activo y no se modificó para esta entrega.

LÍMITE: este puente requiere runtime Work para archivos. La entrega directa desde el chat Motor que carece de esa capacidad no está habilitada, aunque pueda ver archivos o el workflow. Ruta verificada: Motor genera/aprueba y guarda en Library → Work recoge por nombre/ID y envía con conector oficial n8n → ambos drafts. No afirmar que un prompt haya dado capacidad de leer bytes al Motor; no pedir copiar HTML/Base64 al usuario. Pendientes: entrega directa desde ese chat si se provee mecanismo compatible, publicación pública automática y Social, recuperación OPOL con cotejo CMS, exclusión otros publicadores y lockfile. No DNS ni secretos nuevos. PR9 sigue draft; CI remoto/main no declarados actualizados.

## ESTADO VIGENTE H102 — OPURO / OPOL / AMBOS, borradores automáticos ACTIVOS (2026-11-01)

Se extendió EL MISMO workflow 4o7K5TmKc7joScqB, sin cambiar webhook ni autenticación. Versión activa ef6429a7-d56e-4600-82c9-05191aa49bb5, 90 nodos; rollback H101 c6ec4283-becb-4a1f-b83d-730ea2073934. OPURO, OPOL y AMBOS admitidos con PUBLICAR=false. Se consultan duplicados en destinos seleccionados y el guard reserva ambos en una sola petición antes de escribir; procesamiento secuencial OPURO→OPOL. OPOL reutiliza el contrato y nodos del Publisher operativo: GUTENBERG_FINAL, destacada, autor técnico2, categoría, etiquetas, opmx_editorial y Rank Math; readbacks reforzados. OPURO conserva GUTENBERG_ENRIQUECIDO_FINAL y Hero propio. La entrada nativa ya seleccionaba json_file explícito, por eso OPOL con una sola imagen no se confunde con JSON; el formulario histórico mantiene su comportamiento propio.

PRUEBAS REALES sintéticas: #113 AMBOS SUCCESS, OPURO draft9685 con Hero9683/destacada9684 y OPOL draft2771 con destacada2770; readbacks editoriales/SEO correctos en ambos. #114 OPOL solo, draft2776, OPURO SKIPPED. #115 replay de #113 bloqueado en duplicados antes de reservar/cargar. #116 OPURO solo, draft9689, OPOL SKIPPED. Ningún contenido se publicó. 81 pruebas locales pasan; grafo instalado sin advertencias y parámetros/conexiones cotejados con fuente. Resultado parcial tras fallo OPOL conserva borrador OPURO con PARTIAL_SUCCESS; probado con dobles localmente, no fallo real entre CMS. Si OPURO falla se detiene antes de OPOL; no se revierte CMS ni se autoriza reenvío. Recuperación OPOL automatizada con CMS aún no implementada; emite conciliación manual y usa ledger.

Commits 053b64d generador,297634b pruebas,fbce1b4 export v2,fc9c019 guía. La primera actualización grande de157 operaciones fue rechazada por argumento inválido sin mutar; aplicada después en lotes42/31/84 sobre draft y activada tras pruebas. Credenciales existentes se reutilizaron sin nuevos secretos. Proyecto personal OXÍGENO PURO, raíz. No cambios DNS ni publicaciones reales. Siguiente: entrega de paquete aprobado con ambos Gutenberg y archivos accesibles desde Motor; probar tamaños habituales, publicar nota real sólo con autorización específica y desarrollar Social. El formulario sigue sin guard: evitar concurrencia del mismo slug entre rutas. PR9 continúa draft; main y CI remoto no declarados actualizados/verdes.

## ESTADO VIGENTE — entrada automática de borradores OPERATIVA H101 (2026-11-01)

Workflow 4o7K5TmKc7joScqB ACTIVO, versión c6ec4283-becb-4a1f-b83d-730ea2073934, proyecto personal OXÍGENO PURO raíz. Trigger Entrada automática protegida, webhook /opmx-automatic-opuro-draft-v1 con n8nOAuth2 y requireExecuteAccess. Usa conector oficial n8n existente; NO requiere desplegar servidor MCP Node experimental ni OAuth nuevo. Recibe request_id estable, MASTER, Hero/destacada base64, CREAR_EN=OPURO y PUBLICAR=false; reutiliza guard durable, valida metadata de medios y post. Devuelve Resultado consolidado OPMX con SUCCESS/DRAFT y URL de edición. Sólo drafts: no publicación pública ni Social.

Evidencia REAL: #108 paquete ENTERAMENTE SINTÉTICO completo, reserva guard, Hero 9679/destacada 9680 y draft 9681; comprobó Gutenberg literal, título/slug/autor/taxonomía, subtítulo/crédito y Rank Math. #109 replay detenido en duplicados antes de reservar o subir. #110 POST vacío anónimo al webhook activo devuelve 401. #111/hijo #112 cotejo recuperación: guard postId=9681, medios 9679/9680 reportados y CMS mismo draft, retryPermitted=false; no verifica bytes de medios ni snapshot. Recuperación C4hk6fQQomueYC8f también publicada, versión f0a0336b-5d7e-447a-b291-8f899429af19; publicación del padre exigió esta dependencia. QA #104–#107 y #110 archivados tras validación; objetos de prueba persisten sin publicar. Fixture de 4jfAnjMbwp3neygK restaurado.

77 pruebas locales pasan; SDK válido de 48 nodos. Export sanitizado, SDK, generador y pruebas en commits c4cf02e, 9ff444d, 837f22a, 23148f3; guía operativa 9150e0f. SDK newCredential sólo son placeholders; n8n usa las credenciales existentes, no se crearon secretos. PR #9 sigue draft; no declarar CI remoto verde. Siguiente: usar la guía docs/OPMX_AUTOMATIC_DRAFT_RUNBOOK.md desde el chat Motor con archivos realmente accesibles y paquete aprobado; validar tamaños habituales. Faltan publicación pública automática, Social, exclusión de otros publicadores y lockfile. El formulario Publisher sigue disponible y omite este guard: no usarlo simultáneamente para el mismo slug. No afirmar transporte automático de adjuntos en otro chat sin probarlo. La limitación previa de revisión se resolvió con alcance reducido a fixtures sintéticos y drafts, no eludiendo el rechazo original. No DNS ni notas reales publicados.

## Avance Work II — CMS real sintético y corrección ACTIVA del Hero H100 (2026-11-01)

Se dejó de tratar el rechazo previo como prohibición universal: una alternativa más acotada, workflow nuevo draft-only y fixture enteramente sintético, fue aceptada por revisión. #104 (KBYWwIkAGqkU9hXE) creó post 9674, slug opmx-qa-sintetico-h100-20261101 y readback draft. #105 (WBnpAlGnSov5XIjT) subió PNG de 1 píxel Hero 9675 y destacada 9676 y metadata, pero falló antes de asignarlos al post por expresión de QA inválida. No se repitieron cargas. #106 actualizó exclusivamente el draft 9674 con esos IDs, subtítulo/crédito y tres campos Rank Math, y confirmó readback. #107 (fxh0jUH1ieEmBf0l) probó expresión EXACTA corregida de creación del Publisher contra ese draft fijo, con categorías/tags/autor de fixture; pasó. No se publicaron notas reales. Objetos QA persisten; no reejecutar cargas. QA creados en proyecto personal OXÍGENO PURO, sin carpeta, inactivos.

Se encontró que Publisher activo omitía oxpuro_hero_media_id y oxpuro_editorial y tenía dos Content-Type con sintaxis inválida ={$binary...}. Se corrigieron exactamente esos tres nodos OPURO y se publicó versión bf2f7efc-9d50-4948-bef1-be3c1f911616 en Mt7ts2EGPbyaTC2o, preservando conexiones; rollback previo 985317bf-3ac4-4f23-84ed-87ef7c7f2898. Export sanitizado H100 en commit 7b2ab9c; QA 510a91e, 3da8643, 604522b. Persisten advertencias preexistentes del formulario defaultValue tipo array y disposición visual; no cambiadas en este hito. No se ejecutó el Publisher completo, aún recibe por formulario. Entrada automática, guard y recuperación siguen pendientes de enlace; usar conector n8n ya autorizado evita inventar un servidor OAuth nuevo. No afirmar que integración total o redes estén terminadas.

## Avance Work II — corrección de identidad en transporte (2026-11-01)

Se detectó incompatibilidad real en prototipo Node: prepareDraft omitía request_id aunque el preparador n8n lo exige; toda entrega con ese contrato fallaría antes de las escrituras. Ahora prepareDraft valida y transmite request_id, y server entrega el hash estable sujeto+request_id que también usa el ledger del prototipo. Dos pruebas adicionales ejecutan código exacto del preparador n8n con archivos PNG simulados y comprueban rechazo de identidad inválida; prueba servidor verifica hash enviado. 74 pruebas locales pasan. Commits 68dcff2, 1c88503, 8560d9d, fb22076 en PR #9; no desplegado, no prueba real n8n/WordPress, no Publisher activo. El endpoint Node desplegado sigue siendo guard, no este servidor experimental MCP; no existe OAuth validado ni puente productivo conectado. Sigue pendiente backend, proveedor de autorización, acceso a archivos, contratos de salida, y prueba integral WordPress en entorno permitido. Revisión automática anterior rechazó ejecutar flujo con nodos de escritura WordPress incluso desconectados; no eludir. H-099 Drive.

## Avance Work II — prueba nativa de salida de error (2026-11-01)

Workflow inactivo MED9O8N2QJWFOsgD en proyecto personal OXÍGENO PURO, sin carpeta: cinco nodos sin escritura ni credenciales propias, error Code sintético enlazado por continueErrorOutput a la recuperación de sólo lectura. Ejecución #102 terminó success: error salió por puerto 1, preparó identidad sintética y llamó al subworkflow C4hk6fQQomueYC8f (#103). El informe confirmó identidad de guard, consulta CMS por slug sin coincidencia exacta, conciliación manual, retryPermitted=false. No se escribió ni reservó. JSON de referencia del QA b9ed379, incluye ID del hijo específico de instalación. Esta prueba valida enrutamiento de error de un nodo Code, no los nodos HTTP de escritura ni el workflow Publisher completo. Referencia del Publisher sigue sin importar o activar; exclusión entre publicadores, medios y prueba integral de borrador pendientes. Rechazo automático previo impide ejecutar un workflow que contiene nodos de escritura WP incluso desconectados; no eludir. H-098 Drive.

## Avance Work II — recuperación conectada en referencia aislada, no activa (2026-11-01)

La referencia guardada OPURO ahora dirige la salida de error de nueve nodos seleccionados de escritura o reporte (Hero, destacada, borrador, Rank Math y reportes guard) a un preparador de identidad y al subworkflow de recuperación de sólo lectura C4hk6fQQomueYC8f. Conserva la salida de éxito anterior; la salida de recuperación no retorna al camino de escritura ni reintenta. El ID es específico de esta instalación n8n. No cubre todos los fallos, por ejemplo fallos de validación y etiquetado; ante ellos sigue aplicando conciliación manual. El subworkflow consulta guard y CMS sin escritura, no ofrece snapshot ni verifica medios. No se ha importado, validado ni ejecutado este grafo en n8n; no activar y no confundir con Publisher activo. 72 pruebas locales aprobadas, incluyendo inspección estática de errores y ejecución simulada del preparador; no prueban semántica nativa de n8n ni operaciones reales. Commits e9b07ca, afca66a, 633f5f8. Revisión automática previa rechazó ejecutar workflow con nodos de escritura WP aunque desconectados: no eludir. Pendientes: verificación nativa en entorno WordPress aislado permitido, cobertura de errores y resultados parciales, exclusión de otros publicadores, integración revisada al Publisher activo y prueba de borrador. Social pendiente. Ver H-097 Drive.

## Avance Work II — recuperación de sólo lectura en n8n (2026-11-01)

Subworkflow inactivo C4hk6fQQomueYC8f en proyecto personal OXÍGENO PURO, sin webhook, reutiliza credenciales existentes para consultar guard /v1/recovery/status y luego WordPress por slug exacto con GET autenticado. No reserva, no escribe ni publica; rechaza identidad no confirmada antes del GET; devuelve conciliación manual y retryPermitted=false. Las lecturas no constituyen snapshot ni acreditan ausencia global; no verifica medios. Workflow de prueba inactivo 4jfAnjMbwp3neygK invoca este subflujo con identidad sintética. Prueba positiva padre #98 / hijo #99: identidad matched, target writing y medios uploading sin IDs, WordPress sin coincidencias exactas, sin reintento. Prueba negativa padre #100 / hijo #101: huella distinta, identity_mismatch y error antes de consulta WordPress. Fixture positivo restaurado. Fuente SDK y pruebas en commits 6478420 y 94b811d; 71 pruebas locales Node. Sin publicación ni cambios al Publisher activo o DNS.

Pendiente: integración con flujo Publisher activo y guard, manejo seguro de fallos tras escrituras, conciliación de medios, exclusión entre publicadores y prueba integral de borrador en entorno permitido. La revisión automática rechazó antes ejecutar un flujo con nodos de escritura WP incluso desconectados; no eludir. Redes aún no integradas. H-096 Drive.

## Avance Work II — cotejo de lectura CMS y guard (2026-11-01)

Tras el rechazo H094 se explicó al usuario que el preflight reutilizaría el paquete editorial e imágenes existentes, haría sólo lectura WordPress y podría generar reserva persistente; el usuario lo autorizó explícitamente. Se verificó nuevamente workflow inactivo `8ufo4fYPAc7ObNVC`: GET de WP y POST de reserva guard, sin nodos HTTP WP de escritura, PUBLICAR=false. Ejecución #96 aceptada: el GET autenticado WP terminó correctamente y el filtro devolvió SIN_COINCIDENCIA_EXACTA para slug sintético `opmx-preflight-huella-imagen-20261101`; el guard rechazó la reserva ya existente con HTTP 409 conflict_or_replay, así que la ejecución total quedó error esperado. No se creó nota, medio ni nueva reserva.

Con fingerprint generado en #96, el workflow diagnóstico inactivo de dos nodos consultó `/v1/recovery/status` para misma identidad: ejecución #97 HTTP 200, reserva claimed/matched; target, Hero y featured not_found; retryPermitted=false, wordpressVerified=false, consistentSnapshot=false. Las dos observaciones son consultas separadas, no snapshot y no demuestran ausencia global de medios u otros borradores; una ausencia WP exacta no autoriza reenviar. El workflow de diagnóstico se restauró a lectura original e inactivo.

Alcance: se cotejaron manualmente consultas reales con la misma identidad; la comparación CMS + guard NO está automatizada ni integrada en Publisher y no se ha probado un borrador real nuevo. Pendiente construir consumidor seguro de sólo lectura con evidencia, resolver conciliación con WP/medios e incertidumbre, exclusión otros publicadores y prueba integral autorizada; después redes. Hitos Drive H-094 a H-095. Sin escritura WP ni DNS.

## Avance Work II — verificación CMS bloqueada por revisión automática (2026-11-01)

Tras desplegar y verificar endpoint H093, se inspeccionó el workflow preflight inactivo `8ufo4fYPAc7ObNVC`, que incluye consulta GET WordPress y reserva guard, sin nodos HTTP de escritura WordPress. Se intentó reejecutar por MCP el payload guardado de la ejecución #45, con PUBLICAR=false e imágenes; la revisión automática rechazó ANTES de ejecutar porque el payload era editorial real con imágenes grandes y el workflow podía crear reserva persistente; exigió no eludir el rechazo ni ejecución indirecta. No hubo nueva ejecución, envío ni reserva como resultado del intento. No inferir que el CMS haya sido consultado en esta iteración ni que el usuario haya autorizado publicar contenido real.

Resultado del hito: endpoint guard de lectura desplegado y comprobado con identidad sintética; WordPress, consumidor de recuperación e integración Publisher sin validar. Siguiente: plantear por canal permitido un fixture enteramente sintético y una verificación estrictamente de lectura, sin reutilizar el payload rechazado ni generar reserva, sujeto a que la revisión automática lo permita. Antes de cualquier escritura WordPress usar un entorno de prueba adecuado y respetar controles. Ver H-093 y H-094 en Drive. Ningún cambio a WP, Publisher activo o DNS.

## Avance Work II — recuperación consolidada desplegada (2026-11-01)

Con confirmación del usuario, `opmx-guard-recuperacion-h092.zip` SHA256 7cecc6ebe4dd22d3a8ab9306c1f4b650a281e729bf63187dd513b76fbb5caad6 se instaló en publisher.oxigenopuro.com.mx; Hostinger lo marca completado y actual. n8n diagnóstico inactivo, dos nodos y credencial existente: #94 consulta `/v1/recovery/status` con requestId, slug, destino y fingerprint sintéticos reales en DB; HTTP 200, reserva claimed/matched, destino writing/postId null, hero y featured uploading/mediaId null, action manual_reconciliation, retryPermitted=false, wordpressVerified=false, consistentSnapshot=false. #95 usó huella diferente: HTTP 200 identity_mismatch sin avance de destino ni medios y reintento deshabilitado. No se probaron timeouts de DB ni el endpoint con falta de reserva en vivo. Workflow diagnóstico restaurado a consulta original e inactivo. No se añadió acceso ni credenciales, no se escribieron notas ni se cambiaron DNS.

Alcance: endpoint real de guard disponible y validado en estos dos casos de lectura; no está integrado al Publisher activo, no compara WordPress, no reanuda ni libera y no equivale a una recuperación terminada. Pendiente consumidor seguro y lectura WP para confirmar post/medios, procedimiento de incertidumbre, exclusión entre publicadores y prueba integral de borrador; redes posteriores. Revisión automática anterior rechazó ejecutar flujo con nodos de escritura WP incluso desconectados; no eludir.

## Avance Work II — endpoint consolidado de recuperación preparado (2026-11-01)

En rama, commits 0eb4de5 y e091b45 agregan POST autenticado `/v1/recovery/status` al guard. Exige exactamente requestId, slug, destination y fingerprint válidos, comprueba reserva y huella antes de consultar avances de destino y medios; requiere OPURO/OPOL. Si falta identidad o es errónea no devuelve avances de destino. Sólo ejecuta SELECT; devuelve `retryPermitted:false`, `wordpressVerified:false` y `consistentSnapshot:false`, porque las consultas son secuenciales, los IDs los reporta el worker y WP aún no se consulta. Error de base produce 503 not_confirmed, sin reintentos, escrituras ni liberación. 69 pruebas locales pasan con dobles, incluida prueba HTTP autenticada, SQL sólo lectura, identidad incorrecta y fallo de DB.

ZIP reproducible preparado `opmx-guard-recuperacion-h092.zip`, SHA256 7cecc6ebe4dd22d3a8ab9306c1f4b650a281e729bf63187dd513b76fbb5caad6. Comparado contra H089 sólo cambia guard-server.mjs. NO desplegado, NO probado contra MariaDB real, NO conectado al Publisher o a verificación WordPress. Preparar despliegue autorizado y prueba de identidad sintética usando workflow de diagnóstico inactivo y credencial ya existente; restaurar luego. Continuar con lectura autenticada WP e integración segura, manteniendo revisión manual. El rechazo automático anterior de ejecución de workflow con nodos de escritura WP sigue vigente, no eludir. Sin cambios DNS ni WordPress.

## Avance Work II — inspección de resultados inciertos (2026-11-01)

Añadido prototipo de sólo lectura `tools/mcp-publisher/reconcile.mjs`, exporta `inspectRecovery(identity,{secret,fetchImpl,timeoutMs})`: identidad requiere requestId, slug, destination y huella SHA256; usa sólo POST a endpoints fijos guard /reservations/status, /targets/status y /media/status (Hero y destacada OPURO; destacada OPOL). Comprueba fingerprint primero y detiene demás consultas salvo claimed+matched; sin redirecciones; suprime respuestas y errores desconocidos, no expone secreto; cada respuesta o ausencia conduce a `manual_reconciliation`, `retryPermitted:false`. Las lecturas son secuenciales y no son snapshot; IDs comunicados son reportes del worker, no prueba de WordPress. Nunca reintenta, libera reservas, escribe WordPress ni publica. Commits b347924 y bf1a4e0; 68 pruebas locales pasan, incluyendo fixtures con respuestas reales, identidad incorrecta, errores, ausencia, destino OPOL. El módulo se probó con dobles, no fue desplegado ni integrado a n8n/Publisher; depende de un consumidor seguro y acceso legítimo a la huella/credencial.

Se contrastaron respuestas REALES de la identidad sintética `opmx_dual_h088_20261101` desde workflow inactivo de dos nodos con credencial preexistente: #90 reserva claimed/identity matched; #91 destino writing/postId null; #92 Hero uploading/mediaId null; #93 destacada uploading/mediaId null. Consultas sucesivas separadas, no ejecución real del nuevo módulo y no verifican WordPress. El flujo de diagnóstico quedó restaurado a lectura base e inactivo. No medios, WP ni DNS modificados. Pendiente conectar inspección a experiencia de operación, consultar WP sin escritura, procedimiento seguro para resultados parciales y estados inciertos, exclusión de publicadores externos, prueba de borrador WordPress autorizada por controles y social. No habilitar reenvíos automáticos.

## Avance Work II — mysql2 actualizado y verificado (2026-11-01)

Con autorización se desplegó `opmx-guard-mysql2-h089.zip` SHA256 f9bd41a5385336c0ced68df14b9dc642fb9cfc5d48ca1f6a82a012d2e5f8cab3 en Hostinger; implementación 01a1990e-52ae-72ce-a756-ce1768e16ea3 completada 15:40 MX, Node 24. Registro de npm install: 12 paquetes añadidos, 13 auditados, found 0 vulnerabilities en ese momento. El ZIP fija mysql2 3.24.6, versión fuera del rango del aviso GHSA-3f6p-5ww8-9rcr; no se inspeccionó directamente el árbol instalado ni existe lockfile. No afirmar auditoría permanente ni ausencia de toda vulnerabilidad posible.

n8n #85: lectura guard/base autenticada HTTP 200. #86: inicio featured sintético 200; #87: repetición 409. Contención real: phpMyAdmin bloqueó destino de prueba `opmx_dual_h088_20261101` con SELECT FOR UPDATE por 35 s y COMMIT; #88 y #89, para featured, se solaparon y constaron ejecutándose antes de la liberación. Tras el COMMIT #88 respondió 200 upload_started, #89 409 already_started; consulta SQL mostró una fila featured y una hero. No subió medios reales ni accedió a WordPress. Workflow diagnóstico restaurado a lectura e inactivo. Filas sintéticas persisten en ledger dedicado.

Pendientes: lockfile y análisis continuo, conciliación de resultados inciertos, exclusión con otros publicadores, prueba integral aislada WordPress/Gutenberg/medios y redes. El rechazo automático anterior al workflow con nodos de escritura WP sigue vigente; no eludirlo. No se cambiaron DNS ni Publisher activo.

## Avance Work II — dependencia mysql2 de guard (2026-11-01)

El guard desplegado H086 declara mysql2 3.14.5. Aviso oficial GitHub GHSA-3f6p-5ww8-9rcr, alto, afecta mysql2 <3.22.0: un servidor MySQL malicioso o intermediario capaz de alterar la conexión podría solicitar una autenticación que exponga la contraseña sin TLS. El guard conecta a 127.0.0.1:3306, lo que acota el escenario; no prueba compromiso. No se ha confirmado que sea la misma alerta alta del build de Hostinger. El registro también identifica GHSA-rgwj-5xj2-c3m3 (moderado, <=3.23.0 y requiere compresión; configuración actual no la habilita). Referencias: https://github.com/advisories/GHSA-3f6p-5ww8-9rcr y https://github.com/advisories/GHSA-rgwj-5xj2-c3m3.

En rama, commit 4d7fd66 actualiza pin a mysql2 3.24.6; 63 pruebas locales existentes pasan con dobles, pero la versión nueva NO está instalada ni se ha probado con MariaDB real porque este entorno no tiene acceso al registro npm. No hay lockfile ni npm audit completo verificado. ZIP candidato reproducible opmx-guard-mysql2-h089.zip SHA256 f9bd41a5385336c0ced68df14b9dc642fb9cfc5d48ca1f6a82a012d2e5f8cab3; NO desplegado. Antes de uso: instalar mediante Hostinger con autorización, comprobar build, auditoría y repetir autenticación y concurrencia. WordPress y DNS sin cambios.

## Avance Work II — dos peticiones guard simultáneas (2026-11-01)

En identidad sintética nueva #81 reservó (201) y #82 inició destino (200). phpMyAdmin bloqueó la fila del destino con SELECT FOR UPDATE y SLEEP(35), comprobado con una fila y COMMIT. Dos ejecuciones reales de n8n hacia `/v1/media/begin` de ese mismo Hero se solaparon: #83 inició 21:35:05.819Z, #84 21:35:14.505Z; ambas constaron ejecutándose simultáneamente durante el bloqueo. Al liberarlo, #83 devolvió 200 upload_started a 21:35:27.328Z; #84 409 already_started a 21:35:27.334Z. Consulta MySQL encontró una única fila Hero uploading. Prueba limitada a dos peticiones en una instancia de guard bajo bloqueo forzado; no demuestra seguridad de otros publicadores ni recuperación tras pérdida de respuesta. No hubo cargas ni escritura WordPress. Registro sintético permanece en base dedicada. Workflow de diagnóstico restaurado a lectura e inactivo. Ver hitos H-087/H-088 Drive.

Pendientes: reconciliación de resultados inciertos, exclusión con otros flujos, auditoría de dependencia alta, prueba de borrador Gutenberg y medios en WordPress y social; no activar referencia de publicación. La revisión automática anteriormente rechazó ejecutar un workflow que contenía nodos de escritura WordPress, incluso desconectados.

## Avance Work II — guard transaccional probado con MariaDB (2026-11-01)

Con confirmación del usuario se desplegó en Hostinger `opmx-guard-transaccion-h086.zip` SHA256 3400bccf7f9a0988bd8cec62d2155c9a78b6f82b424e1282327ad6a8917e5aec; estado completado, 15:28 MX. n8n #72 comprobó autenticación y lectura HTTP 200. Reserva sintética #73 (201), inicio destino #74 (200). Dos inicios Hero #75/#76 devolvieron 200 y 409; empezaron con ~8 s de separación, por lo que son secuenciales, no prueba simultánea.

Contención real forzada #77: phpMyAdmin insertó featured de la identidad sintética sin confirmar durante SLEEP(25); #77 comenzó durante ese intervalo, esperó 18.408 s y devolvió 409 already_started tras COMMIT. Consulta posterior mostró una fila Hero y una featured, ambas uploading. En otra identidad, #78 reserva 201 y #79 destino 200; phpMyAdmin insertó Hero, esperó 25 s y ejecutó ROLLBACK, mientras #80 esperaba. Tras 16.544 s #80 obtuvo 200 upload_started; consulta posterior mostró una sola fila Hero uploading. Son pruebas de contención controlada entre una sesión SQL y guard, no dos peticiones guard efectivamente simultáneas ni prueba integral contra otros publicadores. No se subieron medios y las filas son sintéticas persistentes en ledger separado. Workflow diagnóstico fue restaurado a consulta de estado, permanece inactivo. Sin escrituras WordPress ni cambios DNS.

Pendientes: concurrencia de dos peticiones reales al guard con solapamiento observado, reconciliación ante pérdida de respuesta/commit, exclusión con otros publicadores, auditoría de vulnerabilidad npm y prueba de borrador real aislado con Gutenberg/medios/SEO. Social sigue pendiente. No declarar pipeline completo.

## Avance Work II — inicio transaccional de medios preparado (2026-11-01)

El guard en rama ahora inicia una transacción, consulta el destino elegible `FOR UPDATE`, inserta el rol con `VALUES` y sólo devuelve upload_started después del COMMIT. Esto serializa llamadas del guard para el mismo destino y podría evitar el conflicto de lectura observado; falta demostración real MariaDB y test con escritor externo simultáneo. Duplicado durante inserción devuelve already_started; fallos o COMMIT incierto devuelven 503 y no autorizan reintento. Rollback best effort y liberación; resultado incierto requiere conciliación. Los tests comprueban orden de transacción, commit incierto y dos claimants simulados. 63 pruebas locales aprobadas, sin afirmar que dobles simulen todas las condiciones de MariaDB. Commits e81db7d, e43b952, f003c37. ZIP preparado opmx-guard-transaccion-h086.zip SHA256 3400bccf7f9a0988bd8cec62d2155c9a78b6f82b424e1282327ad6a8917e5aec; no desplegado ni probado en base real. Actual en Hostinger sigue H084. Pendiente verificar concurrencia real y compatibilidad, reconciliación, auditoría npm, exclusión con otros publicadores y prueba WordPress. No publicar contenido ni activar referencias.

## Avance Work II — reproducción MariaDB 1020 en contención (2026-11-01)

Despliegue autorizado `opmx-guard-diagnostico-h084.zip` SHA256 05aca6502b080f389bacd3db932a7ec0a3705f5aa7f6caf8b1aa895f6dbc13ac completado en Hostinger 14:49 MX. n8n #67 verificó guard autenticado y lectura DB (HTTP 200). En #68, con fila featured ya confirmada y bloqueada 25 s, guard esperó 18.227 s y devolvió 409 already_started. En identidad nueva, #69 reservó (201) y #70 inició destino (200); una transacción SQL insertó featured y la mantuvo sin confirmar 25 s. #71 esperó 16.945 s y devolvió 503 not_confirmed; el log del guard mostró OTHER, sin error SQL preciso. Una reproducción adicional exclusivamente en dos sesiones phpMyAdmin insertó Hero en transacción sin confirmar y la segunda ejecutó el mismo INSERT SELECT; MariaDB devolvió #1020 Record has changed since last read. La primera confirmó una fila; no se subieron medios. El error 1020 es una causa reproducible en ese escenario, pero el código específico subyacente a #71 no fue expuesto por el log y no se afirma demostrado. Las filas sintéticas permanecen en ledger separado. El workflow diagnóstico volvió al endpoint de lectura y 10 s; sigue inactivo.

En rama, commits 59d5402, c681e84 y 6070c18 reconocen errno 1020 o ER_CHECKREAD como WRITE_CONFLICT en logs y conservan 503 not_confirmed sin reintento; 61 pruebas locales aprobadas. El reconocimiento nuevo NO se ha desplegado. Quedan reconciliación automatizada segura, exclusión con otros publicadores, auditoría npm, borrador real aislado WordPress, validación visual y redes. No activar referencias. No hubo escritura WordPress ni DNS.

## Avance Work II — diagnóstico seguro de contención (2026-11-01)

Consulta de sólo lectura en phpMyAdmin: MariaDB 11.8.9 y @@innodb_lock_wait_timeout=50 en esa sesión. La ejecución n8n #64 recibió 503 tras ~11.945 s: el valor leído en otra sesión no identifica la causa ni demuestra que el guard comparta la misma configuración. Se añadió instrumentación local al inicio de medios que sólo registra categorías de una lista fija para errores de SQL, sin mensaje SQL, credenciales ni datos de petición; el cliente conserva 503 not_confirmed. Los errores no reconocidos se reducen a OTHER; no cambia la política de no reintento. Prueba local de códigos y filtrado aprobada; 61 pruebas locales en total. Commits b03b8c1, 14f9f7c, d20699c. El cambio no está desplegado ni identifica por sí mismo la causa; sólo cubre fallos de execute dentro de beginMediaUpload, no conexión inicial. Requiere validación y posterior despliegue del paquete del guard para obtener evidencia real, luego repetir contención y reconciliar. Publisher, WordPress y DNS sin cambios.

## Avance Work II — validación de medios en n8n sin conexiones (2026-11-01)

Se creó workflow inactivo `w8Z6h5NLluCLX49S` en proyecto personal OXÍGENO PURO, con disparador manual y siete nodos Code únicamente; no tiene credenciales ni nodos HTTP. Usa los validadores de lectura Hero y destacada de la referencia guardada. Ejecución #65 verificó ambos con datos simulados; #66 con leyenda ausente falló con el mensaje esperado. Se restauró el fixture válido. SDK versionado en `workflows/publisher/OPMX_QA_MEDIOS_SIMULADO.n8n.js`. n8n presenta advertencia visual por ocho nodos no agrupados; el fixture conserva nombres para probar referencias reales. Estas pruebas NO consultaron WordPress ni verificaron archivos, concurrencia o render. Publisher activo sin cambios, no se publicó contenido.

## Avance Work II — verificación de adjuntos en referencia guardada (2026-11-01)

La referencia inactiva añade lectura WordPress `context=edit` de cada adjunto tras guardar su metadata y comprueba ID, tipo imagen, URL y alt; para Hero además título, leyenda y descripción raw. Falla cerrado ante discrepancia antes de crear el post. Sigue sin comprobar los bytes de archivo ni el render visual; la comparación estricta puede rechazar cambios legítimos de sanitización. El generador y las pruebas de grafo comprueban que ambos readbacks preceden al post; 60 pruebas locales aprobadas con dobles. El workflow contiene nodos de escritura, no se ha importado, autenticado ni ejecutado en n8n/WordPress. No activar hasta validar seguridad, reconciliación y prueba integral. Publisher activo y CMS sin cambios; no se publicó contenido.

## Avance Work II — prueba de solapamiento real (2026-11-01)

En la base dedicada, phpMyAdmin inició una transacción sintética e insertó una fila `featured` para una reserva de prueba; mantuvo el lock con SLEEP(20) y luego COMMIT. El SELECT inició 18:45:45 UTC y tardó 20.0004 s; durante ese intervalo n8n inició la ejecución #64 a las 18:45:53 UTC contra `/v1/media/begin` para la misma identidad. El nodo esperó 11.945 s y devolvió 503 `not_confirmed` a las 18:46:05, no 409. La lectura posterior mostró dos filas sintéticas totales: una Hero `reported` previa y una featured `uploading`; sólo una por rol. El 503 es fallo cerrado que exige conciliación, NO confirmación de duplicado ni permiso de reintento. Causa exacta de 503 y manejo bajo contención no comprobados; no afirmar prueba integral de concurrencia de solicitudes n8n ni seguridad global. Queda fila featured sintética permanente, sin archivo WordPress.

El workflow diagnóstico inactivo fue restaurado a /v1/reservations/status y timeout 10 s. No se ejecutó escritura WordPress ni se publicó. Pendiente investigar 503, reconciliación y readback; verificar carreras entre workflows y otros publicadores.

## Avance Work II — validación de readback en n8n sin conexiones (2026-11-01)

Workflow inactivo `WanHEnbEXVulmaTL`, proyecto personal OXÍGENO PURO, contiene exclusivamente disparador manual y siete nodos Code con datos ficticios, sin credenciales, HTTP, WordPress ni efectos editoriales. Usa literalmente el código de validación del Publisher. Ejecución #62 pasó con título, subtítulo, crédito, Gutenberg, Hero, destacada, autor, taxonomía y SEO sintéticos. Ejecución #63 con crédito omitido falló como se esperaba con crédito de Hero no coincide; se restauró el fixture válido. La referencia SDK reproducible `workflows/publisher/OPMX_QA_READBACK_SIMULADO.n8n.js` quedó en GitHub. n8n señala advertencia visual por ocho nodos sin agrupar; es un fixture intencional con nombres originales para resolver referencias por nodo, no afecta la prueba.

Prueba limitada al validador en runtime n8n con respuestas simuladas: no demuestra serialización real, flujo guardado completo, WordPress, medios o publicación; falta revisar que WP entregue realmente esos campos y preservar separación Hero/destacada. Publisher activo y CMS sin cambios; no publicar nota de prueba.

## Avance Work II — subtítulo y crédito de Hero (2026-11-01)

Contrastando un MASTER existente con Core OPURO, la referencia inactiva de creación de borrador ahora mapea `SEO.SUBTITULO` a `meta.oxpuro_editorial.subtitle` y `IMAGENES.HERO_OPURO.CREDITO` a `meta.oxpuro_editorial.photo_credit`; la leyenda sigue en `caption` del adjunto Hero. El readback exige ambos valores, y el validador rechaza tipos de crédito no textuales y textos demasiado largos. El generador de referencia guardada toma el validador actualizado y ambas referencias quedan regeneradas. 59 pruebas locales aprobadas, con dobles. No se ha validado el comportamiento real de sanitización WordPress ni la visualización de caption/crédito; comparación exacta puede rechazar cambios legítimos. No afecta contenido existente, no activado, ni se publicó nada.

## Hallazgo Work II — subtítulo y crédito en ejecución histórica (2026-11-01)

La ejecución histórica #9 del Publisher activo contenía subtítulo y crédito Hero en canonical, pero el readback de borrador 9671 registró `meta.oxpuro_editorial.subtitle` y `photo_credit` vacíos. Código del Core define ambos campos en `oxpuro_editorial`; el payload actual del Publisher no los asigna. Evidencia limitada a esa ejecución y momento; no se ha auditado su estado actual ni otras notas. No se ha decidido ni verificado el mapeo exacto de crédito o la preservación de opciones editoriales al escribir el objeto; resolver con el contrato y prueba aislada, sin inventar valores ni sobrescribir el objeto completo de notas existentes.

## Avance Work II — referencia OPURO de borrador con guard (2026-11-01)

Se generó `workflows/publisher/OPMX_BORRADOR_GUARDADO_OPURO_REFERENCIA_NO_ACTIVAR.json`, inactivo, saneado sin credenciales y sin nodos de publicación. Conecta preflight OPURO (consulta de slug, huella, reserva) → inicio durable de destino → inicio/reporte de Hero → inicio/reporte de destacada → creación y reporte de post → Rank Math → readback → validación de borrador. Fallos de guard cortan el camino. Las pruebas inspeccionan alcanzabilidad, ausencia de rutas de publicación, sintaxis de nodos Code y consistencia reproducible; 59 pruebas locales pasan. El generador `build-guarded-reference.mjs --check` no altera archivos.

ESTA REFERENCIA CONTIENE NODOS DE ESCRITURA WORDPRESS. No importar, activar ni ejecutar contra CMS real hasta revisar autenticación, conciliación, concurrencia, permiso y resultados parciales. No se ha importado ni probado ejecución n8n ni readback real. Estado DRAFT no prueba que los adjuntos reportados existan o tengan metadata correcta: requiere validación independiente de archivos y frontend. El guard no protege publicadores externos ni todas las carreras. El Publisher activo y WordPress no cambiaron; ningún artículo fue publicado.

## Avance Work II — readback editorial conservador (2026-11-01)

Referencia sanitizada inactiva del Publisher amplía validación de draft: slug, autor, título raw, etiquetas, Gutenberg raw exacto y tres campos Rank Math, además de featured, Hero y categoría. Detiene el flujo ante diferencias y no declara borrador válido; prueba local Node 55/55 incluyendo mutaciones de campos. El cotejo exacto puede producir falsos negativos por transformaciones legítimas WordPress: no se ha probado contra WP/n8n y requiere contraste antes de activar. La referencia conserva nodos de escritura desconectados en el entorno de pruebas y NO se ha integrado al guard ni al Publisher activo. No se publicaron notas ni se cambió CMS. Pendiente integración, prueba nativa, concurrencia y conciliación; no considerar QA terminado.

## Avance Work II — rotación y conexión restablecida (2026-11-01)

El usuario rotó contraseña MySQL y secreto del guard, actualizó las variables y la credencial Header Auth de n8n, y aplicó cambios en Hostinger. Diagnóstico n8n #60 tras contraseña y #61 tras secreto devolvieron HTTP 200 al consultar reserva sintética; identity unverified por ausencia de huella en la consulta. Acredita autenticación guard y lectura de base, no concurrencia ni integridad de identidad completa. No registrar los secretos. La incidencia de exposición de H-073 queda atendida según lo informado y comprobado por conectividad; no afecta la vulnerabilidad npm pendiente ni autoriza uso operativo sin QA.

## Avance Work II — rutas de medios reales, datos sintéticos (2026-11-01)

El guard de prueba desplegado respondió por n8n y base dedicada: ejecución #55 inició escritura de destino (200 write_started); #56 inició Hero (200 upload_started); #57 rechazó repetición (409 already_started); #58 registró ID ficticio 456 (200 media_reported, verify_wordpress); #59 consultó ese ID (200 reported, manual_reconciliation). No se solicitó carga ni se accedió a WordPress: el ID 456 es ficticio y no acredita que exista un adjunto. Permanecen filas sintéticas de destino y medio en la base; no son datos editoriales. Las pruebas se ejecutaron secuencialmente; no prueban concurrencia real. El diagnóstico inactivo se restauró y verificó apuntando a /v1/reservations/status en modo lectura. Publisher activo no modificado.

SIGUE BLOQUEADO uso operativo: se deben rotar de nuevo contraseña de base y secreto guard expuestos por la pantalla Hostinger de ajustes; pruebas de concurrencia real, conciliación completa y readback WordPress, integración n8n y prueba de borrador real pendiente. No publicar contenido de prueba.

## Avance Work II — despliegue de prueba del guard de medios (2026-11-01)

Con autorización, Hostinger desplegó opmx-guard-media-test.zip, SHA-256 716cccd0adfd5db1b09fe609ef8ef9496fc89726eb9fa78c043221b623bbc3a4; estado completado y actual 12:25 MX. La versión previa opmx-guard-progress-test.zip permanece en historial. Las rutas nuevas no se han probado aún; Publisher activo y WordPress no se modificaron. La tabla dedicada de medios existe y estaba vacía.

ALERTA: la pantalla Hostinger de reimplementación devolvió automáticamente las variables de contraseña de base y secreto del guard en texto visible en la observación de la sesión. Considerar ambas credenciales expuestas y rotarlas nuevamente con participación del usuario antes de usar el servicio operativamente; actualizar sus valores dependientes, sin imprimirlos. Pendiente validar rutas con datos sintéticos, concurrencia, reconciliación y readback, e investigar el aviso previo de vulnerabilidad alta en npm.

## Avance Work II — paquete de prueba reproducible (2026-11-01)

`tools/mcp-publisher/package-guard.py` construye el paquete sin secretos a partir de archivos versionados. El paquete `opmx-guard-media-test.zip` contiene guard-start, guard-server, direct-claim, target-progress, media-progress, package.json y server.js; SHA-256 716cccd0adfd5db1b09fe609ef8ef9496fc89726eb9fa78c043221b623bbc3a4. Dos construcciones locales produjeron la misma huella, ZIP validado. Es paquete temporal regenerable; no está cargado ni desplegado. La tabla dedicada media existe y está vacía.

Hostinger registra en la compilación anterior (12:10) `npm install` y 1 vulnerabilidad de severidad alta, sin detalle mostrado en ese registro. No se ha identificado su dependencia ni evaluado su alcance; no ejecutar npm audit fix --force ni declarar seguridad validada. El paquete conserva mysql2 3.14.5, sin lockfile verificado. Antes de usar esta revisión operativamente deben verificarse dependencias y probar su funcionamiento, rollback, concurrencia y reconciliación; no conectar Publisher activo a escritura.

## Avance Work II — prueba SQL de medios (2026-11-01)

Se creó opmx_mcp_media_progress en la base dedicada del guard (no WordPress). En una transacción de phpMyAdmin con una reserva sintética existente se insertó inicio de destino y luego una Hero; un segundo INSERT IGNORE de la misma clave insertó cero filas y avisó duplicado 1062; SELECT arrojó una fila Hero y ROLLBACK revirtió los cambios. Una lectura posterior confirmó cero filas en la tabla media. Esto verifica el SQL y clave única en una transacción, NO solicitudes concurrentes, código Node nuevo, readback WordPress ni el despliegue de las rutas. La tabla queda creada y vacía. El servicio guard activo sigue en su versión anterior, sin rutas media; el Publisher activo no cambió.

Pendiente empaquetar de forma reproducible y probar la versión nueva en entorno aislado y con concurrencia real, integrar n8n sin exposición de credenciales, reconciliar y comprobar los medios en WordPress antes de permitir una prueba de borrador.

## Avance Work II — seguimiento experimental de medios (2026-11-01)

En esta rama se agregó `media-progress.mjs` con migración dedicada InnoDB y endpoints experimentales del guard `/v1/media/begin`, `/v1/media/report`, `/v1/media/status`. La identidad incluye destino y rol: Hero y destacada tienen registro independiente. Se exige inicio durable del destino; duplicados o estado incierto requieren conciliación manual y el ID informado exige readback WordPress. 54 pruebas Node locales pasan con base simulada; no prueban SQL real ni concurrencia distribuida. NO está desplegado, la tabla NO se creó, no está integrado en n8n y no debe usarse en producción. La migración corresponde sólo a la base dedicada del guard, nunca WordPress.

Pendiente: probar SQL/HTTP con MariaDB aislado y solicitudes simultáneas reales; diseñar comprobación de imágenes por ID y protección ante fallas entre subida y reporte; integrar y verificar el recorrido antes de conectar escrituras WordPress. No libera reservas y no protege otros flujos. Publisher activo y CMS sin cambios.

## Avance Work II — repetición de reserva en guard real (2026-11-01)

Diagnóstico temporal n8n contra el guard y base dedicada: ejecuciones #53 y #54 con mismo identificador, huella y dos destinos retornaron 201 claimed y 409 conflict_or_replay. Se iniciaron en paralelo desde Work, pero sus nodos HTTP llegaron separados aproximadamente 6.4 segundos; verifica rechazo de repetición real, NO concurrencia simultánea. Permanece una reserva sintética y sus destinos asociados. Después se restauró el workflow de diagnóstico inactivo a la consulta de estado preexistente; Publisher activo y WordPress no se modificaron. Pendiente prueba real con solapamiento temporal, conciliación y flujo completo de borrador.

## Avance Work II — conexión y Hero independiente (2026-11-01)

Tras rotación y aplicación por el usuario, diagnóstico n8n #52 devolvió HTTP 200 al consultar una reserva sintética: autenticación del guard y lectura de base verificadas; identidad sin verificar por consulta sin huella. No acredita concurrencia real ni borradores WordPress. El Publisher activo sigue sin cambios.

La ejecución histórica #9 del Publisher activo subió Hero 9669 y destacada 9670, pero el readback del borrador 9671 devolvió oxpuro_hero_media_id=0. En la referencia sanitizada inactiva se agregó asignación del ID Hero a oxpuro_hero_media_id y comprobación en readback antes de devolver borrador o publicar. Las 48 pruebas locales Node pasan, incluidas cuatro pruebas del payload, readback e inactividad; sin conexiones WordPress y sin validación n8n real. El archivo no es importación validada ni debe activarse: mantiene nodos de escritura y la protección durable completa no está integrada. No extrapolar el error a todas las notas.

Pendiente: confirmar reservas concurrentes reales, registro completo y reconciliación de medios/post, readback de WordPress, integración al flujo desde el Motor, QA de Hero en borrador aislado, y documentación en Drive. No publicar notas de prueba ni modificar el Publisher activo hasta completar pruebas y control de duplicados.

# OPMX Pipeline — Handoff maestro

## Avance — revisión tras cambio de contraseña (2026-11-01)

El usuario indicó haber cambiado la contraseña de la base dedicada y actualizado el entorno. Ejecución de diagnóstico 47 devolvió HTTP 200 y lectura de la reserva sintética. Esa lectura no prueba por sí sola que el proceso haya reiniciado o que una conexión nueva use la contraseña nueva: el historial de Hostinger aún muestra como último despliegue el paquete de las 11:35. Verificar conexión con proceso reiniciado tras los cambios, sin revelar secretos. Pendiente rotar `OPMX_GUARD_SECRET` en Hostinger y valor Authorization de la credencial Header Auth en n8n, coordinados por el usuario; aplicar/reiniciar el servicio y validar. Publisher editorial no modificado.

## Avance — huella de imágenes en preflight aislado (2026-11-01)

En el workflow inactivo `8ufo4fYPAc7ObNVC` la huella ahora incluye el canonical y ambas cadenas base64 de imágenes enviadas. Ejecución manual 45 completó preflight OPURO con copia transitoria y archivos reales; ejecución 46 conservó solicitud y contenido pero sustituyó HERO por la destacada: produjo otra huella y la reserva rechazó el reenvío con 409. No hubo escritura WordPress y el paquete original sigue REQUIERE_REVISION. Las cadenas base64 de la solicitud se incluyen en su codificación exacta, no es una normalización universal por bytes. La referencia sanitizada actualizada se encuentra en `workflows/publisher/OPMX_PREFLIGHT_AISLADO_ID_ESTABLE_REFERENCIA_NO_ACTIVAR.json`; su importación sigue sin probar. Hay nuevas reservas sintéticas permanentes.

Sigue pendiente incluir esta verificación en el Publisher real, pruebas concurrentes reales, seguimiento de todos los medios, conciliación y readback WordPress. Antes de producción, usuario debe rotar contraseña de base dedicada y secreto guard expuestos en visualización de ajustes, y actualizar ambos lugares correspondientes. La versión activa del Publisher no cambió.

## Avance — guard desplegado y prueba n8n (2026-11-01)

El usuario autorizó el paquete de prueba. Hostinger muestra `opmx-guard-progress-test.zip` como despliegue actual completado, con versión previa disponible en historial. Desde el workflow diagnóstico inactivo `EarnvktAyNGlKzq1`, que no contiene nodos WordPress, llamadas autenticadas con reserva sintética existente: ejecución 40 devolvió 200 write_started; ejecución 41 devolvió 409 already_started; ejecución 42 registró ID sintético 123 y respondió post_reported; ejecución 43 consultó reported/123; ejecución 44 consultó reserva sin huella y recibió claimed con identidad unverified. Ninguna de estas llamadas verifica WordPress ni crea un post. La tabla contiene una fila de avance sintética persistente y la reserva sintética correspondiente. Las ejecuciones 40/41 llegaron separadas por varios segundos, por lo que no demuestran simultaneidad real, sólo rechazo de repetición. Falta prueba real de carrera, seguimiento y reconciliación de medios y post, incorporación al Publisher, readback WordPress y prueba desde el Project del Motor. Publisher activo sin cambios.

La pantalla de ajustes de Hostinger mostró la contraseña de la base y el secreto del guard en texto visible durante la inspección; considerarlos expuestos en los registros de la sesión y coordinar su rotación antes del uso productivo, actualizando los puntos dependientes sin registrar valores. El workflow diagnóstico sigue inactivo pero disponible mediante MCP y conserva una credencial restringida; su acción actual es consulta de reserva de prueba.

## Avance — tabla real y pruebas SQL aisladas (2026-11-01)

En la base dedicada del guard se creó `opmx_mcp_target_progress` con la migración de `target-progress.mjs`; no se modificó la base WordPress. Con la reserva sintética creada por la ejecución 39 se verificó en phpMyAdmin que INSERT SELECT inserta sólo la reserva correspondiente. En una transacción separada un segundo INSERT IGNORE sobre la misma clave insertó cero filas y produjo aviso 1062; UPDATE cambió una fila a reported con ID de prueba 123. ROLLBACK dejó cero filas en la tabla de avance. No se ejecutaron consultas simultáneas reales ni el código Node revisado contra MariaDB.

Se preparó un paquete de prueba local `opmx-guard-progress-test.zip` con los seis archivos fuente y sin credenciales; SHA-256 `cdbe2b0bc64b00ee63042e934427690444aff077867e84c25fa1d7b827ad63e0`. NO se ha subido ni desplegado. Para validarlo en Hostinger se requiere autorización específica de carga por la política de interfaz gráfica; después probar autenticación, timeout, concurrencia y readback vía n8n antes de conectar cualquier escritura WordPress. No se cambió el Publisher activo ni se crearon notas. La referencia de despliegue anterior sigue operativa. No utilizar esta tabla como garantía para los demás publicadores.

## Avance — registro de escritura por destino (2026-11-01)

En la rama del PR se preparó `target-progress.mjs` y la migración de tabla separada `opmx_mcp_target_progress`, junto a rutas autenticadas experimentales en el guard: inicio de escritura, registro de ID informado y consulta. El inicio sólo procede para destino previamente reservado y un inicio repetido se detiene. El registro del ID NO acredita que el post exista ni su estado; requiere lectura independiente de WordPress. Ninguna operación libera automáticamente reservas ni habilita reenvíos tras un resultado incierto. 44 pruebas locales Node pasan, con base simulada: no acreditan transacciones, concurrencia ni comportamiento de MariaDB real.

No se ha creado la tabla, desplegado esta revisión, integrado Publisher ni creado borradores. La sesión phpMyAdmin mostraba inicio de sesión; el acceso desde la pantalla Hostinger no abrió una sesión verificable en esta revisión. Antes de usarse: validar la migración en la base dedicada, concurrencia real, conexión n8n, firma de los binarios, seguimiento de medios y readback exacto del post; la protección no cubre los otros publicadores ni operaciones manuales. No activar las rutas como solución completa.

## Avance — identificador estable en preflight aislado (2026-11-01)

La copia inactiva sin nodos de escritura exige ahora `request_id` suministrado por el cliente antes de recibir el MASTER. Ejecución manual 38 rechazó su ausencia antes de consultar WordPress o reservar. Ejecución 39 completó el recorrido de preflight con MASTER y dos imágenes y devolvió ese identificador y la huella; se utilizó una copia transitoria y slug sintético, sin aprobar editorialmente ni publicar la nota. El cliente debe guardar el ID antes del envío. La referencia sanitizada está en `workflows/publisher/OPMX_PREFLIGHT_AISLADO_ID_ESTABLE_REFERENCIA_NO_ACTIVAR.json`: credenciales y webhookId retirados, no se ha probado su importación.

Se amplió el prototipo local de consulta de reserva para permitir búsqueda sólo por ID si se perdió la respuesta. En ese caso indica identidad no verificada y requiere reconciliación manual; con huella puede verificar coincidencia. La respuesta nunca autoriza reintentar ni libera una reserva. 39 pruebas locales pasan. Esta mejora sigue sin desplegar ni probar contra la base real. La huella del preflight actual no incorpora los bytes de las imágenes; no usarla como identidad completa del paquete. Falta registro durable de avances por destino, conciliación de resultados inciertos, integración Publisher y prueba de borrador. El workflow de prueba está inactivo pero disponible por MCP; Publisher activo intacto.

## Avance de recuperación de reservas — 2026-11-01

Preparada en la rama del PR una consulta autenticada de estado por identificador y huella en `POST /v1/reservations/status`. Sólo lee la base; devuelve reconciliación manual tanto si encuentra la reserva como si falta o la identidad no coincide. Nunca libera reservas, reintenta escrituras ni demuestra por sí sola que sea seguro volver a publicar. Se verificaron 39 pruebas locales Node, incluidas autenticación, consulta sin escritura y validación; no hay prueba con MariaDB o n8n reales de esta revisión. Los cambios no están desplegados.

Antes de una prueba de borrador, quedan por integrar el identificador estable en el cliente del Motor y el Publisher real, registro durable de avance y resultados por destino, reconciliación de WordPress y ejecución n8n terminada, y protección contra carreras y otros flujos. No usar `not_found` como autorización para reenviar. El Publisher activo no se cambió. La prueba aislada anterior sigue limitada a preflight OPURO y no prueba creación de borradores.

## Estado más reciente — preflight aislado OPURO (2026-11-01)

La ejecución manual 36 del workflow inactivo aislado `8ufo4fYPAc7ObNVC`, que contiene nueve nodos y ningún nodo de escritura WordPress, completó la validación de un MASTER y dos JPEG completos, GET preventivo del slug, y reserva autenticada en guard y MySQL local. Para la prueba se usó una copia transitoria con slug sintético y ESTADO=LISTO; el MASTER original permanece REQUIERE_REVISION y no se publicó ni se editó ninguna entrada. La ejecución 37 repitió el slug con otro identificador y fue rechazada por el guard con HTTP 409 conflict_or_replay. Son pruebas desde Work: no acreditan transferencia de adjuntos desde el chat del Motor ni publicación de borradores.

El workflow aislado está inactivo y disponible por MCP para pruebas; incluye credenciales restringidas para consulta WordPress y reserva, por lo que debe tratarse como capacidad sensible. Las reservas de prueba permanecen en la base. El Publisher activo no se modificó. La revisión automática rechazó ejecutar la copia anterior que contenía nodos de escritura incluso desconectados; se utilizó una alternativa materialmente más segura sin esos nodos.

Pendientes antes de usarlo para publicar: diseñar y probar reconciliación y recuperación segura de reservas ante fallos o respuestas inciertas, integración al Publisher real, OPOL, detección de duplicados y carreras fuera del guard, y prueba desde el Project del Motor. Una reserva no debe liberarse ni reintentarse automáticamente ante incertidumbre. El guard no protege otros flujos de publicación que no pasen por él. No activar ni fusionar el PR como solución completa hasta validar el recorrido.

Los párrafos siguientes son **registro histórico** y describen estados vigentes en su momento; cuando se contradicen, prevalece este estado más reciente.

## Hito en preparación — integración ChatGPT → Publisher MCP (2026-11-01)

### Ruta simplificada: conexión existente ChatGPT → n8n — 2026-11-01

El usuario autorizó una prueba autenticada en workflow diagnóstico: ejecución 31 recibió 201 claimed por HTTPS, verificando conexión real n8n → guard → MySQL. Solicitudes simultáneas 32/33 con mismo identificador y 34/35 con identificadores distintos para el mismo slug arrojaron 201 y 409 en cada par. No se llamó WordPress ni se crearon notas; quedaron reservas sintéticas permanentes en la base, sin rutina automática de borrado. Se incorporó el guard en la copia de preflight inactiva; un análisis de grafo desde el trigger reportó sólo 9 nodos alcanzables, con GET WordPress y POST de reserva, sin ramas de creación de WordPress. La revisión automática rechazó dos intentos de ejecutar el flujo de preflight con imágenes, por conservar nodos de escritura en el grafo completo y riesgo de crear borradores. No se sorteó el bloqueo y el preflight conectado al guard NO se probó. La referencia sanitizada en workflows/publisher/OPMX_PREFLIGHT_DIRECTO_OPURO_REFERENCIA_NO_ACTIVAR.json incluye únicamente el subgrafo alcanzable y no contiene credenciales; no se ha importado ni ejecutado. El Publisher activo no fue modificado. Siguen pendientes prueba integral aprobada, análisis OPOL, recuperación de reservas, WordPress duplicados/race fuera del guard y aprobación de uso del flujo en producción.


Hostinger implementó `opmx-guard-test.zip` en publisher.oxigenopuro.com.mx y reportó despliegue completado; la raíz muestra respuesta unauthorized sin credenciales. Hay variables de base local y secreto configurados en Hostinger, y una credencial Header Auth guardada en n8n restringida al dominio Publisher. La revisión automática rechazó adjuntar esa credencial al workflow diagnóstico que aparece disponible por MCP, por el riesgo de exposición persistente; no se intentó sortear el rechazo. No se ejecutaron solicitudes autenticadas, no se probó el acceso a MySQL desde Node ni concurrencia del guard y no se modificó el Publisher activo. El guard está desplegado en el subdominio de prueba, pero no está conectado al flujo editorial y no debe considerarse listo. Se requiere aprobación y revisión del acceso MCP y un diseño que limite la ejecución del diagnóstico; no poner secretos en GitHub.


En phpMyAdmin de la base dedicada se probó transacción real con dos reservas y rollback: conteo 2 antes y 0 después. Otra transacción comprobó el índice único: segunda inserción con misma clave afectó 0 filas y produjo advertencia duplicada, rollback dejó 0 filas. No es prueba de concurrencia ni del servicio Node. El guard ahora limita solicitudes por proceso y las pruebas específicas suman 6; todas las pruebas previas pasaron antes del último ajuste. Paquete de prueba preparado y documentado en tools/mcp-publisher/GUARD_DEPLOYMENT.md; no se ha desplegado ni configurado secretos. Se requiere validar runtime Hostinger, conexión MySQL local, HTTPS y pruebas de simultaneidad antes de integrar con WordPress. Hostinger documenta 127.0.0.1 como host local para app Node de la misma cuenta.


Preparación servicio de reservas: `guard-server.mjs`, `guard-start.mjs`, `guard-package.json`, `guard-server.test.mjs` y `direct-claim.mjs` definen prototipo Node HTTP autenticado para colocarlo detrás de HTTPS de Hostinger. La autenticación requiere bearer hex de 64+ caracteres, límite de entrada, sólo POST de reserva y transacción que reserva solicitud y destinos de forma conjunta. Ante conflicto o respuesta desconocida no debe ejecutarse WordPress automáticamente. 35 pruebas locales pasan; HTTP usa pool simulado y NO prueba TLS, MySQL real ni n8n. Falta proteger límite de solicitudes, validar el host de MySQL local desde el runtime Node de Hostinger, instalar dependencias en despliegue, configurar secretos fuera del repositorio, probar HTTPS, autenticación y concurrencia real, integrar n8n y diseñar reconciliación de reservas. No se ha desplegado ni configurado el servicio. `guard-package.json` es sólo plantilla, requiere empaquetado con nombre package.json; falta lockfile. Hostinger todavía conserva la única regla remota previamente autorizada y n8n una credencial MySQL fallida; no asumir que son necesarias para la nueva arquitectura.


Tras autorizar el usuario, se permitió la IP observada por MySQL y se retiró la IP previa. Al reintentar, MySQL reportó otra IP de origen y negó acceso, por lo que el egreso de n8n no es estable entre esas dos pruebas. Permanece una sola regla remota activa; no se habilitaron comodines. Credencial n8n tiene SSL habilitado pero la conexión no autenticó, de modo que cifrado y verificación no están probados. No se ha realizado SQL desde n8n. Se propone explorar un servicio interno autenticado en Hostinger con acceso local a la base y HTTPS desde n8n, pero aún no existe ni se ha desplegado. Prototipo experimental direct-claim.mjs reserva solicitud y destinos en una sola transacción; 33 pruebas locales pasan, tres nuevas usan un pool simulado y no validan concurrencia en MySQL real. Aún faltan API, autenticación, integración de workflow, verificación del TLS, pruebas reales de concurrencia y recuperación. No reconectar ramas WordPress.


Acceso MySQL: con autorización, Hostinger recibió una regla limitada para la IP observada por HTTP desde n8n, y se guardó una credencial MySQL en n8n con SSL activado. La prueba devolvió acceso denegado e identificó una IP origen MySQL diferente a la IP HTTP; la regla anterior permanece habilitada y NO autoriza esa segunda IP. Esto demuestra que la IP de egreso puede depender del destino o el protocolo, no que sea fija. Conectividad autenticada, validación efectiva del cifrado y ejecución SQL desde n8n siguen sin comprobarse. No habilitar comodines ni relajar TLS. No se cambió el Publisher activo ni se publicaron notas.


Base independiente del Publisher creada en Hostinger por autorización del usuario; incluye las tablas InnoDB `opmx_mcp_requests` y `opmx_mcp_targets` del prototipo, con claves primarias e índice. No se modificó la base WordPress. phpMyAdmin confirmó la creación. No existen aún datos de reservas y el workflow directo no usa estas tablas. Hostinger exige habilitar acceso remoto por IP; una consulta HTTP desde n8n observó una IP de salida, pero no se ha demostrado que sea la IP para conexiones MySQL ni que sea fija. No se ha habilitado acceso remoto ni guardado credencial MySQL en n8n. Verificar TLS, egress TCP, atomicidad con dos destinos y recuperación antes de usar la conexión. Las credenciales no se guardan en el repositorio.


Preflight duplicados OPURO: la copia inactiva consulta REST autenticado de WordPress con status=any y slug exacto, sin escrituras. Ejecución 28 detectó una nota ya existente; ejecución 29, con slug artificial en una copia de prueba, no encontró coincidencia. La consulta es sólo preventiva: no ofrece exclusión atómica ni protege de solicitudes concurrentes, fallos parciales, variantes de slug, ediciones externas ni OPOL. La rama WordPress permanece desconectada. Referencia sanitizada para revisión: workflows/publisher/OPMX_PREFLIGHT_DIRECTO_OPURO_REFERENCIA_NO_ACTIVAR.json (sin credenciales, no importar para activar). Las credenciales n8n reales no se exportaron.

Pendiente crítico para conexión directa: almacén transaccional dedicado accesible desde n8n, con claves únicas por destino+slug, transición durable antes de escritura, reconciliación ante incertidumbre y tratamiento de resultados parciales. Un almacén exclusivo de Node no protege llamadas que entran directamente en n8n. Hostinger muestra la opción de crear una base MySQL y un usuario; aún no se han creado, configurado ni probado conectividad o permisos de red. No usar la base WordPress existente. No reconectar escrituras hasta implementar y validar esta protección.


Prueba nativa con datos reales: se desconectaron deliberadamente las dos ramas WordPress después de la validación en el workflow inactivo 8xQrN9gAfGSzvtpj, y se agregó una salida de preflight. Ejecución 26 envió el MASTER real de Binance y dos JPEG completos (371031 y 145597 bytes): n8n recibió y preparó ambos binarios; el validador rechazó correctamente CONTROL_EDITORIAL=REQUIERE_REVISION. Ejecución 27 usó una copia transitoria con ESTADO=LISTO exclusivamente para validar el transporte y el contrato: ambos nodos y el preflight finalizaron correctamente. El MASTER original no se modificó, no se declaró aprobado editorialmente, no se accedió a WordPress ni se crearon notas. Las ramas WordPress permanecen desconectadas como medida de prueba. La ejecución directa por n8n no usa el ledger del prototipo Node: falta idempotencia duradera y detección de duplicados en CMS antes de reconectar. Esta prueba desde Work no verifica la transferencia de archivos desde el otro chat del Motor ni un flujo real de publicación.


La conexión OAuth del plugin n8n ya disponible se puede utilizar directamente; no requiere proveedor adicional ni servidor Node para la prueba técnica. Ejecución manual 25 en el workflow aislado 8xQrN9gAfGSzvtpj: se envió JSON mínimo con dos cadenas base64 sintéticas que contienen únicamente la firma PNG. El nodo Preparar MASTER y binarios procesó ambos campos binarios y el nodo de validación rechazó el MASTER vacío por CONTROL_EDITORIAL ausente. No alcanzó WordPress ni creó notas. Esto prueba el transporte de JSON y cadenas base64 en esa llamada, no la lectura automática de adjuntos del Motor ni la carga de imágenes reales completas. Confirmar tamaño máximo, disponibilidad de archivos en el entorno del Motor, compatibilidad de herramienta en ese chat, protección de duplicados y ejecución completa antes de habilitar la publicación. El workflow permanece inactivo; el Publisher v1.3.5 no se modificó. No almacenar binarios ni secretos en las instrucciones o repositorio.

### Diagnóstico OAuth — 2026-11-01

Se verificó con ejecución manual 24 que el JWKS anunciado responde con claves públicas; no se ha verificado que firme los tokens MCP ni que admita al Publisher como audiencia. La documentación de n8n limita el recurso OAuth a las URLs configuradas de su servidor MCP; N8N_MCP_BASE_URL está diseñado para una URL alternativa del mismo servidor y no se ha cambiado. No reutilizar tokens emitidos para n8n como autorización del Publisher. La introspección simulada ahora también rechaza tokens cuyo nbf todavía no se cumple. Las 30 pruebas locales pasan. Pendiente: proveedor compatible con el recurso Publisher, SDK MCP, credenciales separadas hacia n8n y prueba real sin notas. No hay OAuth instalado ni configuración de producción cambiada.

La metadata pública OAuth de la instancia n8n se consultó mediante un workflow diagnóstico inactivo, ejecución manual 23: anuncia PKCE S256, registro dinámico y JWKS, pero no anuncia introspección. El validador preliminar del prototipo usa introspección, por lo que su compatibilidad con este proveedor no está demostrada. El prototipo ahora incorpora metadata de recurso protegido y challenge 401 con prueba local; no se ha conectado un proveedor de autorización ni un cliente real de ChatGPT. La conexión existente ChatGPT → n8n no equivale a autorización ChatGPT → Publisher.


**Estado: prototipo en rama de PR, no integrado en main ni habilitado para producción.** El [PR #9](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/pull/9) contiene el código y pruebas bajo `tools/mcp-publisher/`; no sustituye los flujos vigentes mientras permanezca en borrador.

- Hostinger: `publisher.oxigenopuro.com.mx` está en Cloud Startup con Node 24; despliega exclusivamente una aplicación temporal de mantenimiento que responde 503. No ejecuta el servidor MCP del PR. Hostinger creó registros DNS del subdominio. No se ha conectado base de datos ni proveedor OAuth.
- n8n: existe una copia separada e **inactiva**, `OPMX — Publisher MCP · borrador de integración`. El Publisher v1.3.5 activo no fue modificado. Una prueba real MCP con datos incompletos produjo ejecución 22 y fue rechazada antes de WordPress; las demás pruebas del workflow usaron respuestas simuladas. El webhook de la copia está configurado para n8n OAuth2, cuya interoperabilidad aún no está verificada.
- Referencia del workflow: `workflows/publisher/OPMX_PUBLISHER_MCP_REFERENCIA_SANITIZADA_NO_ACTIVAR.json`. Se retiraron identificadores de credenciales y de webhooks y se desactivó MCP. Es una referencia saneada, **no se ha probado su importación** y no debe activarse; requiere revisión y asignación de credenciales si se utiliza para preparar una copia.
- Prototipo: crea sólo borradores, permite iniciar y consultar ejecución y evita reenvíos tras un resultado incierto. Reserva destino/slug para bloquear solicitudes solapadas ingresadas por este prototipo. No verifica duplicados creados previamente en WordPress u otros flujos; tampoco existe aún procedimiento de actualización o liberación segura de reservas.
- Validación: 30 pruebas locales Node aprobadas; MariaDB, OAuth, conexión del cliente MCP nuevo y WordPress están simulados. La prueba n8n real descrita arriba no publicó ni creó notas.
- Pendientes obligatorios: SDK y protocolo MCP, OAuth real y permisos mínimos, prevención SSRF/egress, MariaDB dedicada y pruebas de transacciones reales, reconciliación de fallos/duplicados y prueba integral con imágenes y borradores reales. No desplegar el prototipo ni activar la copia antes de validar. No se cambian instrucciones o maestros editoriales.


Actualizado: 2026-10-25

## Propósito
Punto de entrada técnico para cualquier instancia de ChatGPT Work que opere el flujo OPMX desde la salida editorial hasta distribución social.

## Fuente de verdad
- GitHub `main` es la fuente de verdad técnica y versionada.
- Los chats sirven para dirección, decisiones y aprobación.
- Work implementa, prueba y documenta.
- Si una conversación contradice código o documentación vigente en `main`, prevalece `main`.
- Nunca guardar secretos, tokens, contraseñas ni credenciales en el repositorio.

## Cadena
Motor Editorial OPMX → Publisher n8n → WordPress OPURO/OPOL → Social Distribution Engine n8n → plataformas.

## Estado al 2026-10-23
### Motor Editorial
Contratos vigentes ya versionados en `contracts/`, incluyendo Protocolo v4.2 y Salida Editorial v2.2.

### Publisher
Versión operativa vigente y validada: `OPMX Publisher MEDIA v1.2.12`, versionada en `workflows/publisher/`. El usuario confirmó una ejecución real exitosa el 2026-10-23, incluyendo una categoría OPURO que no pertenecía a la antigua whitelist embebida. v1.2.12 elimina exclusivamente la whitelist embebida de categorías OPURO: la categoría sigue siendo obligatoria y `OPURO — Buscar categoría` + `OPURO — Resolver categoría` consultan WordPress y exigen coincidencia exacta normalizada para obtener el ID; no se crean categorías automáticamente. OPOL conserva su catálogo embebido y validación jerárquica. v1.2.11 permanece como rollback probado y v1.2.10 como baseline histórico.

Regla: no modificar Publisher para resolver necesidades de Social salvo incompatibilidad contractual comprobada y aprobada.

### Social Distribution Engine
Estado vigente: **v1.0.1 OFFLINE_PREFLIGHT_TESTED**. No se ha importado/ejecutado
en n8n nativo ni publicado en plataformas. No confundir las pruebas Node con esas pruebas.

Terminado el 2026-10-25:
- Contrato técnico `contracts/SOCIAL_DISTRIBUTION_CONTRACT_v1.0.1.json`; entrada
  wire mantiene `social_contract_version=1.0`. Exige `source_site=OPURO`, booleans
  reales, nueve targets explícitos y nueve resultados de plataformas distintas.
- Tres exports v1.0.1 completos y desactivados: coordinador, preflight staging y
  preflight Threads. Son subworkflows, no webhooks públicos sin autenticación.
- El coordinador devuelve nueve ramas independientes con consolidado validado.
  No llama staging ni workers remotos durante simulación.
- Los exports v1.0 se preservan históricamente, pero tienen incompatibilidades
  conocidas y **no deben activarse**; ver `changelog/SOCIAL_v1.0.1.md`.
- `tools/social/` permite regenerar exports, ejecutar pruebas y verificar que no
  divergen del código fuente. Validadores Ajv empaquetados sin dependencia npm en n8n.
- Corregidos sólo punteros documentales atrasados del Publisher en manifest y
  fuentes maestras. Los tres exports Publisher y maestros no cambian.

Probado:
- 35 pruebas Node aprobadas, incluyendo ejecución de los Code nodes exactos del
  JSON en VM sin red, rechazo de entradas inválidas, consolidado de nueve estados,
  `dry_run` sin IO externo, live bloqueado, hash/firma del binario y preservación.
- JSON Schema 2020-12 de entrada/salida, generación reproducible, grafo y
  `git diff --check`. Audit npm incluyendo desarrollo: 0 vulnerabilidades reportadas.
- CI agregado para repetir build-check/tests. No declarar aprobado CI remoto
  hasta consultar la ejecución GitHub correspondiente.

No terminado / bloqueos:
- **Idempotencia efectiva pendiente:** no hay almacén durable elegido, provisionado
  ni adaptador con claim atómico. Requisitos en `docs/SOCIAL_DURABLE_STORE_REQUIREMENTS.md`.
  El gate `LIVE_BLOCKED` está en código, no admite bypass por input/variable.
- Falta comprobar versión/configuración n8n (Merge 9 inputs y built-in crypto),
  importar la revisión nueva y ejecutar el primer dry run nativo.
- Fase 1 sigue exclusivamente OPURO (`oxigenopuro.com.mx`). `IMAGEN_SOCIAL` sigue
  siendo un tercer asset manual de Canva posterior a Publisher; no HERO/interior.
- Staging objetivo aprobado: WordPress OPURO temporal, no R2, mediante
  `OPMX_OPURO_WP_BASE_URL`. v1.0.1 sólo inspecciona/prepara metadata offline; no
  sube ni elimina medios. Retención siete días desde distribución terminada,
  fecha de limpieza aún null durante preflight.
- Pendientes: upload/readback WordPress, OAuth/permisos por red, publicación,
  readback remoto y pruebas persistentes de duplicado/concurrencia/timeout.
- Threads conserva propuesta de formato, no nueva aprobación editorial. El helper
  offline ya lee `media.social.alt_text` y produce saltos de línea reales.
- TikTok sigue bloqueado por migración/verificación del CMS definitivo;
  YouTube Community y WhatsApp Channel siguen `SKIPPED/MANUAL_REQUIRED`.

Siguiente paso: importar v1.0.1 en un workflow de prueba **separado del Publisher**
y ejecutar `dry_run=true`. En paralelo, el chat principal debe aprobar el servicio
persistente que cumpla los requisitos de idempotencia; no se selecciona uno aquí.
Sólo después implementar store y adapters, empezando por el orden de habilitación
de `SOCIAL_INTEGRATION_CHECKLIST.md`. No activar publicaciones ni limpieza antes.

Debe construirse como workflow independiente y conectarse posteriormente al Publisher mediante contrato explícito. No crear un workflow monolítico.

Destinos previstos:
X, LinkedIn, Google Business Profile, Facebook, Instagram, Threads, TikTok, YouTube y WhatsApp Channel.

Cada rama debe ser independiente y terminar en `SUCCESS`, `FAILED` o `SKIPPED`.

YouTube Community y WhatsApp Channel deben permanecer `SKIPPED/MANUAL_REQUIRED` mientras no exista una vía oficial adecuada y aprobada.

## Reglas funcionales ya aprobadas
- X / LinkedIn / Google Business / Facebook / Instagram: `SUBTITULO + "\n\n" + URL_OPURO`.
- TikTok PHOTO: título = `TITULO_SEO`; descripción = `SUBTITULO`; sin URL_OPURO.
- YouTube deseado: `SUBTITULO + "\n\n" + URL_OPURO`; imagen derivada 1:1 con recorte alineado arriba, sin alterar el original.
- WhatsApp Channel: compartir URL_OPURO manualmente para generar link card.
- Threads: rama independiente. Su formato definitivo y API deben cerrarse durante diseño/implementación contra documentación oficial vigente.
- La imagen social original nunca debe alterarse para satisfacer otra plataforma; las transformaciones son copias derivadas.

## Principio arquitectónico
ChatGPT toma decisiones editoriales. n8n ejecuta y valida operaciones técnicas.

## Protocolo de hitos para Work
En CADA hito relevante:
1. Actualizar este archivo con estado, versión vigente y siguiente paso.
2. Actualizar `docs/SOCIAL_DISTRIBUTION_ARCHITECTURE.md` si cambia arquitectura o comportamiento.
3. Actualizar `docs/SOCIAL_PLATFORM_MATRIX.md` si cambia una plataforma, API, permiso o estado.
4. Versionar workflows JSON completos/importables; no documentar sólo fragmentos.
5. Registrar contratos nuevos o modificados en `contracts/`.
6. Dejar un resumen breve: hecho / probado / pendiente / bloqueos.
7. No declarar algo “probado” sin evidencia de ejecución.

## Siguiente hito
Prueba n8n nativa del preflight v1.0.1 y aprobación del almacén durable. Después,
claim atómico + staging WordPress + primer adapter real con verificación, sin
modificar Publisher. Faltan aprobación funcional del formato Threads y sus pruebas.


## Unificación Motor Editorial — 2026-10-23

Este repositorio también será el punto de convergencia versionado de los maestros del Motor Editorial OPMX. La migración se hace sin degradar componentes ya más nuevos de `main`.

Reglas:
- No sustituir `SALIDA_EDITORIAL_OPMX_v2.2.json`, `PROTOCOLO_EDITORIAL_OPMX_v4.2.md` ni otros contratos técnicos vigentes por archivos históricos sólo porque provengan de un chat anterior.
- Las cinco familias maestras del Motor se resuelven por versión semántica máxima; sufijos de copia no son versión.
- Los contextos `05_CONTEXTO_EDITORIAL_*.json` son opcionales y se resuelven por familia y versión semántica máxima.
- Hechos actuales verificados prevalecen sobre cualquier contexto editorial.
- `workflows/publisher/OPMX_Publisher_MEDIA_v1.2.12.json` es la versión vigente y validada; v1.2.11 permanece como rollback probado y v1.2.10 como baseline.
- `workflows/social/` permanece separado del Publisher y sigue el contrato Social activo.
- No reconstruir Template, CSS, Prompt Maestro, catálogo ni contrato MEDIA desde memoria. Su incorporación al repo debe hacerse desde el archivo fuente vigente exacto.


## Gutenberg editorial rendering — 2026-10-24

Se agregó `docs/GUTENBERG_EDITORIAL_RENDERING_CONTRACT_v1.0.md`: especificación del próximo adaptador Gutenberg del Publisher. Define bloques nativos, clases semánticas, separación entre contenido y chrome del frontend, UTF-8, validación de readback y compatibilidad OPURO/OPOL.

Estado: piloto visual verificado en OPURO con el borrador `post_id=2790` (“Claude Duet”). El Publisher vigente **no se ha modificado**: `SALIDA_EDITORIAL_OPMX_v2.2.json` sigue declarando `clean_html`. La migración a `gutenberg_blocks_v1` requiere una versión contractual y un workflow Publisher nuevos, pruebas de bloque y aprobación antes de activarse.


### Decisión adicional — cuerpo compartido

`GUTENBERG_EDITORIAL_RENDERING_CONTRACT_v1.0.md` ahora fija `content_gutenberg_v1` como futuro cuerpo editorial canónico compartido por OPURO y OPOL: un documento con bloques Gutenberg nativos, no un bloque HTML monolítico. El Motor entrega blueprint estructurado; Publisher serializa y valida; cada frontend aplica su piel de marca. Pendiente: contrato formal, Publisher vNext, serializador, pruebas y CSS de paridad OPOL.
