# OPMX Publisher MCP — prototipo offline

Estado: **PROTOTIPO, NO DESPLEGAR NI USAR PARA PUBLICAR**.

`prepare.mjs` declara un descriptor MCP con dos archivos y prepara un payload para el adaptador n8n. Sólo produce `PUBLICAR: false`; no implementa transporte MCP, autenticación, ejecución de n8n ni publicación. Las URLs de descarga se aceptan sólo desde dominios exactos configurados; falta validar qué orígenes proporciona ChatGPT en esta instalación. No guardar URLs firmadas ni archivos en logs.

Prueba local: `node --test tools/mcp-publisher/prepare.test.mjs`.

Pendientes antes de uso real:

- Implementar y probar servidor MCP con OAuth y permisos mínimos, incluyendo audiencia y aislamiento de usuarios.
- Conectar de forma autenticada al workflow de prueba n8n y validar sus respuestas, permisos y disponibilidad de archivos reales. No confiar en URLs proporcionadas libremente por un usuario; proteger DNS/egress contra SSRF y revalidar orígenes de descargas de OpenAI antes de permitirlos.
- Establecer persistencia de idempotencia/claim atómico y reconciliación ante timeout, incluso si los reintentos automáticos de creación están deshabilitados.
- Revisar cargas máximas, bytes reales, variantes MIME, expiración de URLs y política de borrado/logs. Se verifica firma básica, no se decodifica la imagen.
- Prueba aislada de extremo a extremo con archivos reales en borrador y comprobación de ambos WordPress, sin activación ni publicación pública automática.

Pruebas actuales son unitarias con respuestas simuladas. El flujo n8n de prueba separado conserva cambios en estado inactivo; no hay despliegue ni endpoint MCP nuevo. No se modifican los contratos del Motor.
