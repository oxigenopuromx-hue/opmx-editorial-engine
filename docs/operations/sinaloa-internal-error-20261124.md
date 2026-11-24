# Recuperación y publicación de Sinaloa — 24 de noviembre de 2026

Incidente: https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/61

## Resultado operativo comprobado

La nota de seguridad en Sinaloa quedó publicada en los dos destinos autorizados. Se conservó el paquete `tg_58c600f50923808a4bba1790c42172cc118258bc`, revisión **9**, y la solicitud canónica **`tg_a7990717070d2a066bf092d40664ab3a1ee2ea325fed86b7fe95090a86da5aec`**. No se abrió otra revisión ni se fabricó otro evento READY o una confirmación de Telegram.

| Destino | Post | Estado CMS leído | URL pública comprobada HTTP 200 |
| --- | --- | --- | --- |
| OPURO | 11152 | publish | https://oxigenopuro.com.mx/seguridad-sinaloa-sheinbaum-estrategia-presencia-federal/ |
| OPOL | 4098 | publish | https://oxigenopolitico.com.mx/gobierno/seguridad-sinaloa-sheinbaum-estrategia-presencia-federal/ |

Título: **Seguridad en Sinaloa: Sheinbaum defiende estrategia**.

El resultado autenticado del paquete acredita `WRITER_RESULT_CONFIRMED`, fase PUBLISH, destino AMBOS y los dos IDs anteriores. Su hash de recepción es `6de4a92ce3207e3786cbad3125e5042e3ef534643b956e66449783547c331492`; hash de envío `72d2c49b99b54c51de524636180f65267ec239dc77884a6df1f9242605301c43`. Se verificó con el validador conservado del Motor en `99fd6b0f81b41ad484c6e3c7cff4d58ca1c09a11`: completionPermitted=true. El aviso Telegram quedó **SENT** y el cierre del intento original devolvió **ATTEMPT_COMPLETED**, reopenPermitted=false y retryPermitted=false.

## Límite del diagnóstico histórico

El Motor original `9aa8077a-ee5c-8320-a84c-e6714291ee2e` registró PROGRESS_WRITING a las 14:09:24 y el diagnóstico genérico a las 14:09:39 CDMX. Su resultado retenido sólo dice error interno, aviso entregado y bloqueo confirmado. No conservó tipo de excepción, stack, módulo/línea ni resultado de la herramienta que falló. La consulta privada y la vista de Work devolvieron ese mismo resumen.

Por tanto, **la excepción histórica concreta no se recuperó y no se afirma corregida una causa raíz que no consta**. El código 33 es un fallback, no prueba de una excepción. La ejecución original también publicó una nota distinta del INE; sus IDs no corresponden a Sinaloa.

Se recuperaron por completo los seis elementos originales y se verificaron tamaños/SHA-256: controles /nuevo y /listo, enlace de Presidencia, comunicado dividido en dos textos de 3,977 y 2,191 bytes, e imagen Hero original de 95,764 bytes. No se atribuye el error a esa división: ambas partes se procesaron con integridad comprobada en la continuación exitosa.

## Comprobaciones antes de recuperar

- Guard observe, ejecución n8n **90327**, devolvió RECONCILIATION_VERIFIED, OPURO/OPOL BLOCKED. Su writesRolledBack=true corresponde a la transacción diagnóstica, no a una publicación revertida.
- La lectura autenticada de ambos CMS, ejecución **90358**, examinó los 55 resultados OPURO y 15 OPOL de Sinaloa, incluyendo publicados, borradores, pendientes, programados, privados y papelera. No apareció esta nota. La cobertura previa de la captura, del 21 de noviembre, es distinta de la respuesta presidencial del comunicado del 23.
- La recuperación administrativa ejecutó una comprobación transaccional de ausencia de reservas, solicitudes, destinos, medios, submissions, receipts y claims vinculados, incluyendo las 15 claves históricas posibles. Exigió escritores inactivos, runtime/versiones fijados y hashes/tamaños exactos de fuentes y controles.
- La consulta SQL QA **90302** había sido rechazada por su credencial; no era la excepción del Motor y no se alteraron credenciales, IPs o permisos para insistir.
- No se emitió otra solicitud ni se reutilizaron IDs de notas distintas.

## Defecto de recuperación corregido y desplegado

La recuperación existente exigía una decisión/preview confirmados de /abrir. Este paquete ordinario /nuevo → /listo no tenía ese tipo de decisión. No se simularon controles para hacerlo pasar por esa rama.

Se implementó `POST /v1/telegram/attempts/recover-ordinary` en Guard, usando autenticación y administrador existentes. Sólo admite el mismo intento ordinario EDITORIAL bloqueado y realmente sin escrituras. Comprueba paquete/revisión/evento, fuentes, autorización original y request_id; rota la capacidad privada del mismo intento y registra RESUME_ORIGINAL_UNWRITTEN. No cambia modalidad ni destinos ni crea otra revisión/evento, y no permite reintentar respuestas inciertas. Las recuperaciones confirmadas, LITERAL y UPDATE conservan su circuito.

Código y revisión:

- https://github.com/oxigenopuromx-hue/opmx-publisher-guard/pull/21
- https://github.com/oxigenopuromx-hue/opmx-publisher-guard/pull/22
- Release final `e42f801d0310d3daa566728f1a68ec8ea05288d5`, rama release/production.
- Hostinger mostró el despliegue final completado a las **14:48 CDMX**, commit e42f801d y entrada server.js. Sin GitHub Actions y sin migración de base de datos.

La primera entrega c532927 no propagaba el nuevo método desde fence-preview-start.mjs. La comprobación funcional **90672** devolvió HTTP 404, sin efectos. Se corrigió esa delegación en PR22 y se agregó una regresión que extrae la delegación del entrypoint real y verifica el enrutado HTTP al proveedor correcto. **177 pruebas aprobadas y npm test aprobado**, incluyendo lectores/gates reales sobre doble transaccional y rutas autenticadas.

La única recuperación efectiva, ejecución **90690** a las 14:51 CDMX, devolvió HTTP 200 y **ORDINARY_UNWRITTEN_ATTEMPT_RECOVERED**, originalAuthorizationPreserved=true, destino AMBOS, política publish-ambos-v4 y el mismo request_id. La capacidad privada no se incluye en este documento.

## Preparación editorial y publicación única

- Se usaron los dos textos completos, la fuente oficial del 23 de noviembre y la Hero del paquete. El reportaje mantiene atribución de las cifras a autoridades.
- Política original validada: PUBLISH, AMBOS (OPURO/OPOL), EDITORIAL, ANNOUNCED_DEFAULT_AND_DIRECT_CLOSE.
- Catálogo vivo: OPURO Seguridad ID36; OPOL Gobierno ID3. Preflight local y validación de Publisher FILES_VALIDATED / MASTER_SEMANTICS_VALIDATED aprobados.
- Imagen Hero 1280×854 y destacada 1200×630, JPEG independientes. No se generó ni sustituyó la escena.
- Se hizo **una sola llamada efectiva de publicación** con la solicitud original. Respondió PUBLISH_SUBMITTED; las lecturas posteriores fueron consultas, sin reenviar.
- El escritor compartido **90697** completó su ejecución a las 14:52:45 CDMX.
- Lectura autenticada posterior de CMS, ejecución **90723**: ambos posts publish, slug/título exactos y contenido Gutenberg idéntico al entregado. Fuente oficial presente en el cuerpo.
- OPURO: Hero11150 y destacada11151; OPOL: Hero4096 y destacada4097. IDs distintos en cada medio.
- Los dos enlaces públicos devolvieron HTTP200 con el título, contenido y canonical correctos.
- Los flujos auxiliares se restauraron al diagnóstico original de dos nodos, inactivo y sin los nodos temporales de lectura.

## Registro de errores futuros y contrato del catálogo

Se compactó un párrafo del Motor existente para conservar en Work paquete/revisión, etapa, última herramienta/ejecución y tipo/código/módulo/línea de una excepción realmente observada, sin mensaje crudo, secretos ni fuentes. No se envían trazas técnicas a Telegram. La instrucción dice expresamente que se informe cuando no consta una excepción.

También se hizo explícito el callback de catálogo: `fetchPage=async({site,page})=>structuredContent;`. El helper pasa un objeto, no argumentos posicionales. Un adaptador local inicialmente incorrecto fue corregido antes del preflight exitoso; **no se presenta como la excepción histórica**.

Lectura independiente final del prompt: 65,524 caracteres, Motor `6ae9095256948191b33f1e023fbfbf8b`, misma identidad, habilitación, horario, timezone, entorno y pins. Sin un consumidor nuevo ni reejecución automática de históricos.

La publicación y el bloqueo operativo de esta solicitud están resueltos. El issue61 permanece abierto únicamente por el límite de diagnóstico original y por la aceptación de captura ante una excepción controlada, sin necesidad de volver a publicar esta nota. El inventario /estado previo a /listo se sigue en #35 como mejora separada.
