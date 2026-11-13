# Issue29 — conciliación y cancelación dirigida

Implementación de mantenimiento13nov2026; el estado productivo y acuses se documentan en la entrega final. No activa cancelación general28.

La cancelación pendiente de Simey se limita a paquete tg_00991fbbd87a751fb8513f4d4f6fcebca8469bee/rev10, request TODOS tg_e6400942bcd85878aaa03f722f03b7644261071d6339593c2dede692f582edbf, LIBERAL393. No modifica CMS: acepta393draft o TRASH con slug exacto, conserva OPURO10493/OPOL3515 publicados. Un registro inmutable con evidencia/hash y auditoría revoca la capacidad anterior y conserva fenceRECONCILING; no es un recibo PUBLISH. Guard comprueba esa cancelación en selecciones, preview, CREATE, medios y UPDATE de cualquier revisión futura.

POST /v1/telegram/destination-cancellations/cancel exige owner/chat/paquete/revisión/request/destino/post/operationId exactos y administrador. La operación estable es requested-20261113-issue29-simey-liberal. Ante COMMIT incierto no se repite: observe lee registro/CMS/fence/runtime. Para el monitor, observe admite sólo packageId/revision y el servidor deriva el alcance fijo; no acepta afirmaciones CMS del cliente.

freeze-unwritten admite históricos con0o1intentos, pero exige evento único, siete bindings/clases, controles/fuentes originales, writers completos/inactivos y ningún efecto. No fabrica attempt, token, evento ni nuevo request. La auditoría durable y fence cerrado permiten comprobar recovery-readiness con ROLLBACK: sesión/lease libres y mismo inventario que /abrir. READY se conserva; nextOpeningRevision no es una revisión ya creada.

La reapertura real necesita el recibo auténtico de /abrir del bot, después /listo y confirmación de la vista vigente. Work no fabrica ese recibo ni una confirmación editorial. El siguiente request se deriva canónicamente de la revisión nueva y el snapshot conserva la identidad anterior.

El monitor registra DELIVERY_CANCELLED_RECONCILED|hash exclusivamente tras prueba Guard exacta y acuse INSERT exacto; suprime la incertidumbre obsoleta de esa solicitud/revisión. No borra historia, no afirma tres publicaciones y conserva diagnósticos31 y conciliación30.

Motor, suscripciones READY/preview y cinco pins de escritores permanecen iguales. La entrega final incluye evidencias y límites.
