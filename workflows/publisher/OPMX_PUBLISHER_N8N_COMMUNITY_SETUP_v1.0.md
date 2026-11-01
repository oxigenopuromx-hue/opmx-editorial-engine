# OPMX Publisher MEDIA v1.3.5 — n8n Community / Hostinger

Esta variante no depende de la función de pago **Variables** de n8n.

## Importación

1. Importa `OPMX_Publisher_MEDIA_v1.3.5_GUTENBERG_COMMUNITY.json`.

Para corregir únicamente un Gutenberg enriquecido ya publicado, importa `OPMX_OPURO_UPDATE_GUTENBERG_ENRIQUECIDO_v1.1_COMMUNITY.json`; también evita `$vars` y usa la misma credencial Bearer.
2. Asigna la credencial Basic Auth de WordPress a los nodos OPURO.
3. Asigna la credencial Basic Auth de OXígeno Político a sus nodos correspondientes, si se publica también en OPOL.
4. Crea y asigna la credencial de revalidación descrita abajo.

Las URLs no secretas están incluidas directamente en el workflow:

- CMS OPURO: `https://cms.oxigenopuro.com.mx`
- Revalidación pública: `https://oxigenopuro.com.mx/api/revalidate`

## Credencial de revalidación

En n8n crea una credencial **Header Auth** con este nombre exacto:

`OPURO — Revalidación Bearer`

Configúrala así:

- Header name: `Authorization`
- Header value: `Bearer <REVALIDATION_SECRET>`

El valor después de `Bearer ` debe ser idéntico al secreto privado `REVALIDATION_SECRET` configurado en Vercel para el frontend. Nunca lo copies al workflow, JSON, repositorio ni campos de formulario.

## Autenticación compatible

El endpoint del frontend acepta temporalmente dos mecanismos:

1. Firma HMAC original, para instalaciones existentes.
2. Bearer token, para n8n Community mediante la credencial Header Auth cifrada.

El Publisher v1.3.5 usa solamente Bearer. Después de confirmar la publicación OPURO, invalida portada, nota y categoría de manera autenticada.

## Verificación

Ejecuta primero una nota de prueba en borrador. Una publicación confirmada debe devolver:

- `cache_revalidation.status: SUCCESS`
- `revalidated: true`
- rutas de portada, nota y categoría.

No se requieren Variables de n8n ni una suscripción comercial de n8n.
