# Recuperación de eventos sin entrega al reanudar

El paquete `tg_7e86541dfd428f4547bdfec666a5fb55916f660e`, revisión 7, fue cerrado el 27 de noviembre a las 12:45:20, hora de Ciudad de México, durante la pausa del Motor. El evento existía, pero reanudar la suscripción no creaba la entrega que faltaba. El worker sólo consumía filas de entrega; no buscaba eventos READY anteriores sin entrega.

## Resolución del paquete

- Se conservó la revisión 7 y la solicitud AMBOS `tg_1153789a668d0a6a8ca931ba129228ae990c0b8becb33e64fc48e81d0d8f5315`.
- Se renovó la suscripción del Motor existente, sin modificar sus 60,107 caracteres de instrucciones.
- Ejecución n8n 101714: `EVENT_QUEUED` para el evento original `evt_e425b9ade89a93e73c5be2e79e71bcd1779245175aee9483`. No se creó otro paquete ni revisión.
- Las entregas SENT pasaron de 379 a 380. Motor `3c51d12c-953c-832f-b857-3330ae3aa303`, iniciado a las 13:08:52, terminó a las 13:12:20 con `ATTEMPT_COMPLETED` y aviso Telegram confirmado.
- OPURO 11319 y OPOL 4220: publicación confirmada. La lectura independiente 101822 comprobó ambos CMS en `publish`, el mismo slug, solicitud y recibo `ea2d413c98e7b2d472a12c2e114ca555e2b03377962fbbfdae67f33000e5aa77`.
- El seguimiento del intervalo de pausa sólo contiene ese paquete; no se reactivaron bloqueos históricos ni duplicados.

## Corrección del worker

Cada tick del worker existente restituye hasta 40 entregas ausentes de eventos auténticos. Deben coincidir paquete READY/revisión, intento QUEUED sin token, evento del intento y fence AWAITING_DECISION. La suscripción debe estar ACTIVE, vigente y autorizada para el propietario, incluidos los operadores compartidos configurados. Se excluyen claims, envíos y recibos de Publisher y operaciones UPDATE.

Se conserva el event_id y el payload existentes. Sólo se inserta la entrega PENDING ausente con su clave determinista. No se restablecen entregas SENT, FAILED, CANCELLED, RETRY o LEASED; no se cambia un intento, token, fence, solicitud, material ni publicación. Los bloqueos y resultados inciertos conservan su conciliación específica. Si un despliegue antiguo carece de las tablas necesarias, el diagnóstico informa BACKLOG_UNAVAILABLE y el worker continúa entregando sus trabajos existentes.

El estado autenticado de eventos añade `activeUnexpiredSubscriptions` y `backlog.missingDeliveries`, sin secretos ni capacidades. Después de reanudar se comprueban estos datos, la entrega, la ejecución efectiva y el resultado; `is_enabled=true` por sí solo no acredita drenado de cola.

## Validación

Base MariaDB aislada 10.11.18, 30 grupos de comprobaciones: pausa/reanudación, caducidad, propietario y operador compartido, estados de intento/fence, revisiones/eventos discrepantes, registros de escritores, preservación de todas las entregas existentes, ocho reparaciones concurrentes, lotes de 40 y continuidad de entrega si falla la reparación. Se ejecutaron los módulos reales del worker, con callbacks simulados; cero llamadas a CMS. Los paquetes, intentos, fences y eventos permanecieron idénticos antes/después de la reparación.

Comando de prueba: `OPMX_ISOLATED_TEST=1 node tests/queue-resume/mysql-test.mjs`, con una base local desechable y mysql2 instalado. Comprobación de sintaxis de los tres módulos aprobada. Despliegue mediante la integración Hostinger de `release/production`; sin GitHub Actions.



Código de la corrección: PR Guard #29, commit de integración `5ff47707bfbc0ee48d7ebfbb4b3d550abbe7ecd8`. El Motor se mantuvo habilitado y con el mismo prompt; sólo se reactivó una vez el evento original antes de integrar la corrección. No se alteraron los flujos receptores ni escritores n8n.

## Comprobación en producción

La ejecución de sólo lectura 101837, a las 13:18:48 de Ciudad de México, confirmó el nuevo diagnóstico activo: una suscripción ACTIVE no caducada, 380 entregas SENT y `backlog.missingDeliveries=0`. La nota conservó su misma revisión 7 y sus cuatro materiales, IDs, tamaños y SHA-256. Motor habilitado con prompt idéntico. Las utilidades manuales de diagnóstico se restauran tras esta aceptación; no se dejan cambios en los flujos productivos de n8n.
