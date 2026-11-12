# Estado compartido — Telegram, Publisher y Motor Editorial

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
| OPMX — Telegram recepción · publicación predeterminada v1 | `OSi8AcnzLlI0csRu` | Activo | `0bfda1b6-a4de-48fd-9f63-d4c9d8a76127` |
| OPMX — Publisher archivos MCP | `bnzVMNkZuGO1GQCZ` | Activo | `76ef3bfe-db0a-4fb4-996c-ad703ab1639a` |
| OPMX Publisher — formulario · destinos v3 | `Mt7ts2EGPbyaTC2o` | Activo | `bf4cc77c-6853-4303-a25b-2f58dc057d8e` |
| OPMX — Entrada automática · borradores v3 | `4o7K5TmKc7joScqB` | Activo | `c7610e14-994b-45bd-8748-bdef90e0fc78` |
| OPMX — transporte actualización confirmada #18 | `qBmLf0DmcMSfuWvm` | Activo | `d04fb5c2-ba36-48f9-9cd4-2958ab1f273e` |
| OPMX — observación técnica runtime #18 | `2HBn1RnSYgyxuHgE` | Activo | `b88257e9-7f6d-41e3-bdfd-e2cd40c12c25` |
| OPMX — conciliación CMS lectura #18 | `F4Ybwst2LZfzKyWS` | Activo | `0bb87412-b517-4d6e-8a1c-426acb6151ef` |
| OPMX — Alertas de administrador | `NFOBzPfHmvRjVFOA` | Activo | `2d3e18a9-ff68-4f5c-9fdc-ce6a694b1cd6` |
| OPMX — comprobación API lectura #18 | `7IDUF9PeHQ5v331Z` | Inactivo | Sin versión publicada |

Esta lectura confirma las versiones, no inicia flujos ni prueba por sí sola WordPress. La observación de ejecución34236, realizada durante el despliegue de autor3, confirmó los cinco grafos de escritura con RUNTIME_OBSERVED/versionsMatch=true/noActiveN8nWriters=true.

## Cambios aplicados por este chat y fuentes versionadas

### Recuperación / vista previa, issue18

- Receptor existente: reapertura/selección/vista/confirmación y diagnóstico administrativo; controles de cupo y reservas preservados. El caso ALREADY_OPEN deja de añadir al administrador como propietario nuevo.
- MCP: resuelve al propietario original desde el ledger y conserva la decisión confirmada; no transfiere propiedad del paquete al administrador.
- Guard: snapshots, barreras por revisión y destino, intento exclusivo, reconocimiento de decisión antes de escritura, recibos durables y comprobación de escritores.
- Transporte UPDATE: consume una capacidad de trabajo acotada y actualiza los IDs confirmados, sin aceptar una URL o ID de reemplazo arbitrarios.
- Motor: se amplió el prompt de la automatización existente para PREVIEW, UPDATE y CREATE EDITORIAL confirmados, manteniendo READY y el protocolo vigente. Pin de chooseMotorPolicy bc9138f1dc60f838559d385ec4fc20f511089210. No se creó otra automatización ni se cambió la suscripción a una distinta. El prompt aplicado está versionado en la referencia inferior; no se volvió a leer la configuración de la automatización durante este corte.
- Recuperación de interrupción: sólo un administrador configurado puede invalidar la capacidad anterior del mismo intento RUNNING mientras la barrera sigue AWAITING_DECISION y la revisión/evento/huella coinciden. No habilita reintentar una escritura incierta.
- QA anterior: borrador OPURO10428, actualización literal de extracto, readback y cierre durable comprobados. No se extrapola a publicaciones públicas en tres destinos.
- Caso real de Milenio: llegó a READY19 con CREATE/EDITORIAL/TODOS confirmado; fuentes y archivos validados. Antes de escribir se encontraron las publicaciones ya existentes OPURO10438/OPOL3477/LIBERAL307. El intento quedó ATTEMPT_BLOCKED; no CANCELLED ni ATTEMPT_COMPLETED, y no se atribuyen esas notas existentes a esta revisión.
- 470 casos locales en la última batería de recuperación. CREATE LITERAL sigue bloqueado. Faltan criterios de aceptación del issue18; no está cerrado.

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
- Guard actual: opmx-guard-final-publication-observer.zip, SHA256 ecd2f908e6e19616097ebcf5aee891aa64e36b3305675ffab4c32146bb55fdc0. Su endpoint observe-final es sólo lectura. Conserva recuperación, autor3, pins de escritores y único Motor/suscripción anteriores. Es posterior al ZIP Waldo de la ficha histórica.
-130 pruebas pasan. Ensayo aislado n8n37011 con Guard real: qaSuppressed=true, PUBLISH/TODOS y los tres IDs originales; sin envío Telegram ni escrituras de tabla/CMS. Primera ejecución programada37017:SUCCESS, sin candidatos ni notificación.
- Diagnóstico temporal restaurado a su GET original, inactivo y sin retención. Su límite de30s permanece sólo en ese probe inactivo; no cambia tiempos del Motor. No se ampliaron accesos ni credenciales.
- Esta corrección resuelve la alerta obsoleta. No elimina por sí sola la causa de esperas largas de herramientas (#24), ni cierra los pendientes generales del #18. #28 continúa diferido.

[Informe, acuses y reversión](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/blob/3a00789fed4b74433449b50d4b81dff60d445ce6/docs/operations/issue30-publication-alert-20261112/VERIFICACION.md). Código fuente y pruebas: fdbe48cf8679840d6fcc2f1d8930b96a1323137e y6a57020777fd3c5a8482e043a7e260ecf0e38c31.

## Seguimiento de issues importantes

La prioridad es propuesta en este corte, no una etiqueta ya existente del repositorio.

| Prioridad propuesta | Issue | Pendiente real | Qué ya se resolvió |
| --- | --- | --- | --- |
| Corregido | [30](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/30) | La causa general de esperas de herramientas sigue en24. | Alerta WEG conciliada y monitor con comprobación final de Guard/CMS desplegado;130 pruebas y ensayo real37011. |
| Conciliación resuelta; publicación pendiente | [26](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/26) | La conciliación del intento Waldo8 quedó confirmada; esto no ejecutó la publicación ni habilita reintentar. | Ejecución34438: UNWRITTEN_ATTEMPT_FROZEN, intentoREVOKED, barreraRECONCILING, tres destinosBLOCKED. PaqueteREADY8 y cinco SHA conservados. |
| Diferida — después de Waldo | [28](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/28) | Revisar la cancelación de paquetes duplicados cuando el usuario retome esta parte; releer revisiones y órdenes vigentes. | La orden antigua de cancelar Milenio rev8 fue sustituida por recuperación; READY19 quedó ATTEMPT_BLOCKED, no CANCELLED. No se ejecutó ninguna cancelación al dividir los issues. |
| Alta | [18](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/18) | Aceptación completa de recuperación, creación nueva multidestino, parciales/respuesta perdida, cuotas/retención y demás criterios del issue. | Reapertura/vista/confirmación, ensayo UPDATE OPURO y recuperación pre-ACK documentados; no equivalen a cerrar todo el issue. |
| Alta | [19](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/19) | Modo literal autorizado automático, títulos largos, múltiples subtítulos y normalización de blancos sin alterar textos. | Frank Aguirre y Ealy recuperados manualmente. CREATE LITERAL aún no se habilita. |
| Alta | [21](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/21) | Clasificación general de rechazos deterministas previos a escritura: no presentarlos indebidamente como UNCERTAIN. | Comprobación previa de etiquetas/extracto desplegada; casos editoriales documentados recuperados. |
| Alta | [15](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/15) | Diagnóstico PDF/descarga/binario/tamaño/firma y conciliación de la reserva original. | Publicación manual entregada; no demuestra corrección del receptor ni habilita reenviar. |
| Media alta | [24](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/24) | Determinar por qué ciertas ejecuciones se interrumpieron antes de Publisher. | Los cuatro paquetes y pendientes adicionales descritos fueron recuperados; la causa raíz no está acreditada. |
| Media alta | [25](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/25) | Resolver enlaces compartidos/redirecciones antes de declarar SOURCE_UNAVAILABLE; verificar contenido de la URL final. | J.D.Power2026 recuperado/publicado; el resolutor general no se implementó en esa recuperación. |
| Revisión de cierre y diagnóstico | [22](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/22) | Conciliar el incidente /nuevo y demostrar diagnóstico de apertura; no asumir causa a partir del mensaje genérico. | Hay cambios y paquetes posteriores funcionando, pero el issue no contiene cierre técnico suficiente. No se afirma que exista hoy una caída general. |
| Seguimiento transversal | [17](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/17), [12](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/12) | Conciliación por destino, estados de seguimiento atrasados y backlog; evitar duplicar trabajo con los issues específicos. | Varias entregas históricas ya están publicadas; una etiqueta vieja de error no demuestra una nota ausente. |

También siguen abiertos13 (exclusiones de portada por categoría) y11 (score Rank Math). Son integraciones de Publisher/SEO, de menor prioridad para desbloquear Telegram; no se incluyen como fallos actuales del receptor.

## Próximo trabajo recomendado

La conciliación prioritaria del26 ya tiene resultado durable: el intento previo está revocado y sin permiso de escritura. La publicación de Waldo no se ejecutó y requiere el siguiente flujo autorizado de recuperación; no repetir iniciar_intento para la revisión8. La cancelación separada en28 permanece para más adelante. Continuar19 (literal), coordinado con18, y21/15 para reducir falsos bloqueos y mejorar diagnóstico;24/25 para interrupciones y enlaces. Antes de tocar un paquete histórico, releer su estado y orden vigente. El cierre de26 como conciliación no acredita publicación ni cancelación.

