# Despliegue vigente — Publisher integrado v3

Activo desde 2026-11-05; ver `docs/architecture/ADR_PUBLISHER_DESTINOS_v3.0.md`. Empaquetar con `python tools/mcp-publisher/package-guard.py /ruta/archivo.zip`. Conserva rutas relativas, módulos Telegram y el package.json verificado del servicio existente. No migrar ni borrar tablas; no cambiar secretos. Los párrafos siguientes documentan prototipos anteriores y sus limitaciones históricas.

# Servicio de reservas para pruebas

Estado: experimental; no publicar sin pruebas. Ensamblar `direct-claim.mjs`, `guard-server.mjs`, `guard-start.mjs` y `guard-package.json` como `package.json`; agregar `server.js` con `import './guard-start.mjs';`. En Hostinger sólo escucha detrás de HTTPS. Variables: `OPMX_GUARD_SECRET` (hex aleatorio, al menos 32 bytes), `OPMX_DB_USER`, `OPMX_DB_PASSWORD`, `OPMX_DB_NAME`. La conexión MySQL usa 127.0.0.1 del hosting; no admite host remoto. No subir credenciales al repositorio.

Solicitud autenticada POST /v1/reservations con JSON de hasta 4096 bytes: requestId, fingerprint (SHA-256), slug y destinations. 201 significa reserva confirmada; 409, 503, timeout y cualquier respuesta no confirmada detienen la publicación y exigen reconciliación. El control de frecuencia en memoria es por proceso, no sustituye controles de plataforma. No hay endpoint de borrado/liberación; todas las reservas permanecen hasta implementar recuperación segura.

Pruebas locales usan pool simulado. No se ha probado la conexión MySQL desde el runtime de Hostinger, el paquete npm instalado, la integración n8n ni concurrencia real. No conectar WordPress hasta validar el servicio y el flujo completo. El paquete usa mysql2 3.14.5, sin lockfile verificado.

## Revisión experimental de seguimiento de medios

La rama incorpora `media-progress.mjs` y rutas `/v1/media/*` en `guard-server.mjs`. Esta revisión NO está desplegada ni validada en MariaDB. El paquete debe incluir también ese módulo y la tabla de `mediaSchemaSql` debe existir sólo en una base dedicada de prueba antes de invocar las rutas. No modificar la base WordPress. Los tests locales usan simulaciones y no verifican simultaneidad ni readback. La aplicación existente en Hostinger sigue usando el paquete anterior; no confundir código versionado con despliegue.

