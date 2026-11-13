# Estado compartido — Telegram, Publisher y Motor Editorial

## Corte vigente — issue21 desplegado, 13nov2026 UTC / 12nov2026 19:07 CDMX

**El #21 ya está activo y comprobado.** Este corte reemplaza el estado “NO DESPLEGADO” del corte anterior.

- Guard: `opmx-guard-semantic-preflight21.zip`, Actual/completado **12nov19:07:12 CDMX**, SHA-256 `f31660357f16ff087284e8929549a427cc5f85fb8ff2eba79a612d24c18d2220`, 195143 bytes. Comparación de 83 archivos con la fuente productiva24: único cambio del manifiesto.
- MCP activo: `1b78dc88-cb9b-456f-b711-c3328031e61d`, **152 nodos, 5 grupos**; huella `1b1de2dea56ac4c738c9bf2c8ad26af6f082f520fd4cc64f361da2596b6ed56b`. Draft ajeno `a342823c-1a68-4dfc-81ab-622daf2061cd`,112 nodos, preservado idéntico y sin activar.
- Fuente21: `4b9116419a2d5a6b7ff12152f7a26b762a58219a`; manifiesto inmutable `edb20e76ad20b033cc68b80af98100dde33eb9a6`. La punta de la rama debe conservar este pin productivo152.
- QA:48 casos específicos/741 regresiones PASS; n8n38026 con27 casos/157 aserciones PASS; arranque del ZIP y14 rutas de denegación PASS. Guard productivo38041: **RUNTIME_OBSERVED, versionsMatch=true, sin escritores activos**, cinco versiones correctas. Huella del grafo activo cotejada por separado.
- Probe restaurado `5202de12-b06e-4d19-8137-00794fe9b799`: inactivo,3 nodos, grafo/settings originales y sin retención. No se publicaron o editaron notas, no se reintentaron paquetes y no se modificó el único Motor ni READY/preview.
- **25 y15 siguen corregidos/cerrados;21 queda corregido/cerrado.**29 y24 conservan los pendientes propios documentados;28 sigue diferido.

[Verificación, artefacto completo y reversión](issue21-semantic-preflight-20261113/VERIFICACION.md) · [Evidencia](issue21-semantic-preflight-20261113/EVIDENCIA_FINAL.json).

## Corte anterior — issues25→15→21 antes del despliegue21

Este corte prevalece sobre los estados históricos inferiores. Orden corregido por el usuario:25primero,15después,21al final. No se publicó ni editó ninguna nota ni se reintentaron paquetes en esta intervención.

| Issue | Estado comprobado |
| --- | --- |
|25|Corregido y activo en el único Motor. Resolución alternativa del enlace Google original hasta J.D.Power; lectura editorial sigue siendo obligatoria.37testsPASS. Fuente9dd6b86ec36d988bbe1af2cf9dfd00a13a41ed04. [Evidencia y reversión](issue25-source-link-20261113/VERIFICACION.md).|
|15|Corregido y activo en receptor db33c542-8fa0-48a9-848d-49aea32ae75e/52nodos.18tests+QA n8n38024/45asercionesPASS; cinco parámetros exactos y grafo preservado. PDF históricoDISCARDED,0PENDING; no reanudado. [Evidencia y reversión](issue15-pdf-20261113/VERIFICACION.md).|
|21|Implementado y probado, **NO DESPLEGADO, abierto**.48tests específicos/741regresiones+QA n8n38026/27casos157asercionesPASS. Entorno de despliegue pasó a unavailable antes de cualquier subida a Hostinger. [Punto exacto y continuación](issue21-semantic-preflight-20261113/VERIFICACION.md).|

- Motor6ae9095256948191b33f1e023fbfbf8b enabled; sólo se actualizó prompt a51831caracteres/SHA2567b09b7b0b0e29de0e03c248a3900f6cd1ac7739864e08c02ef3e9328eceef3b1, fijando helper25a9dd6b86. Configuración restante y suscripción READY/preview conservadas; no hay otro Motor.
- Guard sigue **opmx-guard-publisher-submission24.zip**, SHA256ee200f0986c682f109737b24192e961af54e9b51fd26f65fdcb1fec45aba3c96; última observación Hostinger Actual/completado12nov18:03:54CDMX. No se subió el candidato21.
- MCP **activo1b3bb5c6-e871-4d43-a9c1-21f7ef11cacb/151nodos**. Candidata21guardada en historia1b78dc88-cb9b-456f-b711-c3328031e61d/152nodos, NO activa. Draft112ajeno restaurado y cotejado, ahoraa342823c-1a68-4dfc-81ab-622daf2061cd. NO publicar el draft112como si fuera producción.
- Manifiesto en punta de feat/telegram-reopen-recovery vuelve al pin productivo24. Commitedb20e76ad20b033cc68b80af98100dde33eb9a6 preserva el futuro manifiesto21, **no acredita despliegue**. Los demás escritores, Shared, autor3 y monitor30 no cambiaron.
- Probe7IDUF9PeHQ5v331Z restaurado a sus tres nodos originales, inactivo, sin retención y timeout30. No quedó webhookQA ni proceso nuevo.

Pendiente operativo exacto: recuperar el entorno de despliegue, desplegar Guard/manifiesto21compatible, publicar MCP152coordinado y comprobar el runtime real. No hace falta otra autorización del usuario.29y24conservan los pendientes documentados en el corte anterior;28cancelación sigue diferido.

## Corte anterior — 12nov2026, despliegue24/22

Este corte prevalece sobre las fichas históricas que siguen. Fuente runtime inmutable57885f5fbe91b99b202d343bc2f2cd562a014745 en feat/telegram-reopen-recovery.

- Guard vigente: opmx-guard-publisher-submission24.zip, SHA256ee200f0986c682f109737b24192e961af54e9b51fd26f65fdcb1fec45aba3c96; Hostinger completado/Actual12nov18:03:54CDMX.
- MCP activo1b3bb5c6-e871-4d43-a9c1-21f7ef11cacb,151nodos; huella0513f7987a7f82fa47c380e3df93547a7b1674a95720d08a03bda0beade39a38. Su draft ajeno de112nodos se conserva como719ed751-2e44-418f-bbe9-90e9965084d1: NO publicarlo como si fuera la versión activa.
- Receptor activo561bd7df-473b-4eca-9e92-e0e81f4baabd,52nodos. Cuatro parámetros cambiados; mismo webhook, conexiones, credenciales, remitentes y reintentos. La tabla existente de recepciones añade storage_diagnostic sin mezclarlo con el acuse Telegram.
- Único Motor6ae9095256948191b33f1e023fbfbf8b: mismo estado, título, calendario, entornos y suscripción READY/preview; sólo prompt actualizado, SHA256ed1b77c7ce68d367288c66a63280be1b1fec42dc79aece45ac0f565f7e5e3eed. Reconoce aceptación durable y consulta acotada de resultado sin reenviar. Conserva LITERAL, autor3 y permisos anteriores.
- Los demás escritores y monitor30 no cambian. PUBLICATION_RECONCILED de Waldo12(1754) y China–Cuba8(1753) ya se guardaron automáticamente en37896; no son notas pendientes de volver a publicar. Waldo12 vuelve a quedar confirmado en los tres CMS en37972.

| Issue | Estado actual y alcance |
| --- | --- |
| 29 | Abierto: Simey tiene OPURO10493/OPOL3515 publish y LIBERAL393 draft; servidoresIA9 y comisiónMorena8 conservan recuperación pendiente. Guard37946 acreditó los resultados con ROLLBACK. [Revisión](issue29-conciliacion-20261112/REVISION.md). |
| 24 | Respuesta larga corregida: aceptación guardada antes del ACK y resultado histórico verificable por scope/hash/fase. Continúa abierto por las interrupciones históricas ANTES de Publisher, cuya causa no se pudo reconstruir. [Despliegue, pruebas y reversión](issue24-publisher-submission-20261112/VERIFICACION.md). |
| 22 | Corregido: diagnósticos seguros de apertura y replays READY/CANCELLED tratados como cerrados. No se atribuye retrospectivamente la causa del10nov. [Verificación](issue22-opening-20261112/VERIFICACION.md). |
| 19 y30 | Cerrados: aceptación LITERAL real23 y persistencia de publicaciones conciliadas. |
| 26 | Cerrado como conciliación del intento8; la nota de Waldo sí quedó publicada y conciliada en revisión12. No confundir ambas revisiones. |
| 28 | Cancelación sigue diferida por orden del usuario. |

675tests pasan. QA n8n37956(74checks),37960(15),37961/37962(ACK848ms→continuación),37979(Crypto/payload reales) y37972(backend activo/rechazos/replay/publicación histórica) pasaron sin publicaciones ni envíos. Probe inactivo3nodos, grafo original, sin retención; versiónfinal1beadd45-e5e0-44f3-bd37-b017f5020c11. No quedó webhook QA ni otra automatización.

## Cortes anteriores — contexto histórico

Corte inicial: 11 de noviembre de 2026, 14:30, America/Mexico_City. Actualización Waldo:14:48.
Actualización posterior:12 de noviembre de2026, conciliación de alertas WEG. Las fichas previas conservan el corte de su fecha.
Este índice está en main para todas las conversaciones. Es un registro de despliegues y evidencia; no implica que los exports históricos de main coincidan con producción. La consulta de issues abiertos no equivale a volver a conciliar todos sus paquetes.

## Leer antes de modificar producción

1. Consultar este índice y el issue correspondiente; distinguir defecto general, entrega editorial recuperada y criterio de aceptación pendiente.
2. Leer la versión publicada real de n8n. Sus borradores pueden contener trabajo distinto o de otro chat: no publicarlos para aplicar un cambio pequeño. Preparar sobre la versión activa, verificar el delta y conservar el borrador anterior.
3. La recuperación depende de versiones y huellas del manifiesto Guard. Actualizar coordinadamente ese manifiesto cuando cambie un escritor; una coincidencia temática, una espera o un HTTP200 no constituyen autorización.
4. Registrar qué cambió, IDs/versiones activas y de reversión, archivos/commits, pruebas, efectos reales y límites. No incluir secretos, capacidades privadas de intentos, originales ni datos privados de operadores.
5. Mantener el único Motor y la suscripción existente. Conservar paquete, revisión, request_id e IDs CMS. No reenviar resultados inciertos ni crear otro consumidor para desbloquearlos.

## Configuración n8n leída en este corte

| Componente | Workflow | Estado | Versión publicada |
| --- | --- | --- | --- |
| OPMX — Telegram recepción · publicación predeterminada v1 | `OSi8AcnzLlI0csRu` | Activo | `b9a2f944-8a03-4fd2-a730-3b93b6c33688` |
| OPMX — Publisher archivos MCP | `bnzVMNkZuGO1GQCZ` | Activo | `c0de03ed-e7a7-4255-a9c8-9ca76404424e` |
| OPMX Publisher — formulario · destinos v3 | `Mt7ts2EGPbyaTC2o` | Activo | `d6bbb33a-ab6e-4f90-a88c-921623426444` |
| OPMX — Entrada automática · borradores v3 | `4o7K5TmKc7joScqB` | Activo | `4263fea4-90a4-406d-a234-da7397d456bf` |
| OPMX — transporte actualización confirmada #18 | `qBmLf0DmcMSfuWvm` | Activo | `d04fb5c2-ba36-48f9-9cd4-2958ab1f273e` |
| OPMX — observación técnica runtime #18 | `2HBn1RnSYgyxuHgE` | Activo | `b88257e9-7f6d-41e3-bdfd-e2cd40c12c25` |
| OPMX — conciliación CMS lectura #18 | `F4Ybwst2LZfzKyWS` | Activo | `0bb87412-b517-4d6e-8a1c-426acb6151ef` |
| OPMX — Alertas de administrador | `NFOBzPfHmvRjVFOA` | Activo | `efa564a8-3f87-4936-ba1a-2b1a33a0879f` |
| OPMX — comprobación API lectura #18 | `7IDUF9PeHQ5v331Z` | Inactivo | Sin versión publicada |

Esta lectura confirma las versiones, no inicia flujos ni prueba por sí sola WordPress. La observación de ejecución34236, realizada durante el despliegue de autor3, confirmó los cinco grafos de escritura con RUNTIME_OBSERVED/versionsMatch=true/noActiveN8nWriters=true.

## Cambios aplicados por este chat y fuentes versionadas

### Recuperación / vista previa, issue18

- Receptor existente: reapertura/selección/vista/confirmación y diagnóstico administrativo; controles de cupo y reservas preservados. El caso ALREADY_OPEN deja de añadir al administrador como propietario nuevo.
- MCP: resuelve al propietario original desde el ledger y conserva la decisión confirmada; no transfiere propiedad del paquete al administrador.
- Guard: snapshots, barreras por revisión y destino, intento exclusivo, reconocimiento de decisión antes de escritura, recibos durables y comprobación de escritores.
- Transporte UPDATE: consume una capacidad de trabajo acotada y actualiza los IDs confirmados, sin aceptar una URL o ID de reemplazo arbitrarios.
- Motor en ese despliegue histórico: se amplió el prompt de la automatización existente para PREVIEW, UPDATE y CREATE EDITORIAL confirmados, manteniendo READY y el protocolo vigente. Pin de chooseMotorPolicy bc9138f1dc60f838559d385ec4fc20f511089210. No se creó otra automatización ni se cambió la suscripción a una distinta. El prompt aplicado está versionado en la referencia inferior; no se volvió a leer la configuración de la automatización durante este corte.
- Recuperación de interrupción: sólo un administrador configurado puede invalidar la capacidad anterior del mismo intento RUNNING mientras la barrera sigue AWAITING_DECISION y la revisión/evento/huella coinciden. No habilita reintentar una escritura incierta.
- QA anterior: borrador OPURO10428, actualización literal de extracto, readback y cierre durable comprobados. No se extrapola a publicaciones públicas en tres destinos.
- Caso real de Milenio: llegó a READY19 con CREATE/EDITORIAL/TODOS confirmado; fuentes y archivos validados. Antes de escribir se encontraron las publicaciones ya existentes OPURO10438/OPOL3477/LIBERAL307. El intento quedó ATTEMPT_BLOCKED; no CANCELLED ni ATTEMPT_COMPLETED, y no se atribuyen esas notas existentes a esta revisión.
- 470 casos locales en esa batería histórica de recuperación. El bloqueo temporal de CREATE LITERAL se levantó posteriormente mediante el perfil, la prueba de texto Guard y los escritores del issue19 descritos abajo. Faltan otros criterios de aceptación del issue18; no está cerrado.

Referencias inmutables:
- [Ensayo QA y límites](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/blob/1f4b464007ee8dabbf64e8eafeec61afcca36b0e/docs/operations/issue18-release-20261111/VERIFICACION_FINAL.md)
- [Caso real CREATE y duplicado](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/blob/1f4b464007ee8dabbf64e8eafeec61afcca36b0e/docs/operations/issue18-create-recovery-20261111/VERIFICACION_CREATE_DUPLICADO.md)
- [Release del receptor](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/blob/1f4b464007ee8dabbf64e8eafeec61afcca36b0e/docs/operations/issue18-create-recovery-20261111/receiver-release.json)
- [Resolución de propietario MCP](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/blob/1f4b464007ee8dabbf64e8eafeec61afcca36b0e/docs/operations/issue18-create-recovery-20261111/mcp-owner-resolver.json)
- [Prompt aplicado al mismo Motor](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/blob/1f4b464007ee8dabbf64e8eafeec61afcca36b0e/docs/operations/issue18-create-recovery-20261111/motor-prompt.txt)
- [Manifiesto de versiones/huellas del escritor](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/blob/1f4b464007ee8dabbf64e8eafeec61afcca36b0e/tools/telegram/guard-recovery-candidate/writer-release-manifest.mjs)

Los informes anteriores conservan los despliegues de su fecha; el último manifiesto y la tabla de este índice identifican las versiones posteriores. No restaurar un ZIP antiguo sólo porque un informe de QA lo enumere.

### Autor editorial de El Liberal

- Las dos entradas de Publisher producen author_liberal.id=3, Redacción El Liberal MX, usando la credencial existente del usuario2.
- El usuario autorizó edit_others_posts para el usuario2. Conservó rol author; no recibió manage_options ni edit_users. No cambió la credencial.
- Borrador aislado377: POST201 y GET independiente200 con author=3, status=draft. Se movió a papelera sin publicarlo. Código temporal de mantenimiento retirado; plugin editorial restaurado. No se modificaron notas históricas desde este chat.
- Ocho regresiones de normalización LIBERAL/OPURO/OPOL/TODOS y16 casos de contrato de versiones pasaron; sólo cambia el autor Liberal.
- Guard desplegado por este chat: opmx-guard-liberal-author3.zip, SHA2566fd89065fd675f0836847a6bbe1daf9a045e8d7c3ce5fe4859d859420a32e5f1. Basado en el release de recuperación anterior; sólo actualiza las dos entradas del manifiesto para Form/Shared.
- Diagnóstico temporal restaurado al GET de tres nodos, inactivo y sin retención manual ni de resultados.

Fuentes:
- [Cambio, permiso, pruebas y activación](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/blob/1f4b464007ee8dabbf64e8eafeec61afcca36b0e/docs/operations/LIBERAL_AUTOR_3_20261111.md)
- [Operaciones exactas de normalizadores y evidencia de release](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/blob/1f4b464007ee8dabbf64e8eafeec61afcca36b0e/docs/operations/LIBERAL_AUTOR_3_RELEASE_20261111.json)

Reversión conjunta de Form/Shared: versiones anteriores0a0af4ac-fe0d-4aff-a662-7e45bf87a320/cce524a4-660e-4d05-af66-39e003c6338b y el manifiesto Guard compatible anterior. No revertir únicamente un escritor dejando pins incompatibles. El permiso WordPress es una decisión separada; no revocarlo ni alterar roles durante una reversión técnica sin revisar su uso.

## Conciliación durable del intento de Waldo — issue26

Actualización posterior al corte inicial del11nov2026. Se separó el trabajo de cancelación a28 y se atendió primero Waldo.

- Paquete `tg_ae41ddbd480407eb263090c3ac41c2fa9dbe9c8f`, revisión8. La clave original se conserva; no se generó otra solicitud de publicación.
- Ejecución34438, HTTP200: `UNWRITTEN_ATTEMPT_FROZEN`; intento `REVOKED`, barrera `RECONCILING`, resultados OPURO/OPOL/LIBERAL `BLOCKED`.
- `writeAuthorized=false`, `reopenAuthorized=false`, `retryPermitted=false`. La conciliación no entrega capacidad de escribir, reabrir ni reintentar; tampoco afirma terminación física de un proceso ChatGPT.
- Relectura del paquete: `READY8`, cinco elementos y sus cinco SHA idénticos. No se crearon/actualizaron notas ni medios, no se cancelaron paquetes y no se alteró la suscripción del Motor.
- Este resultado permite cerrar26 como **conciliación del intento**, no como entrega/publicación de Waldo. La publicación permanece pendiente de su flujo autorizado posterior; no usar `iniciar_intento` otra vez sobre revisión8.
- Guard activo posterior: `opmx-guard-waldo-reconciliation.zip`, SHA256 `f995fe7aa1f0de60d2f3f44abeec0c089e90023e63720f9e3fea99a48fcccbe3`; código fuente `e1410223770592c0dcb9fc9ae3fd5f956db98481`.

[Informe de verificación de Waldo](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/blob/5928d1d2c186f69601cb44e1338dbd89eae11718/docs/operations/issue26-waldo-20261111/VERIFICACION.md), con release y acuses de producción. Pasaron523 pruebas, incluidas52 del freeze. La comprobación posterior34444 confirmó nuevamente el gate real con ROLLBACK; el diagnóstico temporal quedó restaurado e inactivo sin retención. La reapertura posterior exige un `/abrir` real y recibo auténtico de Telegram; no fabricar ese recibo ni reciclar la revisión8.

Este ZIP es posterior al del cambio de autor3. La ficha de autoría anterior conserva la evidencia de su propio despliegue histórico; no debe interpretarse como el último ZIP activo ni usarse para revertir esta conciliación.

## Alertas inciertas después de publicación — issue30

Actualización del12nov2026. WEG/revisión8 quedó conciliada: recibo durable PUBLISH confirmado y lecturas de OPURO10513, OPOL3524 y LIBERAL397 en publish. El seguimiento conserva la alerta histórica y añade PUBLICATION_RECONCILED1670. No se publicó ni modificó ninguna nota durante esta revisión, ni se falsificó PROCESS_COMPLETE o ATTEMPT_COMPLETED.

El monitor administrativo existente ahora consulta Guard antes de enviar alertas DRAFT_UNCERTAIN/PUBLISH_UNCERTAIN. Sólo una prueba final PUBLISH íntegra, de la misma solicitud/revisión, con todos los destinos verificados y escritores inactivos puede suprimirlas. Borrador, parcial, error, acuse ausente, prueba vieja o identidad ambigua conservan la alerta; los demás bloqueos se mantienen.

- Monitor NFOBzPfHmvRjVFOA activo:2d3e18a9-ff68-4f5c-9fdc-ce6a694b1cd6,11nodos. Reversión:f9d2c08d-a31a-4d95-ac7f-9b2f37b981b9. Mismo remitente, administrador, horario y tabla.
- Guard de ese despliegue histórico: opmx-guard-final-publication-observer.zip, SHA256 ecd2f908e6e19616097ebcf5aee891aa64e36b3305675ffab4c32146bb55fdc0. Su endpoint observe-final es sólo lectura. Conserva recuperación, autor3, pins de escritores y único Motor/suscripción anteriores. Es posterior al ZIP Waldo de la ficha histórica.
-130 pruebas pasan. Ensayo aislado n8n37011 con Guard real: qaSuppressed=true, PUBLISH/TODOS y los tres IDs originales; sin envío Telegram ni escrituras de tabla/CMS. Primera ejecución programada37017:SUCCESS, sin candidatos ni notificación.
- Diagnóstico temporal restaurado a su GET original, inactivo y sin retención. Su límite de30s permanece sólo en ese probe inactivo; no cambia tiempos del Motor. No se ampliaron accesos ni credenciales.
- Esta corrección resuelve la alerta obsoleta. No elimina por sí sola la causa de esperas largas de herramientas (#24), ni cierra los pendientes generales del #18. #28 continúa diferido.

[Informe, acuses y reversión](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/blob/3a00789fed4b74433449b50d4b81dff60d445ce6/docs/operations/issue30-publication-alert-20261112/VERIFICACION.md). Código fuente y pruebas: fdbe48cf8679840d6fcc2f1d8930b96a1323137e y6a57020777fd3c5a8482e043a7e260ecf0e38c31.


## Entrega literal — issue19, actualización12nov2026

Implementación desplegada, fuente fijada e7fae39e62d8b233c379198d24c516fe4b580071. Maestros/perfil aprobados en main b1064e91ae795e5843c77485d2215425fdfdced5. Prompt4.10 selecciona perfil; contrato EDITORIAL1.4.2 y prompt4.9 histórico permanecen sin cambios.

- Guard del despliegue inicial: opmx-guard-literal19.zip, SHA256518721f59f5803885e852d99f6e884901031310974e6865775074ee91d92c163, Hostinger completado/Actual12nov16:06:48CDMX. Conserva Waldo, autor3 y observación/alertas30.
- Receptor52nodos: b9a2f944-8a03-4fd2-a730-3b93b6c33688. Sólo cambian tres Code; mismos remitentes, webhook, credenciales y conexiones.
- MCP137nodos:32e28420-47ef-4732-b346-22c2708bff49; Shared146nodos:4263fea4-90a4-406d-a234-da7397d456bf; Form58nodos:d6bbb33a-ab6e-4f90-a88c-921623426444. Pins/grafos verificados. Los drafts ajenos originales se restauraron sin cambiar estas versiones activas; no publicar un draft antiguo suponiendo que coincide con producción.
- Único Motor6ae9095256948191b33f1e023fbfbf8b: actualizado sólo prompt, SHA256f74b77103dea0434c7f8fe1e85d66b7ac7ebec5f055a5658eb162150f612f0dd. Misma suscripción READY/preview, título, conversación y entorno; no hubo otro Motor ni reenvío histórico.
- /literal o una frase exacta directa y separada como «La publicación va tal cual, sin agregarle nada» acredita tratamiento literal; no concede permiso de publicar ni elige destinos. /editorial vuelve al tratamiento ordinario. En recuperación se conserva /opciones crear|actualizar literal DESTINO y la confirmación de vista vigente.
- LITERAL conserva título/subtítulos/párrafos y fecha original, sin En breve, nuevas fuentes, encabezados, investigación ni cierre. Guard exige corpus completo y límites originales; rechaza mover fragmentos del título, dividir/fusionar párrafos o añadir enlaces/tooltips. No se trunca por objetivos SEO60/160. Límites técnicos previos: título2048bytesUTF8/subtítulo500caracteres.
- 450 pruebas pasan; ejecución37529 prueba código real de n8n con28assertions y título130/subtítulos362. Ejecución37532 usa observe-final real y confirma pins/idle, recibo PUBLISH y CMS OPURO10513/OPOL3524/LIBERAL397 de WEG sin escribir. Ejecución37537 rechaza entrada vacía del nuevo endpoint literal sin permiso ni escritura.
- Probe7IDUF9PeHQ5v331Z restaurado al GET n8nApi original, inactivo3nodos, sin retención. Todas las versiones activas se releen tras restaurar los drafts.
- La nota tg_dd8ff15fbc93b83b3e579c4266d5aea4bcf2be7b permanece READY10 con seis elementos. Esta implementación no reclamó/reintentó su intento, no cambió sus fuentes ni publicó. Una instrucción histórica no acreditada no se convierte retroactivamente en control. El usuario publica por su cuenta; recuperar ese intento sigue requiriendo el procedimiento autenticado y su orden vigente.
- No se hizo publicación literal positiva en producción: la aceptación positiva de contenido usa fuentes sintéticas y proveedores reales con BD simulada; las verificaciones de producción son de sólo lectura o rechazo de entrada inválida.

[Informe y reversión](issue19-literal-20261112/VERIFICACION.md) · [Acuses técnicos](issue19-literal-20261112/EVIDENCIA.json). No confundir estas pruebas con publicación de la nota pendiente ni con cierre general de18. Cancelación28 sigue diferida.

### Seguimiento rev14 — posterior al despliegue

El modo CREATE LITERAL/TODOS sí se reconoció. Motor5062acc3… bloqueó una instrucción histórica activa de48bytes como fuente ambigua. Se usa la exclusión autenticada existente /descartar ti_499936aa3b91ce9f1e5193c0c368531bfe1ee218 dentro de /abrir, seguida de /opciones crear literal TODOS, /listo y confirmación de la nueva vista. La exclusión conserva original/SHA y no afecta artículo/fotos; no convertir la fuente histórica en control por interpretación del modelo.

Se corrigió además una dependencia del helper de imagen que exigía chunks para DISCARDED. Pin activo de chooseGeneratedImage:68134a5b29c43f0ec0dbf83f4c0e7c507c25966b; usa inventario auténtico íntegro, omite DISCARDED y mantiene SHA para STORED. Sólo se actualizó prompt del mismo Motor (SHA25691c3e9878c348ee13bbc24604c82ee0b33ffcf1b21d9fc326bd7d2cf46d60df6), con relectura exacta y suscripción/entorno conservados. Guard, n8n y selector/compilador literal e7fae39e… sin cambios.466 pruebas pasan. Issue19 reabierto hasta aceptación real del operador; DEV no modificó ni publicó rev14. [Informe y pasos](issue19-literal-20261112/RECURRENCIA_REV14.md).


### Seguimiento rev19 — validación de archivos

La instrucción histórica ya está DISCARDED. El Motor a536edd4… validó localmente pero recibió VALIDATION_FAILED del adaptador: el protocolo real de validar_archivos_opmx produce request_id:null (su esquema no permite ese parámetro). Comprobar MASTER lo interpretaba como un ID externo discordante. La reproducción con protocolo real lo confirma; no era otro pedido de cambiar el contenido.

Corrección sólo para operation=validar_archivos_opmx y null exacto: omitir esa comparación local inexistente, conservando REQUEST_ID del MASTER y prueba real de Guard. Crear/publicar sin clave, con null o clave distinta siguen rechazados.

MCP activo6d60d83d-a99a-4f06-a201-70b5d292b9da,137nodos, único cambio jsCode Comprobar MASTER. Grafo4e1a884c2546efcca8d99f52cf1b531ad1dfb50fe65a54a2cc43c9e3b0cdfec7. Draft ajeno restaurado como31466116-ce37-49c7-8ca1-380e0e45e49d,112nodos; activo releído idéntico al preparado.

Guard del corte rev19: opmx-guard-literal19-validation-scope.zip, SHA256cef58abf6b311393c0f22690117947cba3d3edba71834eada4b65c1cd93eb128, completado/Actual12nov16:52:48CDMX. Única diferencia del runtime: nuevo pin MCP en writer-release-manifest.mjs. Fuente7177c927c24ad9f03f1d93e5add6db4b277c4bb9. Motor, suscripción, receptor y demás escritores no cambian.

470 pruebas pasan; n8n37734 con43assertions prueba protocolo real→parser→body Guard7campos→proof simulado y negativos de escritura. Runtime37740 observado/versionsMatch/idle con etiqueta sintética sólo de diagnóstico; no autoriza recuperación ni acredita una nota. La primera lectura final WEG37735 no confirmó CMS. Tras aislar runtime,37743 confirmó los pins/huellas/idle, recibo y CMS de tres destinos; las dos lecturas se conservan en [evidencia](issue19-literal-20261112/EVIDENCIA_REV19.json), sin inferir ausencia ni reintentar publicaciones.

DEV no reabrió/reintentó ni publicó rev19. Issue19 sigue abierto hasta aceptación real del operador. No repetir el descarte: ya está aplicado. [Informe y reversión](issue19-literal-20261112/RECURRENCIA_REV19.md).


## Estado posterior — publicación literal23 y alertas persistentes

Tecámac/tg_dd8ff15fbc93b83b3e579c4266d5aea4bcf2be7b rev23 quedó publicada en OPURO10528/OPOL3537/LIBERAL408. Monitor37870 ya tenía FINAL_PUBLICATION_CONFIRMED con recibo PUBLISH/TODOS, pero sólo suprimió el aviso en memoria;37876 volvió a alertar al fallar otra lectura. Causa30: falta de persistencia, no una nueva falta de contenido.

Se reconstruyó PUBLICATION_RECONCILED1752 desde la prueba auténtica histórica37870 (observedAt23:06:55.860UTC, requesttg_ada79f9b78fbf8ad073b6ced861a2d8c0dbdca7cd517b7185b99cd7eb9de3917). No hubo publicación/edición CMS ni falso acuse del Motor. Bloqueo1750 y alerta1751 permanecen en historia.

Monitor actual efa564a8-3f87-4936-ba1a-2b1a33a0879f,16nodos: persiste confirmación antes de darla por conciliada, mantiene el éxito de la misma solicitud/revisión ante fallos posteriores y sigue conciliando alertas ya enviadas sin reenviarlas. Siete bindings canónicos y request legacy null soportados; otra solicitud/revisión o dos terminales distintos no se silencian. Misma tabla/administrador/frecuencia.

MCP actual c0de03ed-e7a7-4255-a9c8-9ca76404424e,137nodos: sólo incertidumbres cambian encabezado a «resultado pendiente de confirmación». Guard vigente opmx-guard-publication-status23.zip SHA256028b71d5c5c35060e8fd92f80b0736d0a7d4b5c4b8ba8ca02acf1853de1d518c, completado/Actual12nov17:24:57CDMX; único delta runtime es pin MCP. Draft ajeno a51f2379…112nodos conservado. Motor/suscripción y demás escritores sin cambios.

542pruebas; n8n37893 QA17 sin escrituras/envíos;37894 ejecuta selector preparado con15filas reales y7bindings y produce0avisos. Probe original restaurado/inactivo/sin retención. Fuentes bf85fd32fb2c08af513343397038c298671dec68 y a38d80782045fdfc0c24006c125b15f2b6d340f5. [Informe y reversión](issue30-publication-alert-20261112/RECURRENCIA_TECAMAC23.md) · [Evidencia](issue30-publication-alert-20261112/EVIDENCIA_TECAMAC23.json).

El19 tiene aceptación operativa real por este envío literal. El30 queda corregido con memoria durable y estados coherentes. El error de respuesta de Publisher permanece en24; nunca usar incertidumbre para repetir un envío. Este estado posterior prevalece sobre los cortes históricos anteriores.

## Seguimiento de issues importantes

La prioridad es propuesta en este corte, no una etiqueta ya existente del repositorio.

| Prioridad propuesta | Issue | Pendiente real | Qué ya se resolvió |
| --- | --- | --- | --- |
| Corregido | [30](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/30) | El error/demora de respuesta de herramienta sigue separado en24. | Persistencia de PUBLICATION_RECONCILED tras prueba Guard y acuse INSERT, caso real Tecámac23 conciliado1752 y encabezado de incertidumbre corregido.542pruebas +QA17 +replay15filas. |
| Conciliación resuelta; publicación pendiente | [26](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/26) | La conciliación del intento Waldo8 quedó confirmada; esto no ejecutó la publicación ni habilita reintentar. | Ejecución34438: UNWRITTEN_ATTEMPT_FROZEN, intentoREVOKED, barreraRECONCILING, tres destinosBLOCKED. PaqueteREADY8 y cinco SHA conservados. |
| Diferida — después de Waldo | [28](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/28) | Revisar la cancelación de paquetes duplicados cuando el usuario retome esta parte; releer revisiones y órdenes vigentes. | La orden antigua de cancelar Milenio rev8 fue sustituida por recuperación; READY19 quedó ATTEMPT_BLOCKED, no CANCELLED. No se ejecutó ninguna cancelación al dividir los issues. |
| Alta | [18](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/18) | Aceptación completa de recuperación, creación nueva multidestino, parciales/respuesta perdida, cuotas/retención y demás criterios del issue. | Reapertura/vista/confirmación, ensayo UPDATE OPURO y recuperación pre-ACK documentados; no equivalen a cerrar todo el issue. |
| Corregido; aceptación real | [19](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/19) | El cierre/conciliación del intento histórico no se falsifica; transporte incierto sigue en24. | Entrega LITERAL rev23 con preflight/ACK/recibo PUBLISH y OPURO10528/OPOL3537/LIBERAL408 confirmados. |
| Alta | [21](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/21) | Clasificación general de rechazos deterministas previos a escritura: no presentarlos indebidamente como UNCERTAIN. | Comprobación previa de etiquetas/extracto desplegada; casos editoriales documentados recuperados. |
| Alta | [15](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/15) | Diagnóstico PDF/descarga/binario/tamaño/firma y conciliación de la reserva original. | Publicación manual entregada; no demuestra corrección del receptor ni habilita reenviar. |
| Media alta | [24](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/24) | Determinar por qué ciertas ejecuciones se interrumpieron antes de Publisher. | Los cuatro paquetes y pendientes adicionales descritos fueron recuperados; la causa raíz no está acreditada. |
| Media alta | [25](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/25) | Resolver enlaces compartidos/redirecciones antes de declarar SOURCE_UNAVAILABLE; verificar contenido de la URL final. | J.D.Power2026 recuperado/publicado; el resolutor general no se implementó en esa recuperación. |
| Revisión de cierre y diagnóstico | [22](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/22) | Conciliar el incidente /nuevo y demostrar diagnóstico de apertura; no asumir causa a partir del mensaje genérico. | Hay cambios y paquetes posteriores funcionando, pero el issue no contiene cierre técnico suficiente. No se afirma que exista hoy una caída general. |
| Seguimiento transversal | [17](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/17), [12](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/12) | Conciliación por destino, estados de seguimiento atrasados y backlog; evitar duplicar trabajo con los issues específicos. | Varias entregas históricas ya están publicadas; una etiqueta vieja de error no demuestra una nota ausente. |

También siguen abiertos13 (exclusiones de portada por categoría) y11 (score Rank Math). Son integraciones de Publisher/SEO, de menor prioridad para desbloquear Telegram; no se incluyen como fallos actuales del receptor.

## Próximo trabajo recomendado

La conciliación prioritaria del26 ya tiene resultado durable: el intento previo está revocado y sin permiso de escritura. La publicación de Waldo no se ejecutó y requiere el siguiente flujo autorizado de recuperación; no repetir iniciar_intento para la revisión8. La cancelación separada en28 permanece para más adelante. La implementación19 (literal) quedó desplegada. Continuar18 y21/15 para reducir falsos bloqueos y mejorar diagnóstico;24/25 para interrupciones y enlaces. Antes de tocar un paquete histórico, releer su estado y orden vigente. El cierre de26 como conciliación no acredita publicación ni cancelación.




