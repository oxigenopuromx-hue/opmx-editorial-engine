# Cierre auditado de duplicado — Bodega Nacional de Arte

Orden ejecutada el 27/11/2026. Paquete `tg_ef7373285e6eb4c28841241e2e2d58cec179a376`, revisión8: **CANCELLED / DUPLICATE**. Intento REVOKED, capacidad anterior anulada y fence RECOVERY_FENCED. Conserva la misma revisión y los cuatro materiales; no se creó otra nota ni una sesión de edición.

## Origen conservado

Recibo PUBLISH de `tg_5378aea9edd837ae08cefef25c96fdea951f288e`, revisión11. Las lecturas actuales previas y posteriores al cierre verificaron IDs, texto, metadata, imágenes y estados idénticos:

| Medio | ID | Estado preservado |
|---|---:|---|
| OPURO | 11294 | publish |
| OPOL | 4200 | publish |
| LIBERAL | 606 | draft |
| HORIZONTE | 148 | draft |

El recibo de publicación acredita la entrega histórica. No se confundió con el estado actual de los dos borradores ni se republicó ningún post.

## Evidencia

- OBSERVE101652: gate real de seis escritores, inactividad, bindings, ausencia de registros de reserva/escritura, revocación y política comprobados. Transacción revertida, sin cerrar todavía.
- CLOSE101661: una transición atómica, auditoría durable y revisión8 conservada.
- STATUS101667: auditoría, estados terminales, materiales y cuatro snapshots originales releídos y verificados.
- BLOCKED_LIST101676: el paquete dejó de aparecer como pendiente administrativo. Trece entradas antes, doce después; las demás idénticas.
- Inventario privado posterior: CANCELLED8 y los cuatro elementos STORED con los mismos IDs, tamaños y SHA-256.
- Auditoría: `933b403faf49929e0f2e617aa75bfb19a10845bf44a74cebaca85cd3b749ca6c`.
- Huella de materiales: `a51295904598c91016d24255729f69bcd1d93b4ae755cf9b8031ebc2afd3ef00`.

Ver los JSON adjuntos para la comprobación independiente del cierre, materiales, originales y retirada de pendientes. No se publican los identificadores de los demás paquetes del listado administrativo.

## Implementación y operación

Guard PR27/PR28 integrados; release/production `05f0fc1b5aea6d07d865b7b8a56c4baed1ea45ca`, desplegado mediante Hostinger. Se conserva la cancelación Telegram con sesión OPEN y recepción auténtica. La operación administrativa se limita en servidor a esta orden y a sus dos paquetes exactos; no simula mensajes Telegram ni autoriza otros cierres.

Dos pruebas de autorización/HTTP y18 grupos MariaDB aislados: ocho cierres concurrentes, una auditoría, rollback por fallo intermedio, commit perdido conciliado mediante STATUS, binarios conservados, publicaciones intactas y lista de bloqueados actualizada. Regresiones npm test aprobadas.

El mismo Motor quedó habilitado con el prompt sin cambios. La utilidad QA volvió a sus dos nodos originales, inactiva y sin registro temporal. El observador CMS conserva su configuración de registro previo. Sin GitHub Actions.

## Seguimiento del #28

Este caso está terminado. El issue general permanece abierto por los casos históricos: Milenio READY19/BLOCKED conserva la orden de recuperación que sustituyó su cancelación anterior; ElDemócrata READY8/BLOCKED continúa en seguimiento específico. Ninguno se incluyó ni se alteró en el cierre de Bodega.

Separadamente, el aviso del receptor para `/publicar` y `/borrador` sin destino quedó corregido en Engine PR65. Los paquetes nuevos mantienen AMBOS=OPURO,OPOL; las opciones explícitas y políticas históricas se conservan.
