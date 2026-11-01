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

## Infraestructura Hostinger — auditoría 2026-11-01

El panel muestra n8n como app administrada (2.45.6-1) y un plan Cloud Startup contratado que aún está en configuración. No se encontró un VPS en la sección VPS. No se ha configurado el plan ni creado una app.

Hostinger documenta que Cloud Startup admite Node.js 24 y hasta 10 sitios Node.js, con límite de 120 s por solicitud. Es una opción potencial sin contratar otro plan, sujeta a terminar la configuración y a confirmar capacidad/dominio. https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/ y https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/

Hostinger describe MariaDB para planes web/cloud y remite a VPS para otros motores como SQLite: https://www.hostinger.com/es/support/1583226-que-sistema-de-gestion-de-bases-de-datos-se-utiliza-en-hostinger/. No asumir que el prototipo SQLite será apto en Cloud Startup; definir e implementar un almacén con transacciones y claim atómico y probar su durabilidad y concurrencia en el plan real. No usar la base WordPress de producción para pruebas.

La autenticación OAuth de n8n existente es para su servidor MCP. Aún no se verificó que sirva para proteger el nuevo servidor ni que el proveedor implemente introspección compatible con `auth.mjs`. No reutilizar tokens con una audiencia distinta ni alterar validaciones para forzar compatibilidad. Un acceso temporal y revocable con privilegios mínimos debe configurarse sólo después de definir proveedor, metadata OAuth y el adaptador.

El Publisher puede requerir más de 120 s. El servidor no debe depender de una única solicitud síncrona de 120 s: diseñar respuesta de aceptación, registro durable y consulta del resultado/reconciliación sin volver a ejecutar creación.

Se agregó `mariadb-ledger.mjs` para una base dedicada: usa clave primaria y cambios de estado condicionales. Las pruebas actuales emplean un doble simulado; no demuestran bloqueo, aislamiento, recuperación ni persistencia en MariaDB real. Se requiere mysql2/promise u otro pool compatible, cuenta de mínimos privilegios y pruebas en una base de prueba independiente de WordPress. No se creó base ni credencial.

## Avance de ejecución asíncrona — 2026-11-01

Se agregó un contrato interno de inicio y consulta de ejecución (`async-jobs.mjs`), un adaptador experimental para un cliente MCP de n8n ya autenticado (`n8n-mcp.mjs`) y estados persistidos `sent`, `accepted` y `complete`. La confirmación requiere resultado DRAFT para todos los destinos solicitados. Si falla la respuesta de inicio o la persistencia tras iniciar, queda `needs_reconciliation` y no se reinicia automáticamente. Una consulta de estado no vuelve a crear la nota. La prevención sólo cubre repetir el mismo request_id; un ID distinto para la misma nota requiere controles adicionales.

Las pruebas son locales y usan dobles simulados para el cliente MCP, OAuth y MariaDB. No se verificaron compatibilidad de la sesión MCP real, selección de herramientas, seguridad de la credencial, tiempo de ejecución ni readback en WordPress. Antes de operar, usar SDK oficial y configurar acceso mínimo.

Hostinger desplegó un sitio de mantenimiento en `publisher.oxigenopuro.com.mx` (Node 24, HTTP 503 intencional); no ejecuta este prototipo ni se le conectaron credenciales. No confundir la página de mantenimiento desplegada con el servidor MCP.
