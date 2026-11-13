# Issue25 — resolución de enlaces compartidos activa

Corte 13nov2026 UTC / 12nov2026 CDMX. Implementación y37pruebas en commit 9dd6b86ec36d988bbe1af2cf9dfd00a13a41ed04, rama feat/telegram-reopen-recovery. Helper SHA256 9dff138d8d6de1ea8a75eeee7fd85ffdcaa55717d1e27677f676071a5acf691a.

Se actualizó sólo el prompt del mismo Motor6ae9095256948191b33f1e023fbfbf8b, fijando ese commit. Lectura posterior exacta:51831caracteres, SHA2567b09b7b0b0e29de0e03c248a3900f6cd1ac7739864e08c02ef3e9328eceef3b1. Estado enabled, título, horario y zona idénticos a la lectura anterior; no se enviaron cambios de triggers, entornos ni suscripciones. Permanece el único consumidor READY/preview con sus controles LITERAL y aceptación24.

El Motor resuelve enlaces compartidos compatibles mediante Python/curl y el proxy heredado cuando web no puede abrirlos. No cambia el contrato de leer_fuente, las fuentes guardadas o su SHA; tampoco introduce otra herramienta MCP ni un servicio de descarga. Se valida cada salto HTTPS y se limita a5redirecciones/7solicitudes/20segundos, sin reintentos automáticos. La conexión puede requerir más de5s: se midió TLS6.392s, por lo que connect10/request12 comparten el límite total20. Curl>=8.4 limita también cuerpos desconocidos del GET de la envoltura.

## Evidencia

37/37pruebas y revisión independiente PASS. El enlace original se releyó por bytes/SHA antes de probarlo. Prueba final del implementador: HEAD share.google302 → GET www.google.com/share.google?q=...301 → HEAD J.D.Power504. Prueba independiente raíz del helper definitivo: mismos302/301 y URL final https://www.jdpower.com/business/es/mexico-vehicle-dependability-study-vds/; lectura final agotó el presupuesto, resultado REDIRECT_RESOLVED/FINAL_FETCH_UNCONFIRMED, final_is_shared_wrapper=false, source_content_verified=false. Dos ejecuciones anteriores con connect5 habían agotado el tiempo antes del primer salto. No se ocultan esas demoras ni se presentan como lectura editorial confirmada.

La herramienta web pudo abrir la URL directa y el comunicado oficial2026 en español: https://www.jdpower.com/business/es/press-releases/el-estudio-de-calidad-y-confiabilidad-del-vehiculo-2026-vds/ . El prompt obliga a leer y comprobar tema, fecha, edición y resultados específicos; una ficha genérica, HTTP200 o Google200 no autorizan cifras o rankings. Si sigue faltando contenido esencial, conserva SOURCE_UNAVAILABLE.

La nota histórica ya estaba publicada: no se reabrió, reclamó ni reintentó el paquete y no hubo publicaciones, edicionesCMS ni nuevos avisos. Este cierre corresponde al resolutor general, no a una nueva entrega editorial.

## Reversión

Retirar únicamente el bloque CORRECCIÓN ISSUE #25 del prompt del mismo Motor, comprobando prompt anterior49859caracteres/SHA256ed1b77c7ce68d367288c66a63280be1b1fec42dc79aece45ac0f565f7e5e3eed. Conservar todas las otras reglas y la suscripción. El helper sin uso no cambia paquetes. No revertir otros despliegues ni reanudar notas históricas.
