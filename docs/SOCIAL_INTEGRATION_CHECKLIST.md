# OPMX Social Distribution v1.0 — Checklist de integración

Actualizado: 2026-10-23
Alcance: **OPURO únicamente**

Este documento no contiene secretos. Los valores sensibles se crean y almacenan sólo en n8n o en el proveedor correspondiente.

## Orden de habilitación

1. WordPress OPURO — staging temporal de IMAGEN_SOCIAL.
2. Facebook + Instagram — misma infraestructura Meta, workers independientes.
3. Threads — worker ya versionado; credencial independiente.
4. LinkedIn.
5. Google Business Profile.
6. X.
7. TikTok — preparar worker, pero habilitar sólo tras migración/verificación de `cms.oxigenopuro.com.mx`.
8. YouTube Community y WhatsApp Channel — manual en v1.

## WordPress OPURO

Necesario:
- Variable n8n `OPMX_SOCIAL_WP_BASE_URL`.
- Credencial n8n lógica `OPMX Social WordPress`.
- Usuario técnico de WordPress con capacidad mínima para crear y posteriormente eliminar media.
- Application Password o mecanismo REST aprobado; nunca guardar el secreto en GitHub.
- Prueba: subir una IMAGEN_SOCIAL controlada, obtener `media_id` + `source_url`, comprobar GET público y eliminar el asset de prueba.

Migración:
- Hoy la variable puede apuntar al CMS OPURO vigente.
- Después se cambia a `https://cms.oxigenopuro.com.mx`.
- No modificar workflow por el cambio de hostname.

## Meta — Facebook

Necesario antes de habilitar:
- App de Meta Developer controlada por OPMX/Oxígeno Puro.
- Página de Facebook destino y rol administrativo suficiente.
- Page ID configurado como variable/credencial, no en contrato editorial.
- Token/credencial con permisos vigentes para publicar y verificar Page posts.
- Prueba aislada con una publicación no crítica y posterior lectura/verificación del ID/permalink.

Worker: pendiente de construir/probar.

## Meta — Instagram

Necesario antes de habilitar:
- Cuenta profesional de Instagram elegible y correctamente vinculada al ecosistema Meta requerido.
- Identificador de cuenta configurado fuera del repositorio.
- Permisos vigentes de Content Publishing.
- IMAGEN_SOCIAL accesible públicamente desde WordPress durante el proceso de creación/publicación.
- Prueba aislada: crear container, publicar, recuperar/verificar media publicada.

Worker: pendiente de construir/probar.

## Threads

Necesario:
- App/credencial OAuth de Threads.
- Threads user ID fuera del repositorio.
- Permiso vigente de publicación de contenido.
- Variable de versión/base API si aplica.
- URL pública de IMAGEN_SOCIAL.

Worker existente: `workflows/social/OPMX_SOCIAL_THREADS_v1.0.json`.
Estado: versionado, no probado contra cuenta real.

## LinkedIn

Necesario:
- Aplicación LinkedIn Developer.
- Página/organización de Oxígeno Puro y usuario autenticador con rol elegible.
- Permiso `w_organization_social` para publicar como organización.
- Organization URN/ID fuera del contrato editorial.
- Headers `Linkedin-Version` y `X-Restli-Protocol-Version: 2.0.0`.
- Flujo de upload de imagen + Posts API.
- Prueba aislada y lectura/verificación del post.

Worker: pendiente de construir/probar.

## Google Business Profile

Necesario:
- Proyecto Google Cloud/API con acceso a Google Business Profile APIs.
- OAuth 2.0.
- Scope recomendado vigente: `https://www.googleapis.com/auth/business.manage`.
- Account ID y Location ID fuera del repositorio.
- Publicación mediante `accounts.locations.localPosts.create`.
- Formato OPMX: SUBTITULO + media + CTA hacia URL_OPURO.
- Prueba aislada y lectura posterior del LocalPost.

Worker: pendiente de construir/probar.

## X

Necesario:
- Proyecto/App en X Developer.
- Acceso vigente que permita creación de Posts y upload de media.
- OAuth de usuario con permisos de escritura.
- User/account ID sólo en configuración.
- Verificar límites/costo del tier vigente antes de habilitar producción.
- Prueba aislada: upload media → create Post → recuperar/verificar Post.

Worker: pendiente de construir/probar.

## TikTok

Preparar, no habilitar todavía:
- TikTok Developer app.
- Content Posting API.
- `video.publish` y requisitos de auditoría vigentes.
- PHOTO post: TITULO_SEO + SUBTITULO; sin URL_OPURO.
- PULL_FROM_URL desde WordPress.
- Verificar el dominio/prefijo definitivo `cms.oxigenopuro.com.mx` después de la migración.

Estado: BLOCKED_BY_CMS_MIGRATION_AND_DOMAIN_VERIFICATION.

## YouTube Community

Estado v1: `SKIPPED / MANUAL_REQUIRED`.
Preparar copy y derivado 1:1 top-aligned, pero no simular publicación automática sin API oficial adecuada.

## WhatsApp Channel

Estado v1: `SKIPPED / MANUAL_REQUIRED`.
Operación: compartir URL_OPURO para generar link card.

## Pruebas mínimas por plataforma

Una plataforma sólo cambia a ENABLED después de:
1. Autenticación válida.
2. Precheck de identidad/cuenta.
3. Publicación controlada.
4. Confirmación del ID remoto.
5. Verificación de lectura/permalink cuando la API lo permita.
6. Prueba de idempotencia: repetir el mismo evento no crea duplicado.
7. Error controlado: fallo de esa plataforma no cancela las demás.
8. Evidencia registrada en handoff; nunca declarar probado sólo por importación del JSON.

## Nombres lógicos de credenciales n8n

- `OPMX Social WordPress`
- `OPMX Social Meta Facebook`
- `OPMX Social Meta Instagram`
- `OPMX Threads API`
- `OPMX Social LinkedIn`
- `OPMX Social Google Business`
- `OPMX Social X`
- `OPMX Social TikTok`

## Variables no secretas previstas

- `OPMX_SOCIAL_WP_BASE_URL`
- `OPMX_FACEBOOK_PAGE_ID`
- `OPMX_INSTAGRAM_ACCOUNT_ID`
- `THREADS_USER_ID`
- `THREADS_API_BASE_URL`
- `OPMX_LINKEDIN_ORGANIZATION_URN`
- `OPMX_LINKEDIN_VERSION`
- `OPMX_GBP_ACCOUNT_ID`
- `OPMX_GBP_LOCATION_ID`
- `OPMX_X_USER_ID`

Los IDs pueden considerarse configuración, pero se mantienen fuera del contrato editorial para separar contenido de infraestructura.
