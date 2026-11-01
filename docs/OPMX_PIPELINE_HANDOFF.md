# OPMX Pipeline — Handoff maestro

## Hito en preparación — integración ChatGPT → Publisher MCP (2026-11-01)

### Ruta simplificada: conexión existente ChatGPT → n8n — 2026-11-01

Acceso MySQL: con autorización, Hostinger recibió una regla limitada para la IP observada por HTTP desde n8n, y se guardó una credencial MySQL en n8n con SSL activado. La prueba devolvió acceso denegado e identificó una IP origen MySQL diferente a la IP HTTP; la regla anterior permanece habilitada y NO autoriza esa segunda IP. Esto demuestra que la IP de egreso puede depender del destino o el protocolo, no que sea fija. Conectividad autenticada, validación efectiva del cifrado y ejecución SQL desde n8n siguen sin comprobarse. No habilitar comodines ni relajar TLS. No se cambió el Publisher activo ni se publicaron notas.


Base independiente del Publisher creada en Hostinger por autorización del usuario; incluye las tablas InnoDB `opmx_mcp_requests` y `opmx_mcp_targets` del prototipo, con claves primarias e índice. No se modificó la base WordPress. phpMyAdmin confirmó la creación. No existen aún datos de reservas y el workflow directo no usa estas tablas. Hostinger exige habilitar acceso remoto por IP; una consulta HTTP desde n8n observó una IP de salida, pero no se ha demostrado que sea la IP para conexiones MySQL ni que sea fija. No se ha habilitado acceso remoto ni guardado credencial MySQL en n8n. Verificar TLS, egress TCP, atomicidad con dos destinos y recuperación antes de usar la conexión. Las credenciales no se guardan en el repositorio.


Preflight duplicados OPURO: la copia inactiva consulta REST autenticado de WordPress con status=any y slug exacto, sin escrituras. Ejecución 28 detectó una nota ya existente; ejecución 29, con slug artificial en una copia de prueba, no encontró coincidencia. La consulta es sólo preventiva: no ofrece exclusión atómica ni protege de solicitudes concurrentes, fallos parciales, variantes de slug, ediciones externas ni OPOL. La rama WordPress permanece desconectada. Referencia sanitizada para revisión: workflows/publisher/OPMX_PREFLIGHT_DIRECTO_OPURO_REFERENCIA_NO_ACTIVAR.json (sin credenciales, no importar para activar). Las credenciales n8n reales no se exportaron.

Pendiente crítico para conexión directa: almacén transaccional dedicado accesible desde n8n, con claves únicas por destino+slug, transición durable antes de escritura, reconciliación ante incertidumbre y tratamiento de resultados parciales. Un almacén exclusivo de Node no protege llamadas que entran directamente en n8n. Hostinger muestra la opción de crear una base MySQL y un usuario; aún no se han creado, configurado ni probado conectividad o permisos de red. No usar la base WordPress existente. No reconectar escrituras hasta implementar y validar esta protección.


Prueba nativa con datos reales: se desconectaron deliberadamente las dos ramas WordPress después de la validación en el workflow inactivo 8xQrN9gAfGSzvtpj, y se agregó una salida de preflight. Ejecución 26 envió el MASTER real de Binance y dos JPEG completos (371031 y 145597 bytes): n8n recibió y preparó ambos binarios; el validador rechazó correctamente CONTROL_EDITORIAL=REQUIERE_REVISION. Ejecución 27 usó una copia transitoria con ESTADO=LISTO exclusivamente para validar el transporte y el contrato: ambos nodos y el preflight finalizaron correctamente. El MASTER original no se modificó, no se declaró aprobado editorialmente, no se accedió a WordPress ni se crearon notas. Las ramas WordPress permanecen desconectadas como medida de prueba. La ejecución directa por n8n no usa el ledger del prototipo Node: falta idempotencia duradera y detección de duplicados en CMS antes de reconectar. Esta prueba desde Work no verifica la transferencia de archivos desde el otro chat del Motor ni un flujo real de publicación.


La conexión OAuth del plugin n8n ya disponible se puede utilizar directamente; no requiere proveedor adicional ni servidor Node para la prueba técnica. Ejecución manual 25 en el workflow aislado 8xQrN9gAfGSzvtpj: se envió JSON mínimo con dos cadenas base64 sintéticas que contienen únicamente la firma PNG. El nodo Preparar MASTER y binarios procesó ambos campos binarios y el nodo de validación rechazó el MASTER vacío por CONTROL_EDITORIAL ausente. No alcanzó WordPress ni creó notas. Esto prueba el transporte de JSON y cadenas base64 en esa llamada, no la lectura automática de adjuntos del Motor ni la carga de imágenes reales completas. Confirmar tamaño máximo, disponibilidad de archivos en el entorno del Motor, compatibilidad de herramienta en ese chat, protección de duplicados y ejecución completa antes de habilitar la publicación. El workflow permanece inactivo; el Publisher v1.3.5 no se modificó. No almacenar binarios ni secretos en las instrucciones o repositorio.

### Diagnóstico OAuth — 2026-11-01

Se verificó con ejecución manual 24 que el JWKS anunciado responde con claves públicas; no se ha verificado que firme los tokens MCP ni que admita al Publisher como audiencia. La documentación de n8n limita el recurso OAuth a las URLs configuradas de su servidor MCP; N8N_MCP_BASE_URL está diseñado para una URL alternativa del mismo servidor y no se ha cambiado. No reutilizar tokens emitidos para n8n como autorización del Publisher. La introspección simulada ahora también rechaza tokens cuyo nbf todavía no se cumple. Las 30 pruebas locales pasan. Pendiente: proveedor compatible con el recurso Publisher, SDK MCP, credenciales separadas hacia n8n y prueba real sin notas. No hay OAuth instalado ni configuración de producción cambiada.

La metadata pública OAuth de la instancia n8n se consultó mediante un workflow diagnóstico inactivo, ejecución manual 23: anuncia PKCE S256, registro dinámico y JWKS, pero no anuncia introspección. El validador preliminar del prototipo usa introspección, por lo que su compatibilidad con este proveedor no está demostrada. El prototipo ahora incorpora metadata de recurso protegido y challenge 401 con prueba local; no se ha conectado un proveedor de autorización ni un cliente real de ChatGPT. La conexión existente ChatGPT → n8n no equivale a autorización ChatGPT → Publisher.


**Estado: prototipo en rama de PR, no integrado en main ni habilitado para producción.** El [PR #9](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/pull/9) contiene el código y pruebas bajo `tools/mcp-publisher/`; no sustituye los flujos vigentes mientras permanezca en borrador.

- Hostinger: `publisher.oxigenopuro.com.mx` está en Cloud Startup con Node 24; despliega exclusivamente una aplicación temporal de mantenimiento que responde 503. No ejecuta el servidor MCP del PR. Hostinger creó registros DNS del subdominio. No se ha conectado base de datos ni proveedor OAuth.
- n8n: existe una copia separada e **inactiva**, `OPMX — Publisher MCP · borrador de integración`. El Publisher v1.3.5 activo no fue modificado. Una prueba real MCP con datos incompletos produjo ejecución 22 y fue rechazada antes de WordPress; las demás pruebas del workflow usaron respuestas simuladas. El webhook de la copia está configurado para n8n OAuth2, cuya interoperabilidad aún no está verificada.
- Referencia del workflow: `workflows/publisher/OPMX_PUBLISHER_MCP_REFERENCIA_SANITIZADA_NO_ACTIVAR.json`. Se retiraron identificadores de credenciales y de webhooks y se desactivó MCP. Es una referencia saneada, **no se ha probado su importación** y no debe activarse; requiere revisión y asignación de credenciales si se utiliza para preparar una copia.
- Prototipo: crea sólo borradores, permite iniciar y consultar ejecución y evita reenvíos tras un resultado incierto. Reserva destino/slug para bloquear solicitudes solapadas ingresadas por este prototipo. No verifica duplicados creados previamente en WordPress u otros flujos; tampoco existe aún procedimiento de actualización o liberación segura de reservas.
- Validación: 30 pruebas locales Node aprobadas; MariaDB, OAuth, conexión del cliente MCP nuevo y WordPress están simulados. La prueba n8n real descrita arriba no publicó ni creó notas.
- Pendientes obligatorios: SDK y protocolo MCP, OAuth real y permisos mínimos, prevención SSRF/egress, MariaDB dedicada y pruebas de transacciones reales, reconciliación de fallos/duplicados y prueba integral con imágenes y borradores reales. No desplegar el prototipo ni activar la copia antes de validar. No se cambian instrucciones o maestros editoriales.


Actualizado: 2026-10-25

## Propósito
Punto de entrada técnico para cualquier instancia de ChatGPT Work que opere el flujo OPMX desde la salida editorial hasta distribución social.

## Fuente de verdad
- GitHub `main` es la fuente de verdad técnica y versionada.
- Los chats sirven para dirección, decisiones y aprobación.
- Work implementa, prueba y documenta.
- Si una conversación contradice código o documentación vigente en `main`, prevalece `main`.
- Nunca guardar secretos, tokens, contraseñas ni credenciales en el repositorio.

## Cadena
Motor Editorial OPMX → Publisher n8n → WordPress OPURO/OPOL → Social Distribution Engine n8n → plataformas.

## Estado al 2026-10-23
### Motor Editorial
Contratos vigentes ya versionados en `contracts/`, incluyendo Protocolo v4.2 y Salida Editorial v2.2.

### Publisher
Versión operativa vigente y validada: `OPMX Publisher MEDIA v1.2.12`, versionada en `workflows/publisher/`. El usuario confirmó una ejecución real exitosa el 2026-10-23, incluyendo una categoría OPURO que no pertenecía a la antigua whitelist embebida. v1.2.12 elimina exclusivamente la whitelist embebida de categorías OPURO: la categoría sigue siendo obligatoria y `OPURO — Buscar categoría` + `OPURO — Resolver categoría` consultan WordPress y exigen coincidencia exacta normalizada para obtener el ID; no se crean categorías automáticamente. OPOL conserva su catálogo embebido y validación jerárquica. v1.2.11 permanece como rollback probado y v1.2.10 como baseline histórico.

Regla: no modificar Publisher para resolver necesidades de Social salvo incompatibilidad contractual comprobada y aprobada.

### Social Distribution Engine
Estado vigente: **v1.0.1 OFFLINE_PREFLIGHT_TESTED**. No se ha importado/ejecutado
en n8n nativo ni publicado en plataformas. No confundir las pruebas Node con esas pruebas.

Terminado el 2026-10-25:
- Contrato técnico `contracts/SOCIAL_DISTRIBUTION_CONTRACT_v1.0.1.json`; entrada
  wire mantiene `social_contract_version=1.0`. Exige `source_site=OPURO`, booleans
  reales, nueve targets explícitos y nueve resultados de plataformas distintas.
- Tres exports v1.0.1 completos y desactivados: coordinador, preflight staging y
  preflight Threads. Son subworkflows, no webhooks públicos sin autenticación.
- El coordinador devuelve nueve ramas independientes con consolidado validado.
  No llama staging ni workers remotos durante simulación.
- Los exports v1.0 se preservan históricamente, pero tienen incompatibilidades
  conocidas y **no deben activarse**; ver `changelog/SOCIAL_v1.0.1.md`.
- `tools/social/` permite regenerar exports, ejecutar pruebas y verificar que no
  divergen del código fuente. Validadores Ajv empaquetados sin dependencia npm en n8n.
- Corregidos sólo punteros documentales atrasados del Publisher en manifest y
  fuentes maestras. Los tres exports Publisher y maestros no cambian.

Probado:
- 35 pruebas Node aprobadas, incluyendo ejecución de los Code nodes exactos del
  JSON en VM sin red, rechazo de entradas inválidas, consolidado de nueve estados,
  `dry_run` sin IO externo, live bloqueado, hash/firma del binario y preservación.
- JSON Schema 2020-12 de entrada/salida, generación reproducible, grafo y
  `git diff --check`. Audit npm incluyendo desarrollo: 0 vulnerabilidades reportadas.
- CI agregado para repetir build-check/tests. No declarar aprobado CI remoto
  hasta consultar la ejecución GitHub correspondiente.

No terminado / bloqueos:
- **Idempotencia efectiva pendiente:** no hay almacén durable elegido, provisionado
  ni adaptador con claim atómico. Requisitos en `docs/SOCIAL_DURABLE_STORE_REQUIREMENTS.md`.
  El gate `LIVE_BLOCKED` está en código, no admite bypass por input/variable.
- Falta comprobar versión/configuración n8n (Merge 9 inputs y built-in crypto),
  importar la revisión nueva y ejecutar el primer dry run nativo.
- Fase 1 sigue exclusivamente OPURO (`oxigenopuro.com.mx`). `IMAGEN_SOCIAL` sigue
  siendo un tercer asset manual de Canva posterior a Publisher; no HERO/interior.
- Staging objetivo aprobado: WordPress OPURO temporal, no R2, mediante
  `OPMX_OPURO_WP_BASE_URL`. v1.0.1 sólo inspecciona/prepara metadata offline; no
  sube ni elimina medios. Retención siete días desde distribución terminada,
  fecha de limpieza aún null durante preflight.
- Pendientes: upload/readback WordPress, OAuth/permisos por red, publicación,
  readback remoto y pruebas persistentes de duplicado/concurrencia/timeout.
- Threads conserva propuesta de formato, no nueva aprobación editorial. El helper
  offline ya lee `media.social.alt_text` y produce saltos de línea reales.
- TikTok sigue bloqueado por migración/verificación del CMS definitivo;
  YouTube Community y WhatsApp Channel siguen `SKIPPED/MANUAL_REQUIRED`.

Siguiente paso: importar v1.0.1 en un workflow de prueba **separado del Publisher**
y ejecutar `dry_run=true`. En paralelo, el chat principal debe aprobar el servicio
persistente que cumpla los requisitos de idempotencia; no se selecciona uno aquí.
Sólo después implementar store y adapters, empezando por el orden de habilitación
de `SOCIAL_INTEGRATION_CHECKLIST.md`. No activar publicaciones ni limpieza antes.

Debe construirse como workflow independiente y conectarse posteriormente al Publisher mediante contrato explícito. No crear un workflow monolítico.

Destinos previstos:
X, LinkedIn, Google Business Profile, Facebook, Instagram, Threads, TikTok, YouTube y WhatsApp Channel.

Cada rama debe ser independiente y terminar en `SUCCESS`, `FAILED` o `SKIPPED`.

YouTube Community y WhatsApp Channel deben permanecer `SKIPPED/MANUAL_REQUIRED` mientras no exista una vía oficial adecuada y aprobada.

## Reglas funcionales ya aprobadas
- X / LinkedIn / Google Business / Facebook / Instagram: `SUBTITULO + "\n\n" + URL_OPURO`.
- TikTok PHOTO: título = `TITULO_SEO`; descripción = `SUBTITULO`; sin URL_OPURO.
- YouTube deseado: `SUBTITULO + "\n\n" + URL_OPURO`; imagen derivada 1:1 con recorte alineado arriba, sin alterar el original.
- WhatsApp Channel: compartir URL_OPURO manualmente para generar link card.
- Threads: rama independiente. Su formato definitivo y API deben cerrarse durante diseño/implementación contra documentación oficial vigente.
- La imagen social original nunca debe alterarse para satisfacer otra plataforma; las transformaciones son copias derivadas.

## Principio arquitectónico
ChatGPT toma decisiones editoriales. n8n ejecuta y valida operaciones técnicas.

## Protocolo de hitos para Work
En CADA hito relevante:
1. Actualizar este archivo con estado, versión vigente y siguiente paso.
2. Actualizar `docs/SOCIAL_DISTRIBUTION_ARCHITECTURE.md` si cambia arquitectura o comportamiento.
3. Actualizar `docs/SOCIAL_PLATFORM_MATRIX.md` si cambia una plataforma, API, permiso o estado.
4. Versionar workflows JSON completos/importables; no documentar sólo fragmentos.
5. Registrar contratos nuevos o modificados en `contracts/`.
6. Dejar un resumen breve: hecho / probado / pendiente / bloqueos.
7. No declarar algo “probado” sin evidencia de ejecución.

## Siguiente hito
Prueba n8n nativa del preflight v1.0.1 y aprobación del almacén durable. Después,
claim atómico + staging WordPress + primer adapter real con verificación, sin
modificar Publisher. Faltan aprobación funcional del formato Threads y sus pruebas.


## Unificación Motor Editorial — 2026-10-23

Este repositorio también será el punto de convergencia versionado de los maestros del Motor Editorial OPMX. La migración se hace sin degradar componentes ya más nuevos de `main`.

Reglas:
- No sustituir `SALIDA_EDITORIAL_OPMX_v2.2.json`, `PROTOCOLO_EDITORIAL_OPMX_v4.2.md` ni otros contratos técnicos vigentes por archivos históricos sólo porque provengan de un chat anterior.
- Las cinco familias maestras del Motor se resuelven por versión semántica máxima; sufijos de copia no son versión.
- Los contextos `05_CONTEXTO_EDITORIAL_*.json` son opcionales y se resuelven por familia y versión semántica máxima.
- Hechos actuales verificados prevalecen sobre cualquier contexto editorial.
- `workflows/publisher/OPMX_Publisher_MEDIA_v1.2.12.json` es la versión vigente y validada; v1.2.11 permanece como rollback probado y v1.2.10 como baseline.
- `workflows/social/` permanece separado del Publisher y sigue el contrato Social activo.
- No reconstruir Template, CSS, Prompt Maestro, catálogo ni contrato MEDIA desde memoria. Su incorporación al repo debe hacerse desde el archivo fuente vigente exacto.


## Gutenberg editorial rendering — 2026-10-24

Se agregó `docs/GUTENBERG_EDITORIAL_RENDERING_CONTRACT_v1.0.md`: especificación del próximo adaptador Gutenberg del Publisher. Define bloques nativos, clases semánticas, separación entre contenido y chrome del frontend, UTF-8, validación de readback y compatibilidad OPURO/OPOL.

Estado: piloto visual verificado en OPURO con el borrador `post_id=2790` (“Claude Duet”). El Publisher vigente **no se ha modificado**: `SALIDA_EDITORIAL_OPMX_v2.2.json` sigue declarando `clean_html`. La migración a `gutenberg_blocks_v1` requiere una versión contractual y un workflow Publisher nuevos, pruebas de bloque y aprobación antes de activarse.


### Decisión adicional — cuerpo compartido

`GUTENBERG_EDITORIAL_RENDERING_CONTRACT_v1.0.md` ahora fija `content_gutenberg_v1` como futuro cuerpo editorial canónico compartido por OPURO y OPOL: un documento con bloques Gutenberg nativos, no un bloque HTML monolítico. El Motor entrega blueprint estructurado; Publisher serializa y valida; cada frontend aplica su piel de marca. Pendiente: contrato formal, Publisher vNext, serializador, pruebas y CSS de paridad OPOL.
