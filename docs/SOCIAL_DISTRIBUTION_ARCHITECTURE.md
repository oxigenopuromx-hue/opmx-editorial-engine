# OPMX Social Distribution Engine — Arquitectura v1 / revisión técnica v1.0.1

Estado: **PREFLIGHT OFFLINE PROBADO — sin prueba n8n nativa ni publicación real**
Actualizado: 2026-10-25

## Objetivo y límite

Social v1 recibe únicamente una nota OPURO cuya publicación ya fue confirmada. Fase 1 distribuye exclusivamente `oxigenopuro.com.mx`; OPOL y `oxigenopuro.mx` quedan fuera. No redacta, altera copy, decide target ni modifica el Publisher. `IMAGEN_SOCIAL` es un tercer asset independiente de HERO e interiores: se crea manualmente en Canva después del flujo editorial y se entrega como archivo/binario.

## Componentes versionados

| Componente | Archivo | Responsabilidad |
|---|---|---|
| Coordinador | `workflows/social/OPMX_SOCIAL_DISTRIBUTION_ENGINE_v1.0.1.json` | Valida entrada, deriva claves, devuelve nueve estados de preflight y consolida salida. No llama staging ni APIs. |
| Media staging | `workflows/social/OPMX_SOCIAL_MEDIA_STAGING_v1.0.1.json` | Inspección offline opcional de firma/hash del binario y metadata; no upload ni limpieza. |
| Threads | `workflows/social/OPMX_SOCIAL_THREADS_v1.0.1.json` | Preflight con gate live cerrado; publicación, polling y readback siguen pendientes. |

Cada export empieza con Execute Sub-workflow Trigger y permanece desactivado.
El coordinador de preflight es autosuficiente: no requiere credenciales ni IDs de
children. Su único Merge tiene nueve inputs y cada rama retorna un resultado,
incluso cuando está deshabilitada. Los workers reales se conectarán mediante
Execute Sub-workflow en una revisión posterior, después del store durable.

Los exports v1.0 anteriores son históricos con inconsistencias conocidas, no una
alternativa para publicar; no activarlos. Ver `changelog/SOCIAL_v1.0.1.md`.

## Contrato de frontera

`contracts/SOCIAL_DISTRIBUTION_CONTRACT_v1.0.1.json` es la revisión técnica activa
de entrada/salida; el wire de entrada mantiene versión `1.0`. Exige
`source_site=OPURO`. La integración futura desde Publisher será un adaptador que
construya este evento **después** de leer la publicación válida de WordPress.
El fragmento `social_contract` histórico del Publisher no cumple esta frontera;
no se conecta directamente ni se modifica Publisher para acomodarlo.

Entrada: event y post IDs, publicación confirmada, URL final OPURO, texto aprobado,
`media.social` (descriptor del archivo manual), nueve targets y execution con
boolean `dry_run` obligatorio. Hash opcional calculable sobre el archivo. El
preflight de metadatos no demuestra publicación previa ni permisos de imagen.
Antes de live se verificará WordPress; no basta confiar en `published_at`.
Entrada/salida se validan con JSON Schema 2020-12 empaquetado en los Code nodes.
La salida contiene exactamente una entrada por cada una de las nueve plataformas.

## Flujo implementado en v1.0.1

Validar contrato → nueve preflights independientes → Merge append 9 inputs →
consolidado validado. No existe paso de upload/HTTP en esta revisión.

Targets automáticos habilitados en simulación: `SKIPPED/DRY_RUN`. Intentar live:
`FAILED/LIVE_BLOCKED` y cero intentos, sin override por payload/configuración.
YouTube y WhatsApp siempre `SKIPPED/MANUAL_REQUIRED`; otros deshabilitados,
`SKIPPED/DISABLED`. Envelope `SUCCESS` significa cero fallos, no publicación:
el dry run devuelve `summary.success=0`, `summary.skipped=9`.

Patrón objetivo de cada worker real (todavía no implementado):

`SHOULD_PUBLISH → IDEMPOTENCY_CHECK → PRECHECK → PUBLISH → VERIFY → SUCCESS | FAILED | SKIPPED`

Una rama nunca debe cancelar otra. Las únicas pruebas realizadas hasta ahora son
offline, no se afirma aislamiento ante fallos API reales o scheduling n8n nativo.

## Media staging v1 — WordPress temporal

Diseño aprobado, pendiente de implementación live: n8n subirá `IMAGEN_SOCIAL`
temporalmente a la Media Library del WordPress OPURO. No se insertará en Gutenberg
ni se asignará como featured image. Se conservarán `wordpress_media_id`,
`public_url`, `uploaded_at` y `cleanup_after`. En preflight todos siguen null.

La base del CMS vive en la variable `OPMX_OPURO_WP_BASE_URL`; no se codifica el dominio. Al completar la migración se cambia a `https://cms.oxigenopuro.com.mx` sin modificar el workflow. Retención inicial: 7 días tras la distribución terminada; la limpieza será un workflow separado y sólo podrá eliminar assets SOCIAL identificados por su media ID.

No empezar el plazo desde el upload ni borrar si hay operaciones/reconciliaciones
pendientes. El helper offline comprueba firma básica (no decodifica la imagen),
hash del binario, hash declarado opcional y genera un filename seguro. No carga
archivos ni inventa una URL pública.

TikTok queda bloqueado hasta que el CMS definitivo esté operativo y su dominio/prefijo sea verificado. Este bloqueo no detiene X, LinkedIn, Google Business Profile, Facebook, Instagram ni Threads. Cloudflare/R2 no forma parte de Fase 1.

## Threads v1 — propuesta y pendientes

El formato propuesto sigue siendo subtítulo + línea en blanco + URL_OPURO,
con imagen social sin modificar. El handoff conserva pendiente su aprobación
funcional. El helper `threadsPreview()` usa `media.social.alt_text` y saltos de
línea reales; sólo prepara payload offline, no publica. Flujo futuro a revalidar:

1. `POST https://graph.threads.net/v{version}/{threads-user-id}/threads` con `media_type=IMAGE`, `image_url`, `text` y `alt_text`.
2. Conserva el `creation_id` retornado.
3. `POST .../{threads-user-id}/threads_publish` con `creation_id`.
4. Lee el objeto publicado y guarda ID/permalink para verificación.

Autenticación: OAuth 2.0 de Threads con `threads_content_publish`; la configuración y renovación del token viven exclusivamente en la credencial n8n `OPMX Threads API`. No se reutiliza el token de Facebook o Instagram por similitud de proveedor.

## Idempotencia y reintentos

**Objetivo pendiente, no garantía implementada.** v1.0.1 calcula las claves pero
no las persiste: repetición de un dry run sólo produce otro preflight, no un post.

- Clave por resultado: `sha256(event_id + ":" + platform + ":" + social_contract_version)`.
- El registro persistente será una tabla/colección `social_distribution_runs` con índice único `(platform, idempotency_key)`; no se usa memoria de ejecución de n8n como evidencia de deduplicación.
- Antes de llamar a la API se consulta ese registro. Un `SUCCESS` previo devuelve `SKIPPED/DUPLICATE`; una ejecución en curso se bloquea temporalmente.
- Reintentos automáticos: máximo 3 para 408, 429 y 5xx, con backoff exponencial y jitter. No reintentar 4xx de validación, permisos, media ni políticas.
- Si una llamada puede haber publicado y la respuesta se perdió, el worker debe verificar por `provider_request_id`/ID conocido antes de reintentar. No repetir a ciegas un POST de publicación.

## Bloqueo de almacenamiento durable

La arquitectura necesita una decisión aprobada sobre el almacén de
`social_distribution_runs` y alertas. **No se eligió ni se creó uno en este hito**.
La interfaz debe cumplir `docs/SOCIAL_DURABLE_STORE_REQUIREMENTS.md`, en especial
claim atómico, fingerprint, checkpoints y reconciliación después de un timeout
ambiguo. El coordinador v1.0.1 es apto sólo para preflight; no hay live configurable.
Consolidar nueve resultados en memoria durante el preflight no es persistencia.

## Observabilidad

Cada evento usa `correlation_id` y emite un resultado por plataforma con: estado, clave idempotente, intentos, marcas de tiempo, request ID del proveedor, ID/permalink del post, URL del asset y error normalizado sin token. n8n debe conservar los execution logs y enviar los fallos a un canal de alerta que se definirá fuera de este repositorio.

## Seguridad

Las credenciales, IDs de cuenta, URLs internas, tokens y secret keys viven en n8n/gestor de secretos. El repositorio sólo contiene nombres lógicos de credenciales, contratos y workflows importables.
