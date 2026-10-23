# OPMX Social Distribution Engine — Arquitectura v1.0

Estado: **IMPLEMENTACIÓN BASE — sin credenciales ni publicación real**
Actualizado: 2026-10-23

## Objetivo y límite

Social v1 recibe únicamente una nota OPURO cuya publicación ya fue confirmada. Fase 1 distribuye exclusivamente `oxigenopuro.com.mx`; OPOL y `oxigenopuro.mx` quedan fuera. No redacta, altera copy, decide target ni modifica el Publisher. `IMAGEN_SOCIAL` es un tercer asset independiente de HERO e interiores: se crea manualmente en Canva después del flujo editorial y se entrega como archivo/binario.

## Componentes versionados

| Componente | Archivo | Responsabilidad |
|---|---|---|
| Coordinador | `workflows/social/OPMX_SOCIAL_DISTRIBUTION_ENGINE_v1.0.json` | Validar, derivar claves de idempotencia, preparar staging y despachar ramas aisladas. La consolidación durable se habilita al aprobar el almacén de resultados. |
| Media staging | `workflows/social/OPMX_SOCIAL_MEDIA_STAGING_v1.0.json` | Copiar el original sin alterarlo a un objeto público, inmutable y de dominio verificado. |
| Threads worker | `workflows/social/OPMX_SOCIAL_THREADS_v1.0.json` | Publicar una imagen de Threads en el flujo oficial contenedor → publicación. |

Cada workflow se importa de forma independiente. El coordinador se conecta a los workers sólo después de importar, guardar sus IDs y configurar las referencias `Execute Workflow` en n8n; esos IDs son de entorno y nunca se versionan.

## Contrato de frontera

`contracts/SOCIAL_DISTRIBUTION_CONTRACT_v1.0.json` es el contrato activo de entrada/salida y exige `source_site=OPURO` en Fase 1. La integración futura desde Publisher será un adaptador que construya este evento **después** de leer la publicación válida de WordPress. No se modifica Publisher para acomodar Social.

El contrato exige `event_id`, `publisher_run_id`, `source_post_id`, URL pública final, texto aprobado, URL del original, SHA-256, derechos aprobados, targets explícitos e `idempotency_key`. El resultado entrega exactamente un registro por cada una de las nueve plataformas.

## Flujo definitivo

```mermaid
flowchart TD
    A["Evento post-publicación"] --> B["Validar contrato"]
    B --> C["Staging de original"]
    C --> D["Workers por plataforma"]
    D --> E["Resultados normalizados"]
    E --> F["Resultado consolidado"]
```

Patrón fijo de cada worker:

`SHOULD_PUBLISH → IDEMPOTENCY_CHECK → PRECHECK → PUBLISH → VERIFY → SUCCESS | FAILED | SKIPPED`

Una rama nunca cancela otra. `SKIPPED` se utiliza solamente cuando el target está deshabilitado o su política exige operación manual; una plataforma habilitada que carezca de credencial o precheck se reporta `FAILED`.

## Media staging v1 — WordPress temporal

n8n sube `IMAGEN_SOCIAL` temporalmente a la Media Library del WordPress OPURO. No se inserta en Gutenberg ni se asigna como featured image. El workflow conserva `wordpress_media_id`, `public_url`, `uploaded_at` y `cleanup_after`.

La base del CMS vive en la variable `OPMX_OPURO_WP_BASE_URL`; no se codifica el dominio. Al completar la migración se cambia a `https://cms.oxigenopuro.com.mx` sin modificar el workflow. Retención inicial: 7 días tras la distribución terminada; la limpieza será un workflow separado y sólo podrá eliminar assets SOCIAL identificados por su media ID.

TikTok queda bloqueado hasta que el CMS definitivo esté operativo y su dominio/prefijo sea verificado. Este bloqueo no detiene X, LinkedIn, Google Business Profile, Facebook, Instagram ni Threads. Cloudflare/R2 no forma parte de Fase 1.

## Threads v1

La rama Threads publica una imagen sin modificar con el copy aprobado `SUBTITULO + "\\n\\n" + URL_OPURO`:

1. `POST https://graph.threads.net/v{version}/{threads-user-id}/threads` con `media_type=IMAGE`, `image_url`, `text` y `alt_text`.
2. Conserva el `creation_id` retornado.
3. `POST .../{threads-user-id}/threads_publish` con `creation_id`.
4. Lee el objeto publicado y guarda ID/permalink para verificación.

Autenticación: OAuth 2.0 de Threads con `threads_content_publish`; la configuración y renovación del token viven exclusivamente en la credencial n8n `OPMX Threads API`. No se reutiliza el token de Facebook o Instagram por similitud de proveedor.

## Idempotencia y reintentos

- Clave por resultado: `sha256(event_id + ":" + platform + ":" + social_contract_version)`.
- El registro persistente será una tabla/colección `social_distribution_runs` con índice único `(platform, idempotency_key)`; no se usa memoria de ejecución de n8n como evidencia de deduplicación.
- Antes de llamar a la API se consulta ese registro. Un `SUCCESS` previo devuelve `SKIPPED/DUPLICATE`; una ejecución en curso se bloquea temporalmente.
- Reintentos automáticos: máximo 3 para 408, 429 y 5xx, con backoff exponencial y jitter. No reintentar 4xx de validación, permisos, media ni políticas.
- Si una llamada puede haber publicado y la respuesta se perdió, el worker debe verificar por `provider_request_id`/ID conocido antes de reintentar. No repetir a ciegas un POST de publicación.

## Bloqueo de almacenamiento durable

La arquitectura necesita una decisión aprobada sobre el almacén de `social_distribution_runs` y alertas. **No se eligió ni se creó uno en este hito**, porque no existe una fuente de verdad de infraestructura para Postgres/Neon, D1, Redis u otro servicio en `main`. El JSON del coordinador es importable como esqueleto de routing, pero no debe activarse en producción hasta que se configure ese store, se conecten los IDs de los subworkflows importados y se añada el consolidado sobre registros persistidos.

## Observabilidad

Cada evento usa `correlation_id` y emite un resultado por plataforma con: estado, clave idempotente, intentos, marcas de tiempo, request ID del proveedor, ID/permalink del post, URL del asset y error normalizado sin token. n8n debe conservar los execution logs y enviar los fallos a un canal de alerta que se definirá fuera de este repositorio.

## Seguridad

Las credenciales, IDs de cuenta, URLs internas, tokens y secret keys viven en n8n/gestor de secretos. El repositorio sólo contiene nombres lógicos de credenciales, contratos y workflows importables.
