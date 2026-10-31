# Recuperación manual de caché pública OPURO v1.0

Este flujo es una herramienta manual y **no se activa** ni publica contenido. Sólo llama al endpoint firmado de revalidación del frontend.

## Uso inmediato

1. Importa `OPMX_OPURO_MANUAL_CACHE_RECOVERY_v1.0.json` en n8n.
2. Conserva las variables de proyecto existentes:
   - `OPMX_OPURO_REVALIDATION_URL`
   - `OPMX_OPURO_REVALIDATION_SECRET`
3. En `Indicar nota a refrescar`, confirma o sustituye `slug` y `category_slug`.
4. Pulsa **Execute Workflow** manualmente.
5. Debe concluir en `Confirmar resultado` con `status: SUCCESS` y la respuesta `revalidated: true`.

No requiere credenciales de WordPress y no crea, edita, publica ni duplica posts.
