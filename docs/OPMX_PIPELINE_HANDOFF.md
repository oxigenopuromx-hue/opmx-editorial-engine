# OPMX Pipeline — Handoff maestro

Actualizado: 2026-10-23

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
Publisher operativo vigente: `OPMX Publisher MEDIA v1.2.11`, versionado en `workflows/publisher/`. `v1.2.10` se conserva como baseline exacto previo a la parametrización del CMS OPURO. v1.2.11 sustituyó únicamente los endpoints OPURO de WordPress por la variable canónica `OPMX_OPURO_WP_BASE_URL`; la rama OPOL permaneció intacta. El usuario ejecutó una publicación real completa el 2026-10-23 y confirmó que OPURO y OPOL terminaron correctamente. v1.2.11 queda como versión operativa vigente.

Regla: no modificar Publisher para resolver necesidades de Social salvo incompatibilidad contractual comprobada y aprobada.

### Social Distribution Engine
Estado: IMPLEMENTACIÓN BASE v1.0; ninguna plataforma ha sido publicada ni probada contra cuenta real.

Terminados en este hito:
- Contrato activo: `contracts/SOCIAL_DISTRIBUTION_CONTRACT_v1.0.json`.
- Arquitectura, política de media staging, idempotencia, reintentos y observabilidad documentadas.
- Matriz actualizada contra documentación oficial al 2026-10-23.
- Workflows n8n completos/importables en `workflows/social/`: coordinador de routing, media staging y worker de Threads. El coordinador es un esqueleto desactivado hasta resolver almacenamiento durable y conectar IDs de subworkflows.
- Integración de Threads descrita y codificada contra el flujo oficial create container → publish; sigue sin prueba real hasta configurar OAuth/usuario/asset staging.

Probado en este hito:
- Parseo JSON de los contratos y los tres exports de workflow.
- Verificación estática de grafo: cada conexión apunta a un nodo existente y cada nodo contiene metadatos de importación.
- `git diff --check` sin errores de whitespace.
- Social Distribution todavía no tiene prueba real contra plataformas. Publisher v1.2.11 sí fue probado en una ejecución real completa en n8n el 2026-10-23: OPURO resolvió `OPMX_OPURO_WP_BASE_URL` y OPURO/OPOL terminaron correctamente.

No terminado / bloqueos:
- No hay credenciales n8n, IDs de cuenta/ubicación, bucket R2, dominio público verificado ni registros de idempotencia en este repositorio. Por ello no existe prueba de publicación real.
- Está pendiente aprobar y provisionar el almacén durable de `social_distribution_runs`; sin ello no se activa el coordinador ni se afirma idempotencia efectiva.
- Fase 1 de Social Distribution es exclusivamente OPURO (`oxigenopuro.com.mx`). `IMAGEN_SOCIAL` es un tercer asset manual creado en Canva después del flujo editorial; no es HERO ni imagen interior.
- Media staging v1 usa temporalmente WordPress OPURO, no R2: n8n sube `IMAGEN_SOCIAL`, obtiene `wordpress_media_id` + URL pública y la conserva inicialmente 7 días. El CMS se configura con `OPMX_OPURO_WP_BASE_URL`.
- Cuando el CMS migre a `cms.oxigenopuro.com.mx`, se cambia esa variable y se verifica el dominio/prefijo para TikTok. TikTok queda bloqueado por esa configuración, sin bloquear las demás ramas.
- X, LinkedIn, Google Business Profile, Facebook, Instagram y TikTok están documentados, pero sus workers no se activan hasta configurar acceso, permisos y una prueba aislada por plataforma.
- YouTube Community y WhatsApp Channel continúan `SKIPPED / MANUAL_REQUIRED`.

Siguiente paso técnico: configurar credenciales n8n de WordPress OPURO y de las plataformas, importar los workflows, conectar coordinador/staging/workers y ejecutar un `dry_run`. Después probar ramas automáticas de forma aislada. TikTok se habilitará tras la migración a `cms.oxigenopuro.com.mx` y la verificación requerida.

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
Cerrar especificación funcional de Social Distribution v1.0, incluyendo Threads, contrato de entrada/salida, estrategia de media staging y matriz API/autenticación. Después construir el workflow en Work.
