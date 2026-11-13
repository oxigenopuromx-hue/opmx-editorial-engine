# Arranque dirigido de Servidores IA — 2026-11-13

**Estado: `RECOVERED_READING_SOURCES`.** El mismo Motor confirmó la recuperación del intento existente y está verificando las fuentes y la imagen antes de reconocer la decisión. Una lectura privada posterior corroboró la actualización del intento a las `17:30:21.521372Z`; el fence seguía `AWAITING_DECISION` a las `17:31:19.800832Z`. No hay publicación confirmada todavía. El adaptador y el pin Guard están desplegados y la herramienta está expuesta en el catálogo nativo. La primera orden de arranque había terminado con `ATTEMPT_ALREADY_CLAIMED`, `retryPermitted: false`. El chat de mantenimiento no reclamó un intento ni obtuvo una capacidad de escritura.

## Alcance exacto

| Campo | Valor confirmado |
| --- | --- |
| Paquete | `tg_efdabf64148316df03e230122001e7311843a4ab` |
| Estado / revisión | `READY` / `12` |
| Decisión confirmada | `CREATE` / `EDITORIAL` / `OPURO` |
| Preview | `c9e8d104ad0a913dad217a07f1f6c38ae9ee11fa1a82e62e25df8d5007c5ff3b` |
| Request canónico | `tg_f88d93dd0e24308affc30991c0f8e34d97a1ce9697ef802d2084bc0798879ddb` |
| Motor existente | `6ae9095256948191b33f1e023fbfbf8b` — Motor — recepción Telegram |
| Conversación original | `6ae90921-bd24-83e8-bca3-dfce7501d350` |

## Evidencia y diagnóstico

- El seguimiento de la revisión 12 registraba `QUEUED` desde `2026-11-13T16:44:23Z`, sin `PROGRESS_START` ni recibo de Publisher al realizar la revisión. Los siete elementos seguían guardados. La ausencia de esos acuses no demuestra por sí sola que nunca haya existido un efecto en el CMS.
- El último resultado visible del mismo Motor era el éxito de Morena de las 10:49 CDMX: paquete `tg_c11966b7bf1994c072c1e54999dfbd3579f619fb`, revisión 11, OPURO 10565, OPOL 3573 y LIBERAL 421. Ese paquete no formó parte de la recuperación.
- Se consideró la posible coincidencia o coalescencia de eventos tras confirmar otro paquete unos 30 segundos después. **La causa no quedó probada** con la información disponible.
- El runtime actual de eventos sólo expone `subscribe`, `unsubscribe`, `status` y `emit`. `emit` conserva una entrega ya `SENT` mediante `INSERT IGNORE`; por ello su respuesta de encolado no acredita una reentrega ni un nuevo arranque.

## Ruta intentada y recuperación utilizada

1. Se intentó `automations.run_now` sobre el Motor existente. Devolvió el rechazo explícito: `Run now is available only for ordinary cloud-scheduled tasks.` No se creó una ejecución por esa llamada; el Motor de eventos webhook no admite esa operación.
2. Antes de la activación posterior se restauró y verificó exactamente el prompt original: **60 558 caracteres**, 61 319 bytes UTF-8, SHA-256 `3215baec271d589c859fbe11e29e41fd378db15235e78b88eb06e6ed4c7eea83`. La copia de referencia es `ISSUE31_MOTOR_AFTER.txt`. Las suscripciones existentes a `opmx.package.ready` y `opmx.package.preview` permanecieron intactas.
3. Se abrió la conversación original del Motor en ChatGPT; la página cargó en su contexto de proyecto y mostró un compositor utilizable. Se envió **una sola orden manual dirigida**, en esa misma conversación, limitada al paquete y revisión de la tabla. La orden pide verificar el estado y la decisión reales, reclamar el intento una sola vez con el protocolo vigente, conservar revisión y request canónico, y detenerse ante estado distinto, intento reclamado o resultado incierto. No se presentó la orden como un evento recibido.
4. Tras el único envío, la interfaz mostró `Stop`, señal de actividad de la conversación. El resultado final fue `ATTEMPT_ALREADY_CLAIMED` y `retryPermitted: false`, sin nuevo avance de inicio. No se repitió el envío. La pestaña de inspección duplicada quedó cerrada.

No se creó otro Motor, no se modificaron suscripciones, no se reinició ni alteró el estado en la base de datos y no se ejecutó una publicación manual en el CMS. No se guardaron capacidades ni tokens de intento en este registro.

## Observación privada posterior

- La consulta administrativa Guard `/v1/telegram/reconciliation/observe` terminó en la ejecución n8n `39451`, HTTP 200, `RECONCILIATION_REQUIRED`. Esa respuesta no desglosa el estado. El probe quedó restaurado exactamente en nodos, conexiones y ajustes, inactivo, versión `1be26a0b`.
- Se accedió por la sesión existente de Hostinger a phpMyAdmin y se ejecutó únicamente un `SELECT` limitado al paquete y revisión 12, proyectando estado del paquete, intento, fence y entrega; se excluyeron `token_hash`, secretos y capacidades. Una lectura posterior para mostrar el identificador completo devolvió el mismo estado.

| Registro | Evidencia persistida |
| --- | --- |
| Paquete | `READY`, revisión `12` |
| Intento | `RUNNING`; `updated_at = 2026-11-13 16:45:14.424618` |
| Evento vinculado | `evt_370af274f74d9d59687a056bb94d4807e6106ff868ca151d` |
| Fence | `AWAITING_DECISION`; `updated_at = 2026-11-13 16:44:22.839706` |
| Entrega de evento | `SENT`, 1 intento, HTTP `200`; `next_attempt_at = 2026-11-13 16:44:24.683000` |

Las marcas se guardan mediante `UTC_TIMESTAMP` en el runtime. La evidencia acredita que hubo un claim anterior y que la decisión todavía no se había reconocido: el permiso de escritura seguía cerrado en `AWAITING_DECISION`. El estado `RUNNING` de la tabla no demuestra que el proceso del Motor continúe vivo. La respuesta HTTP 200 de entrega sólo acredita la recepción del callback.

## Adaptador administrativo desplegado; intento recuperado

Se preparó la herramienta nativa `recuperar_intento_sin_decision_telegram_opmx` para que la capacidad llegue directamente al mismo Motor por MCP. Recibe únicamente `package_id`, `revision`, `event_id` y `preview_hash`; no acepta actor, token, destino ni texto libre. La identidad administrativa se toma del suscriptor existente de la conexión, separada del dueño original del paquete. El Guard vuelve a validar su lista de administradores y los registros reales bajo locks. El resultado sólo expone la capacidad si el evento devuelto coincide exactamente con el solicitado, el token tiene formato válido y `retryPermitted` es `false`. Un rechazo o respuesta incierta no habilita reintento ni escritura.

| Preparación | Evidencia |
| --- | --- |
| Workflow MCP | `bnzVMNkZuGO1GQCZ`, activo base `29702889-430d-4a87-952a-a9ef6c5b6ece` |
| Versión MCP activa verificada | `cf4f65ab-35b6-4120-a36d-ddce2e94b91c` |
| Grafo candidato | 155 nodos; huella `0d35aa9e3a9571e63aa168c58ca111c76979f331056e7bdeeb7d59a96b79b65c` |
| Cambios | Sólo parámetros de `Resolver identidad de solicitud`, `Protocolo MCP archivos`, `Gestionar intento Motor guard` y `Resultado intento Motor MCP`; cero nodos o conexiones nuevas |
| Borrador anterior | 112 nodos conservados y restaurados exactamente; nuevo ID de borrador comunicado `ff9fa311…` |
| Retención MCP | `saveManualExecutions: false`, `saveDataErrorExecution: none`, `saveDataSuccessExecution: none` |
| Guard desplegado | `opmx-guard-unacknowledged-mcp-recovery.zip`, 89 archivos, 221 370 bytes, SHA-256 `764f4c7b4b9823a8da3319321c605756cf45b74c92bb2728dc44a0fe491eea62`; Hostinger confirmó completado y archivo Actual a las 11:25:53 CDMX (`2026-11-13T17:25:53Z`) |
| Diferencia del ZIP | Sólo `writer-release-manifest.mjs`; nuevo pin MCP candidato, otros cuatro pins conservados |
| Comprobaciones de arranque observadas | Una respuesta HTTP 401 y doce HTTP 503 (4 + 8); no acreditan disponibilidad ni despliegue correcto |

Hostinger confirmó el despliegue completado con el ZIP esperado como archivo Actual. La versión MCP publicada coincide exactamente con el grafo candidato de 155 nodos; el borrador anterior de 112 nodos quedó preservado. El pin Guard coincide con esa versión y huella; los otros cuatro pins se conservan.

Se pulsó `Refresh tools` una vez en la configuración de Archivos y se observó el fin del indicador de carga. Después, una inspección independiente de sólo lectura en `View details` → app `OPMX Publisher — Archivos` mostró **Write13 / Read4**, la acción `recuperar_intento_sin_decision_telegram_opmx` con su descripción administrativa exacta y ambos eventos READY/preview. La exposición en el catálogo nativo quedó comprobada. Esa inspección no invocó la herramienta ni repitió el refresco.

La observación de runtime `39491` respondió HTTP 200 a las `2026-11-13T17:28:57.636Z`, con `versionsMatch: true` y `noActiveN8nWriters: true`. Acreditó los cinco pins esperados: MCP `cf4f65ab-35b6-4120-a36d-ddce2e94b91c` y las cuatro versiones conservadas `5e0e1875-2996-4b8c-99aa-e4d07f7d8822`, `bef4649d-38eb-436a-9a13-728750da6b8f`, `d04fb5c2-ba36-48f9-9cd4-2958ab1f273e` y `1eca0334-b3af-45d9-ac80-341e99a09faa`. El observador mantiene `motorTerminationVerified: false`; no prueba que el proceso del Motor haya terminado ni autoriza recuperación por sí solo. El probe se restauró exactamente en nodos, conexiones y ajustes de no retención, inactivo, versión `1b700df7-5008-4772-acb1-16d07be5fe56`.

Después se envió **una sola orden de recuperación** a la conversación original del Motor para que use exclusivamente la herramienta nueva con el paquete, revisión, evento y preview documentados. La interfaz del Motor confirmó que el Guard recuperó el intento existente y mostró la lectura de los bytes originales del paquete. El Motor indicó que verificaba fuentes e imagen antes de reconocer la decisión. No se transfirió ninguna capacidad por mensajes ni archivos, no se repitió `start` y no se ejecutó recuperación desde mantenimiento.

Una única consulta `SELECT`, sin `token_hash`, observada a las `2026-11-13T17:31:19.800832Z`, devolvió `READY`/12, intento `RUNNING` actualizado a las `2026-11-13T17:30:21.521372Z` y fence `AWAITING_DECISION` con su marca anterior `2026-11-13T16:44:22.839706Z`. El cambio de marca respecto de las `16:45:14.424618Z` corrobora una mutación reciente del intento; la confirmación de recuperación procede del acuse del Motor. `RUNNING` por sí solo no prueba actividad ni éxito. La decisión todavía no se había reconocido en esa observación y Publisher seguía sin resultado confirmado.

La validación local pasó 19 pruebas dirigidas del protocolo, grafo y gate del Guard. Además, se ejecutó en aislamiento el wrapper candidato construido desde el activo real: catálogo con la herramienta nueva, recuperación por su ruta exacta, formateador de capacidad privado, inicio normal conservado y eventos READY/preview conservados. Las pruebas no invocaron recuperación, Publisher ni CMS.

Fuentes nuevas: `tools/telegram/guard-recovery-candidate/motor-unacknowledged-recovery-protocol.mjs`, su `.test.mjs`, `unacknowledged-recovery-mcp-graph.test.mjs` y `receiver/build-unacknowledged-recovery-mcp-operations.mjs`. El constructor guarda por separado el borrador previo y rechaza deriva de versión/grafo, retención de ejecuciones habilitada y cambios inesperados en el nodo de llamada. Las operaciones y snapshots privados de preparación no contienen capacidades y no forman parte de la documentación pública.

El registro estructurado del despliegue es `docs/operations/unacknowledged-attempt-recovery-20261113/release.json`. El despliegue técnico está confirmado; el resultado editorial permanece pendiente.

## Conciliación pendiente del intento existente

- El estado privado ya se observó: intento `RUNNING`, fence `AWAITING_DECISION` y evento real vinculado, según la tabla anterior. No se extrajeron `token_hash` ni capacidades. El rechazo `ATTEMPT_ALREADY_CLAIMED` por sí solo no habría distinguido ese estado de `BLOCKED`, `COMPLETED` o `REVOKED`.
- El artefacto actual cablea `/v1/telegram/attempts/recover-unacknowledged`. Es una **mutación administrativa**, no una lectura: únicamente admite un intento `RUNNING` con fence `AWAITING_DECISION`, evento real y preview confirmado. Revoca atómicamente la capacidad anterior y devuelve otra privada. El mismo Motor confirmó su ejecución mediante la herramienta nativa nueva; mantenimiento no la ejecutó. Un fence distinto exige conciliación; no se convierte en un reset ni permite repetir `start`.
- Las rutas administrativas existentes de observación y conciliación no exponen un diagnóstico completo del registro de intentos. La lectura de phpMyAdmin cubrió esa carencia para este incidente. Cualquier recuperación debe revalidar el estado bajo locks y conservar la misma revisión y solicitud.
- Registrar cualquier resultado real de Publisher con el request canónico y su entrega en Telegram. No hay éxito de publicación confirmado para esta recuperación.
- Añadir hora y evidencia del cierre. Ante una respuesta incierta, observar y conciliar el mismo intento antes de otra activación.
