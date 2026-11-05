# Estado vigente — 2026-11-05

El Publisher integrado v3 está activo y usa REST nativa de WordPress. La documentación y contratos vigentes están en `docs/architecture/ADR_PUBLISHER_DESTINOS_v3.0.md` y `workflows/publisher/integrated-v3/`. El contenido siguiente conserva la historia de prototipos; no indica que la integración vigente siga pendiente. AMBOS=OPURO+OPOL; TODOS añade LIBERAL; se admiten listas por comas.

# OPMX Publisher MCP — prototipo de integración

Estado: **PROTOTIPO, NO DESPLEGAR NI USAR PARA PUBLICAR**.

El prototipo recibe MASTER e imágenes mediante un descriptor preliminar MCP, prepara la entrada de n8n y fuerza `PUBLICAR: false`. Incluye transporte HTTP experimental, introspección OAuth, cliente n8n e idempotencia en SQLite. Todas sus pruebas usan servicios simulados. No hay servidor desplegado, OAuth conectado ni comprobación real de ChatGPT/WordPress.

Pruebas: Node.js 24 o superior; `node --test tools/mcp-publisher/*.test.mjs`.

## Límites obligatorios

- El servidor no tiene launcher ni configuración de producción. Debe usarse el SDK MCP oficial y probar negociación, encabezados, sesiones y cliente real antes de hacerlo público. El transporte incluido sólo sirve para investigación local.
- OAuth de introspección exige `active`, emisor, audiencia, alcance, sujeto y expiración. El prototipo ahora expone metadatos de recurso protegido y challenge 401, pero no hay proveedor de autorización elegido ni se ha probado interoperabilidad con OAuth de n8n o ChatGPT.
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

El Publisher puede requerir más de 120 s. El prototipo asíncrono permite iniciar y consultar por separado, pero aún requiere una integración real con n8n y verificar el almacenamiento durable y la reconciliación.

Se agregó `mariadb-ledger.mjs` para una base dedicada: usa clave primaria y cambios de estado condicionales. Las pruebas actuales emplean un doble simulado; no demuestran bloqueo, aislamiento, recuperación ni persistencia en MariaDB real. Se requiere mysql2/promise u otro pool compatible, cuenta de mínimos privilegios y pruebas en una base de prueba independiente de WordPress. No se creó base ni credencial.

## Avance de ejecución asíncrona — 2026-11-01

Se agregó un contrato interno de inicio y consulta de ejecución (`async-jobs.mjs`), un adaptador experimental para un cliente MCP de n8n ya autenticado (`n8n-mcp.mjs`) y estados persistidos `sent`, `accepted` y `complete`. La confirmación requiere resultado DRAFT para todos los destinos solicitados. Si falla la respuesta de inicio o la persistencia tras iniciar, queda `needs_reconciliation` y no se reinicia automáticamente. Una consulta de estado no vuelve a crear la nota. El prototipo también reserva cada combinación de destino y slug de manera atómica para bloquear otro request_id con destinos solapados. Esto sólo cubre solicitudes registradas por esta integración: no comprueba publicaciones que ya existan en WordPress, variaciones de slug ni notas creadas por otros flujos. Las reservas se conservan tras iniciar incluso ante resultados ambiguos; las actualizaciones o liberaciones deben tratarse mediante un procedimiento explícito de reconciliación aún no implementado.

Las pruebas son locales y usan dobles simulados para el cliente MCP, OAuth y MariaDB. No se verificaron compatibilidad de la sesión MCP real, selección de herramientas, seguridad de la credencial, tiempo de ejecución ni readback en WordPress. Antes de operar, usar SDK oficial y configurar acceso mínimo.

Hostinger desplegó un sitio de mantenimiento en `publisher.oxigenopuro.com.mx` (Node 24, HTTP 503 intencional); no ejecuta este prototipo ni se le conectaron credenciales. No confundir la página de mantenimiento desplegada con el servidor MCP.

### Prueba MCP real de rechazo seguro

Se ejecutó manualmente el workflow inactivo `OPMX — Publisher MCP · borrador de integración` mediante el conector MCP existente, con MASTER sintético y sin imágenes. `execute_workflow` devolvió el ID 22 inmediatamente; `get_workflow_execution` confirmó estado `error` en `Preparar MASTER y binarios` por ausencia de `hero_file`. La validación ocurrió antes de llegar a WordPress. Esta prueba valida el comportamiento de inicio/consulta del conector existente, no el cliente SDK nuevo, OAuth del nuevo servidor, carga real de imágenes ni publicación.

Las reservas se prueban con SQLite local; el adaptador de transacciones MariaDB aún no se ha probado en una base real. La tabla de destinos es independiente de la tabla de solicitudes y debe crearse en una base de prueba dedicada, nunca en la base de WordPress.

## Diagnóstico OAuth de n8n — 2026-11-01

Se consultó desde un workflow diagnóstico de solo lectura la metadata pública OAuth de la instancia n8n (ejecución manual 23). El servidor anuncia autorización por código, refresh token, PKCE S256, registro dinámico y JWKS; **no anuncia un endpoint de introspección**. `auth.mjs` usa introspección, por lo que no debe apuntarse al OAuth de n8n suponiendo compatibilidad. Tampoco debe aceptarse un token emitido para n8n como si fuera válido para `publisher.oxigenopuro.com.mx` sin verificar que su recurso, audiencia y permisos lo autorizan. La conexión ya existente ChatGPT → n8n es distinta del futuro OAuth ChatGPT → Publisher.

El prototipo emite metadata de recurso protegido y challenge 401 para `publisher.draft`, con pruebas locales. Son simulaciones: sigue faltando integrar un servidor de autorización compatible, el SDK MCP oficial, creación/renovación segura de credenciales servidor → n8n y pruebas reales. Ningún secreto se consultó o almacenó.

