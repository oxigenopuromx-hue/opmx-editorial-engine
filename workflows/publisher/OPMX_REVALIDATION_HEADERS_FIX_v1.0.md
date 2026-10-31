# Corrección de revalidación OPURO v1.3.4 / Recovery v1.1

Estas versiones corrigen la serialización de encabezados del nodo HTTP de n8n.

En **Specify Headers → Using JSON**, n8n requiere un texto JSON válido. La expresión anterior devolvía un objeto JavaScript. La expresión corregida usa `JSON.stringify(...)` y entrega:

- `x-oxpuro-timestamp`
- `x-oxpuro-signature`

Actualiza a `OPMX_Publisher_MEDIA_v1.3.4_GUTENBERG_REVALIDATE.json` para publicaciones futuras y usa `OPMX_OPURO_MANUAL_CACHE_RECOVERY_v1.1.json` sólo para recuperar una publicación ya confirmada.
