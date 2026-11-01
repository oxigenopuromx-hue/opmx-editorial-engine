# Servicio de reservas para pruebas

Estado: experimental; no publicar sin pruebas. Ensamblar `direct-claim.mjs`, `guard-server.mjs`, `guard-start.mjs` y `guard-package.json` como `package.json`; agregar `server.js` con `import './guard-start.mjs';`. En Hostinger sólo escucha detrás de HTTPS. Variables: `OPMX_GUARD_SECRET` (hex aleatorio, al menos 32 bytes), `OPMX_DB_USER`, `OPMX_DB_PASSWORD`, `OPMX_DB_NAME`. La conexión MySQL usa 127.0.0.1 del hosting; no admite host remoto. No subir credenciales al repositorio.

Solicitud autenticada POST /v1/reservations con JSON de hasta 4096 bytes: requestId, fingerprint (SHA-256), slug y destinations. 201 significa reserva confirmada; 409, 503, timeout y cualquier respuesta no confirmada detienen la publicación y exigen reconciliación. El control de frecuencia en memoria es por proceso, no sustituye controles de plataforma. No hay endpoint de borrado/liberación; todas las reservas permanecen hasta implementar recuperación segura.

Pruebas locales usan pool simulado. No se ha probado la conexión MySQL desde el runtime de Hostinger, el paquete npm instalado, la integración n8n ni concurrencia real. No conectar WordPress hasta validar el servicio y el flujo completo. El paquete usa mysql2 3.14.5, sin lockfile verificado.
