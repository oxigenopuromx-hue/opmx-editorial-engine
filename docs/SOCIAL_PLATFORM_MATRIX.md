# OPMX Social Distribution — Matriz de plataformas

Estado: **v1.0 — investigación oficial 2026-10-23; sólo Threads tiene worker técnico versionado**

| Plataforma | Formato aprobado | Ruta / autenticación a validar al habilitar | Estado v1 |
|---|---|---|---|
| X | `SUBTITULO + \n\n + URL_OPURO` + imagen | `POST /2/tweets`; upload de media separado. Usuario OAuth 1.0a o OAuth 2.0 PKCE. App aprobada y acceso comercial de X requerido. | Diseño; no probado |
| LinkedIn | Copy aprobado + imagen | Posts API `POST /rest/posts`; OAuth 2.0. Organización: `w_organization_social` y rol elegible; miembro: `w_member_social`. Header `Linkedin-Version` obligatorio. | Diseño; no probado |
| Google Business Profile | Copy aprobado + foto + CTA URL | `accounts.locations.localPosts.create`; OAuth 2.0 `business.manage`. Proyecto y acceso GBP requieren aprobación; Location ID y cuenta se configuran en n8n. | Diseño; no probado |
| Facebook | Copy aprobado + imagen | Pages API. Page token; `pages_manage_posts`, `pages_read_engagement`, `pages_show_list` y los permisos/revisión aplicables. | Diseño; no probado |
| Instagram | Copy aprobado + imagen | Instagram Content Publishing: crear media container y publicar; permisos y cuenta profesional vinculada requeridos. URL pública del asset. | Diseño; no probado |
| Threads | `SUBTITULO + \n\n + URL_OPURO` + imagen original | Threads API OAuth 2.0 `threads_content_publish`; `POST /{threads-user-id}/threads`, luego `/{threads-user-id}/threads_publish`. Requiere URL pública para `image_url`. | Worker versionado; no publicado en vivo |
| TikTok | PHOTO; título `TITULO_SEO`; descripción sólo `SUBTITULO`; sin URL | Content Posting API `POST /v2/post/publish/content/init/`; OAuth `video.publish`. Consulta previa de creator info; dominio/prefijo verificado; cliente auditado para posts públicos. | Diseño; no probado |
| YouTube Community | Copy aprobado + derivado 1:1 top-aligned | YouTube Data API no expone un método de creación de Community posts en la referencia vigente. | `SKIPPED / MANUAL_REQUIRED` |
| WhatsApp Channel | Compartir `URL_OPURO` para generar link card | No se habilita sin una API oficial de publicación de Channels que se valide y apruebe. | `SKIPPED / MANUAL_REQUIRED` |

## Media y límites conocidos

- Threads, Instagram y TikTok consumen o requieren URLs públicas accesibles por sus servidores; TikTok exige además dominio/prefijo verificado para `PULL_FROM_URL`.
- TikTok Photo admite hasta 35 imágenes, título máximo de 90 unidades UTF-16 y descripción máxima de 4,000; el límite de init por token es seis solicitudes por minuto. OPMX usará una imagen por post.
- El worker debe tomar opciones y límites de la respuesta de creator info de TikTok, no codificarlos como constantes editoriales.

## Fuentes oficiales verificadas

- X: [Create Posts](https://docs.x.com/x-api/posts/create-post) y [Upload media](https://docs.x.com/x-api/media/upload-media).
- LinkedIn: [Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api) y [Authorization Code Flow](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow).
- Google: [Create Posts on Google](https://developers.google.com/my-business/content/posts-data) y [OAuth](https://developers.google.com/my-business/content/implement-oauth).
- Meta: [Pages API](https://developers.facebook.com/documentation/pages-api), [Instagram publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing) y [Threads API](https://developers.facebook.com/docs/threads/).
- TikTok: [Photo Content Posting API](https://developers.tiktok.com/docs/en/content-posting-api-reference-photo-post).
- YouTube: [Data API reference](https://developers.google.com/youtube/v3/docs/).

## Regla

Facebook, Instagram y Threads mantienen ramas, permisos, credenciales, idempotencia y resultados independientes. No se infiere una capacidad de API por pertenecer al mismo proveedor.
