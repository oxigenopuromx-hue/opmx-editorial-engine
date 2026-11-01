# OPMX Publisher MCP — prototipo de integración

Estado: **PROTOTIPO, NO DESPLEGAR NI USAR PARA PUBLICAR**.

El prototipo recibe MASTER e imágenes mediante un descriptor preliminar MCP, prepara la entrada de n8n y fuerza `PUBLICAR: false`. Incluye transporte HTTP experimental, introspección OAuth, cliente n8n e idempotencia en SQLite. Todas sus pruebas usan servicios simulados. No hay servidor desplegado, OAuth conectado ni comprobación real de ChatGPT/WordPress.

Pruebas: Node.js 24 o superior; `node --test tools/mcp-publisher/*.test.mjs`.

## Límites obligatorios

- El servidor no tiene launcher ni configuración de producción. Debe usarse el SDK MCP oficial y probar negociación, encabezados, sesiones y cliente real antes de hacerlo público. El transporte incluido sólo sirve para investigación local.
- OAuth de introspección exige `active`, emisor, audiencia, alcance, sujeto y expiración. Aún no hay proveedor elegido ni metadata OAuth de descubrimiento; no se probó interoperabilidad con OAuth de n8n ni con ChatGPT.
- El almacenamiento SQLite necesita un solo archivo durable compartido por todos los procesos; no funciona como garantía distribuida en instancias serverless con discos independientes o efímeros. Verificar bloqueos del almacenamiento real. Si no se garantiza esto, usar otro almacén con claim atómico. Los envíos inciertos no se reintentan: se reconcilian manualmente.
- El webhook n8n debe activarse sólo después de validar autenticación y permisos mínimos. No hay credenciales ni tokens en el repositorio. El adaptador real no se ha probado.
- Confirmar los orígenes que ChatGPT usa para URLs temporales. Limitar egress y resolver DNS de forma segura contra SSRF/rebinding; la allowlist exacta de hosts y rechazo de redirecciones son sólo una capa, no una garantía completa. No almacenar URLs firmadas ni archivos en logs.
- Las pruebas de imagen verifican firma básica y tamaño, no decodifican el archivo. Deben verificarse variantes MIME, expiración de URLs y límites reales.
- Antes de producción: ejecutar una prueba completa con archivos reales y verificar borradores en cada WordPress, errores parciales, concurrencia, pérdida de respuesta y reconciliación. No activar publicación pública automática.

El workflow de prueba n8n permanece inactivo. Los contratos y las instrucciones editoriales no se modifican.
