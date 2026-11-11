# Issue26 — conciliación del intento de Waldo

## Alcance

El usuario ordenó dividir26: Waldo primero; cancelaciones diferidas a28. No se publica ni se cancela ningún paquete en esta intervención. La nota de Waldo sigue pendiente de publicación hasta completar recuperación y controles vigentes.

Identidad preservada: paquete `tg_ae41ddbd480407eb263090c3ac41c2fa9dbe9c8f`, revisión8 READY, request_id TODOS `tg_65fb7d5cb95fea298719c8d70290586e3c2afda9eb92e8e3ca0e1a2339cf93cf`. Cinco materiales STORED, incluyendo JPEG211027bytes; no se requiere reenviarlos.

## Evidencia previa de lectura

- Ejecución34417: Guard `/v1/telegram/reconciliation/observe` confirmó `RECONCILIATION_VERIFIED`, tres resultados BLOCKED y `writesRolledBack:true`. Fue diagnóstico con ROLLBACK; no cerraba durablemente el intento.
- Consultas autenticadas GET a WordPress, search=Waldo, status=any, context=edit,100 por página. Ejecuciones34421/34422/34423: OPURO9, OPOL2, LIBERAL0, paginación completa en la primera página. Ninguna fue la nota de la comisión T-MEC. Una búsqueda negativa es evidencia complementaria; la decisión se basa en los controles y ledgers exactos, no sólo en texto o tiempo transcurrido.
- No se volvió a reclamar el intento mediante iniciar_intento; no se inventaron recibo Telegram, revisión, token, permiso de publicación ni request_id.

## Corrección

Nuevo POST administrativo `/v1/telegram/reconciliation/freeze-unwritten`, protegido por la autenticación Guard y el administrador privado configurado. Admite únicamente owner,chat,packageId,revision; owner=chat. No recibe afirmaciones de ausencia de efectos ni manifiestos del cliente.

En una transacción mantiene el orden de bloqueos quota/package/attempt/fence; comprueba revisión READY, evento, siete request bindings/classes, controles originales íntegros, versiones y huellas de los escritores activos, paginación de ejecuciones sin escritores pendientes y cero efectos en targets/media/publication_claims/update_claims/update_deliveries/writer_receipts. Reutiliza los proveedores reales de conciliación/captura. No usa antigüedad como prueba de seguridad.

Sólo con toda esa evidencia revoca el token del intento, mantiene la revisión original con fence RECONCILING e inserta RECONCILE_UNWRITTEN en la auditoría. No deja SAFE_TO_REOPEN al COMMIT. No crea sesión, snapshot, evento, revisión ni solicitud de escritura. Replay exige coincidencia de auditoría y una comprobación real nueva; resultado incierto de COMMIT exige inspección, no reintento.

Código y pruebas: [commit e141022](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/commit/e1410223770592c0dcb9fc9ae3fd5f956db98481). Manifiesto y SHA256 en release.json.

## Validación

523 pruebas locales pasan, incluidas52 del freeze con proveedores reales y1 HTTP. Cubren autenticación, esquema estricto, grafos/versiones alteradas, escritor activo, controles/huellas corruptos, bindings incompletos, efectos parciales/medios/jobs/recibos huérfanos, rollback, replay y COMMIT incierto. El runtime ensamblado inicia; falla cerrado ante inicialización MySQL fallida y ante estado ausente. El ZIP deriva del release liberal-author3 y sólo cambia tres módulos de wiring más el nuevo módulo; conserva todos los pins de escritores y autor3.

## Resultado de producción

Guard desplegado: `opmx-guard-waldo-reconciliation.zip`, SHA256 `f995fe7aa1f0de60d2f3f44abeec0c089e90023e63720f9e3fea99a48fcccbe3`. Hostinger mostró Se ha completado / Actual para el despliegue del11nov2026 14:44:44, hora del panel. Conserva la compatibilidad de autor3 y todos los escritores anteriores.

Única conciliación durable, ejecución34438, finalizada20:46:57Z: HTTP200 `UNWRITTEN_ATTEMPT_FROZEN`, revision8, attemptState=REVOKED, fenceState=RECONCILING, OPURO/OPOL/LIBERAL BLOCKED; writeAuthorized=false, reopenAuthorized=false, retryPermitted=false, processTerminationClaimed=false. El COMMIT y la auditoría se confirmaron antes de devolver ese estado. No se repitió la mutación para comprobar replay.

La relectura del paquete confirmó READY8, cinco elementos STORED y las mismas cinco huellas SHA256. La ejecución34444 posterior volvió a comprobar el gate real: HTTP200 RECONCILIATION_VERIFIED, tres BLOCKED, writesRolledBack=true. Esta segunda comprobación fue de lectura con ROLLBACK y no alteró la revocación durable.

El diagnóstico temporal7IDUF9PeHQ5v331Z se restauró desde su versión original a9a7345a-1c67-4742-88db-652449ee6a76. Quedó en b14c3e30-2454-4182-970d-7f35c42a1c63, inactivo, tres nodos, GET original de metadatos n8n y sólo su credencial n8nApi. Retención manual/success/error desactivada explícitamente y comprobada. Los requests temporales a Guard/CMS ya no forman parte del grafo actual.

Acuses, inventario y limpieza sin secretos en [evidence.json](evidence.json). Resultado: conciliación del intento exacto completada; publicación de la nota pendiente. El estado BLOCKED de los destinos describe la ausencia de una entrega en este intento, no una publicación fallida ejecutada ahora ni una cancelación.

## Continuación permitida

La revisión conciliada conserva su barrera y no debe volver a reclamarse ni reenviarse a Publisher. La reapertura ordinaria con un `/abrir` real, recibido de Telegram y su recibo auténtico, puede conciliar de nuevo y crear la siguiente revisión. No fabricar ese recibo desde otro chat. Después completar vista/confirmación y ejecución del único Motor con la política vigente; una publicación futura no forma parte del resultado de esta conciliación.

No se cambió la suscripción del Motor ni se creó otro consumidor. Los workflows de escritura no se modificaron. Las cancelaciones siguen diferidas en28. La nueva ruta es de mantenimiento administrativo; no sustituye la recuperación general ni cierra el issue18.

## Reversión

El ZIP liberal-author3 anterior conserva la compatibilidad de los mismos escritores y puede servir para revertir únicamente el código de la ruta administrativa. La revocación/auditoría durable ya confirmada permanece en MySQL. No resetear ni eliminar barreras, intentos o auditorías para revertir; cualquier recuperación posterior debe usar el gate ordinario y un recibo Telegram auténtico.
