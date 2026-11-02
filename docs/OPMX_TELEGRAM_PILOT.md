# Telegram editorial — estado actual H116

Bot activo22nodos,dd676c7e-2927-4b41-92fc-85abdf12c360: /nuevo → material → /listo. /estado consulta paquete abierto. Backend original privado en HostingerH115. Prueba de recorrido real de almacenamiento pendiente; recepción realH114 y SQLfixtureH115 ya comprobadas. No genera/publica por Telegram ni eventosWork todavía.

## H116 — Bot conectado a paquetes y originales privados (2 noviembre 2026, México)

ReceptorOSi8AcnzLlI0csRu actualizado de12a22nodos y ACTIVO dd676c7e-2927-4b41-92fc-85abdf12c360,sameAsDraft=true. Usa backendHostingerH115 ya desplegado; no nuevo despliegue de guard ni variables. Identidad real del propietario y credenciales Telegram/guard existentes preservadas. Retenciónnone/none/saveManualExecutions=false,binaryMode=separate; timeout180s para operaciones acotadas de descarga/guardado/acuse. Publisher y WordPress sin cambios.

Flujo: /nuevo abre o devuelve paquete activo; se requiere paquete antes de aceptar material, sin descarga cuando no existe. Texto se guarda como fuente; archivo reserva recibo/paquete ANTES de descargar, comprueba firma/bytes, guarda original en guard y sólo entonces informa “guardado”. /listo solicita cierre y sólo confirma READY/revisión si no hay descargas pendientes. /estado muestra cantidades/estado del paquete abierto. /descartar ti_… sólo marca reserva PENDING sin original; nunca borra originales guardados. /start y /ayuda muestran instrucciones. /id conserva su ruta de identificación. Caption con /nuevo sigue siendo fuente, no comando. “Publica en ambos” todavía es texto fuente, no orden de publicación implementada en Telegram. READY NO envía eventos ni genera/publica automáticamente.

Traducción de fallos: incertidumbre del guard o descarga no afirman almacenamiento; incluyen reserva cuando corresponde para revisión. Acusefallido después de STORED devuelve RECEIPT_NOT_CONFIRMED con source_stored/original_stored conservados: no tratarlo como pérdida ni repetir publicación. Base64 sólo temporal entre comprobación y guard; se elimina antes de acuse/resultado. El recibo persistente incorpora package_id,item_id,source_stored,original_stored y mantiene campos mínimos anteriores. No incluye texto,captions,nombres,binarios,file_id ni URLs. Los3recibos realesH114 siguen intactos con nuevas columnasnull; no reescribirlos como originales almacenados.

Pruebas:127NodePASS (incluye control de comandos,captionnoejecutable,sesiónincierta,paquete capturado,duplicados,bytes/IDincorrectos,Base64 eliminado,cierrependiente y conexión del grafo). QA n8n281–293,13success: abrir,texto,PDFguardado,sinpaquete,guardincierto,descargafallida,duplicado,cierrependiente,cierreREADY,/id,usuario no autorizado,acusefallidodespuésdeguardado ycaption/nuevo. Trigger/Telegram/3HTTPfijados; tablas de identidad y recibosdryRuntrue. Aserciones de salida ejecutadas en nodo resultado temporal. Después finalmente se restauró identidad real,tablasdryRunfalse y código resultado sin aserciones; comprobado antes de activar. Consulta de recibos mantuvo exactamente3filasrealesH114: no IDs ni recibos ficticios persistidos por QA. Credenciales3HTTP confirmadas por IDmetadata del guard existente; sin lectura de secretos. Validación sin warnings.

Límite de evidencia: H114 prueba recepción/descarga real Telegram; H115QA279 pruebaBLOB/lectura real MySQL; H116 prueba lógica integrada con HTTP fijado. Falta prueba real del nuevo recorrido Telegram→reserva→BLOB→cierre. Al consultar tras activar seguían sólo los3recibosRECEIPT_ONLYanteriores. Se indicó al propietario probar /nuevo,texto+foto+PDF,esperar acuses de guardado,/listo. No declarar originales de H114 recuperados: fueron descartados por el piloto anterior. No volver a pedir esos tres envíos para validar recepción básica; la nueva prueba valida conservación/agrupación.

Versionado misma rama feat/mcp-publisher-file-draft/PR9editorial draft:0b627f9(package-ingress),ab3fa4c(pruebas),ae629e1(builder operaciones),1a94ba6(snapshotH116sanitizadoinactivo). Snapshot workflows/telegram/OPMX_TELEGRAM_PAQUETES_H116_REFERENCIA.json sin credenciales,webhookIds ni IDs reales. No aplicar H110builder ni snapshotsH111/H113 al vivo; son históricos. GuardstorageZIPH115 sigueActual enHostinger; screenshot verificada del despliegue disponible en el workspace, sin secretos.

Siguiente: comprobar recibos PACKAGE_STORAGE/source_stored/original_stored y READY del propietario; recuperar manifiesto/original con guard privado sin habilitar logging. Luego implementar lectura autenticada para Work y MCP Events en endpoint OAuth existente,verificación firmada de callback,persistencia de suscripciones/outbox y suscripción en Work del proyecto Motor. Lectura actual de documentación oficial confirma esa ruta, pero el servidor todavía sólo anuncia tools; no hay suscripciones ni eventos activados. No sustituir por API de pago ni afirmar que el evento transporta PDFs/imágenes. MASTER/draft fixture y publicaciónTelegram siguen pendientes; Social después, junto con cierres de concurrenciaH108/CIfrontend.

## Historial anterior

# Telegram editorial — estado actual H115

Backend de paquetes privado desplegado y fixtureSQL validado. Bot aún RECEIPT_ONLY; falta conectar reserva/almacenamiento antes de Motor. Recepción realH114 ya validada: no repetir por contexto perdido.

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

## Historial anterior

# Telegram editorial — estado actual H114

Recepción real validada: texto,JPEG150508bytes,PDF300310bytes; todos RECEIPT_CONFIRMED. Ya no se requiere repetir esas tres pruebas para validar el pilotoH113. No conservaron originales.
Siguiente: almacenamiento y paquetes antes de Motor. No declarar generación/publicación por Telegram todavía.

## H114 — Recepción real Telegram validada (2 noviembre 2026, México)

Propietario informó “listo” tras reenviar. Consulta de tablaT7kVEMKmX1w2viLz devolvió3recibos reales del chat autorizado: TEXT, JPEG150508bytes y PDF300310bytes, todosRECEIPT_CONFIRMED y RECEIPT_ONLY. Fechas14:05:16–14:05:17México. Se comprobaron descarga, firma básica,bytes y acuse al chat original; no sólo ejecución exitosa. No se incluyen receipt_id/IDs personales reales ni contenido en GitHub. Workflow12nodos activo d8ffd9a9-bb23-48d6-bb95-a061316f5fff.

Este hito valida Telegram→n8n→verificación→acuse. No valida conservación de originales,agrupación,lectura por Work,eventos,Máster ni publicación. El piloto sigue descartando originales tras comprobarlos y guarda sólo metadatos mínimos. No reenvío de contenido a WordPress ni publicación de pruebas.

Siguiente acción autorizada: implementar persistencia y paquetes antes del puente al Motor. Inventario de credencialesn8n: Telegram existente y MySQL disponible; GoogleDriveOAuth0. Evaluar baseMySQL existente para metadatos y originales con límites/cuotas/queries preparadas, sin mezclar tablas del guard ni habilitar logging de archivos. Si la conexión no funciona, reportar bloqueo concreto; no tratar file_id Telegram como almacenamiento durable de originales.

Versionado: misma rama feat/mcp-publisher-file-draft/PR9editorial draft. Cambio documental; código/grafoH113 sin cambios. H113112tests yQA269–272 permanecen como evidencia sintética adicional; los3recibos reales son la evidencia nueva. Social posterior. No DNS,secretos nuevos ni publicaciones reales.


## Registro histórico anterior

# Telegram editorial — estado actual H113

Bot @opmxpublisherbot; chat propietario autorizado. Receptor activo12nodos versión d8ffd9a9-bb23-48d6-bb95-a061316f5fff.
Tabla de comprobación: T7kVEMKmX1w2viLz (proyecto personal WyiSsL1U3KChdMw1). Consultar receipt_id/status/kind/mime_type/bytes_received/mode/observed_at tras envío.
No solicitar token ni copiar IDs. Reenviar texto,foto,PDF/DOCX para comprobar recepción con evidencia mínima. No se guarda contenido ni originales, no genera/publica todavía.

## H113 — Evidencia mínima de recepción Telegram (2 noviembre 2026, México)

El propietario informó que ya envió texto/foto/documento. La consulta de ejecuciones de OSi8AcnzLlI0csRu después de /id devolvió0 registros porque el piloto conserva saveDataSuccessExecution=none,saveDataErrorExecution=none,saveManualExecutions=false. Por ello los envíos reportados NO se declaran verificados desde n8n ni fallidos: el resultado anterior no puede reconstruirse con las herramientas disponibles. Se explicó la limitación y se pidió reenviar las pruebas después de instrumentar evidencia mínima.

Cambio: tabla personal “OPMX Telegram — recepciones verificables”,T7kVEMKmX1w2viLz, columnasreceipt_id,status,kind,mime_type,bytes_received,mode,observed_at. Sin texto,caption,nombre de archivo,file_id,URL,token ni binario. receipt_id incluye IDs de Telegram por diseño existente y sólo persiste en n8n. No se guardan datos personales de recepción reales en GitHub. Un DataTableupsert después del resultado conserva el estado final; esto permite verificar bytes y acuse sin activar retención general. El upsert es por receipt_id y NO demuestra exclusión atómica ni evita repetir acuses ante updates duplicados.

Resultado piloto ahora incluye MIME. El nodo de acuse usa continueRegularOutput sin retry para que un fallo de Telegram llegue al clasificador RECEIPT_NOT_CONFIRMED y su evidencia. Fallos anteriores al resultado o en la propia tabla siguen sin registro persistente; no es un monitor exhaustivo ni almacenamiento de originales. Los archivos sólo se comprueban en memoria; Publisher/Motor no llamados.

QA269PDF sintético16bytes+acuse,270texto+acuse,271texto+fallo de acuse,272remitente no autorizado:4ejecuciones success con Telegram fijado y DataTabledryRun=true. La ejecución success del caso271 no significa acuse confirmado: el código clasifica error de transporte como RECEIPT_NOT_CONFIRMED. Consulta posterior tabla0filas; ninguna prueba ficticia persistida. Se restauraron allowlists reales y dryRun=false antes de publicar; nunca se publicó la configuración QA1001. Suite local112PASS. No se enviaron mensajes reales desde QA.

Live:12nodos,versiónd8ffd9a9-bb23-48d6-bb95-a061316f5fff,active=true,sameAsDraft=true; credencial existente y retenciónnone/binaryModeseparate/timeout90 preservados,validación sin warnings. Tabla vacía antes de activar evidencia. La recepción real de los adjuntos con esta versión sigue pendiente. Reenviar texto,foto y PDF/DOCX≤10MiB para comprobar resultados mediante tabla.

Snapshot sanitizado workflows/telegram/OPMX_TELEGRAM_RECEPCION_H113_REFERENCIA.json,commit5bb3fbd42eafa346a307a6a9901681d7b1b6cf41. Contiene allowlists vacías y sin credenciales/webhookIds,active=false como referencia,NO desplegar directamente sobre el receptor. Misma rama feat/mcp-publisher-file-draft,PR9editorial draft. H110builder histórico y H111snapshot ya no representan el grafo actual.

Pendientes después de recepción: paquetes/originales durables,agrupación/versionado,lecturas autenticadas,MCP Events y suscripción Work,MASTER y fixture draft; cierre de concurrencia publicaciónH108 y CIfrontend antes de Social. No se conecta API de IA de pago ni se publican notas como prueba. Siguiente acción: consultar tabla tras reenvío real; no afirmar transporteTelegram→Motor funcional por este hito.


## Historial anterior (no usar como configuración actual)

# Telegram editorial — estado actual H112

Bot: @opmxpublisherbot. Chat privado del propietario autorizado tras /id real y confirmación en Work.
Workflow activo: https://n8n.oxigenopuro.com.mx/workflow/OSi8AcnzLlI0csRu

## Prueba real pendiente

Enviar al bot un texto corto, una foto y un PDF o DOCX de prueba de hasta10MiB por archivo. El bot debe confirmar cada recepción. No hace falta copiar IDs ni compartir token.
Este piloto recibe y comprueba bytes; todavía no agrupa paquetes, almacena originales, genera ni publica notas.

## H112 — Identidad Telegram real autorizada (2 noviembre 2026, México)

El propietario confirmó “listo” después de enviar /id a @opmxpublisherbot. Consulta de la tabla personal de candidaturas: una sola identidad privada, con user_id=chat_id, observada el 2 noviembre2026 a las13:54:57 de México. No hubo ambigüedad ni autorización del primer remitente sin confirmación. Los IDs personales quedan sólo en n8n; no se incluyen en repositorio ni este registro.

Se configuraron allowedUserIds y allowedChatIds exclusivamente con esa identidad y se publicó OSi8AcnzLlI0csRu,11nodos,versión4add8a03-d554-49d6-a214-03d43772b1b6. Readback: active=true,activeVersion.sameAsDraft=true,ambas allowlists correctas. Credencial existente preservada,retenciónnone/none/saveManualExecutions=false,binaryMode=separate,timeout90s. Actualización1operación,sin warnings. La llegada real de /id queda comprobada por el registro del trigger; la prueba real de descarga de archivos sigue pendiente.

Verificación local:112PASS,0FAIL,ejecutando desde la raíz recovery-pr9. Primer intento desde el directorio padre falló por rutas relativas de fixtures; repetido desde la raíz correcta pasó sin modificar código. No se generaron notas ni se llamó Publisher/WordPress/Social. No se almacenaron originales ni se implementaron eventos Work en este hito.

Siguiente prueba del propietario: enviar al mismo bot un texto corto, una foto y un PDF o DOCX de prueba (cada archivo≤10MiB). Se espera acuse individual; aún RECEIPT_ONLY, sin agrupación,generación ni publicación. Después implementar paquetes y originales durables, lecturas autenticadas, MCP Events/Work y fixture draft con el contrato existente. No reutilizar el adaptador OpenAI con URLs Telegram. Social posterior; limitacionesH108 y CI frontend permanecen.

Versionado: rama existente feat/mcp-publisher-file-draft,PR9editorial draft. El grafo H111 sanitizado sigue siendo referencia: no cambia el grafo, sólo configuración privada de identidad. No sustituir configuración live por el snapshot de referencia con allowlists vacías.


## Registro histórico H111

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


