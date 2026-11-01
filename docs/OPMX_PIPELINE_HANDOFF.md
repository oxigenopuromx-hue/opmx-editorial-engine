# OPMX Pipeline — Handoff maestro

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
