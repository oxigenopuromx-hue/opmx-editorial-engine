# Configuración de revalidación OPURO v1.0

## Propósito

`OPMX_Publisher_MEDIA_v1.3.2_GUTENBERG_REVALIDATE.json` conserva el flujo v1.3.1 y agrega una operación final, sólo después de que WordPress confirma `publish` en OPURO:

1. construye el alcance exacto de caché (portada, nota y categoría resuelta);
2. firma el cuerpo con HMAC-SHA256;
3. hace `POST` al endpoint interno del frontend;
4. devuelve las rutas y etiquetas invalidadas dentro de `Resultado OPURO`.

No corre al crear borradores. No cambia el contenido, slug, autor, imágenes ni las credenciales WordPress existentes.

## Variables seguras requeridas

Crear las dos variables de n8n antes de importar o activar la versión 1.3.2:

| Variable | Valor |
| --- | --- |
| `OPMX_OPURO_REVALIDATION_URL` | `https://oxigenopuro.com.mx/api/revalidate` |
| `OPMX_OPURO_REVALIDATION_SECRET` | el mismo valor secreto que `REVALIDATION_SECRET` del proyecto Vercel `oxigeno-puro-com-mx` en Production |

El secreto no debe pegarse en el workflow, GitHub, una nota editorial, ni el JSON MASTER. Use un valor aleatorio largo guardado únicamente como variable secreta en ambos sistemas.

## Secuencia de adopción

1. Añadir `REVALIDATION_SECRET` en Vercel Production.
2. Desplegar el PR del frontend que contiene `/api/revalidate` y la política de caché.
3. Crear ambas variables n8n.
4. Importar este archivo como workflow nuevo. No reemplazar ni borrar v1.3.1 hasta completar la prueba.
5. Confirmar que la variable `OPMX_OPURO_REVALIDATION_SECRET` no se muestra en la salida de nodos.
6. Publicar una nota de prueba OPURO y comprobar que la respuesta final contiene `cache_revalidation.status: "SUCCESS"`.
7. Abrir portada, la nota y su categoría en ventana privada. La actualización debe verse en segundos; 15–30 segundos es el margen operativo previsto.

## Comportamiento ante error

La publicación WordPress ocurre antes de la revalidación. Si la llamada firmada falla después de tres intentos, el Publisher muestra un error explícito en lugar de afirmar que la caché se actualizó. La nota puede ya estar publicada: corregir la variable o conectividad y ejecutar una invalidación equivalente antes de comunicar la publicación.

## Seguridad

El endpoint acepta exclusivamente una firma HMAC-SHA256 del texto exacto enviado y rechaza timestamps antiguos. El workflow usa el nodo Crypto nativo de n8n con salida hexadecimal; no requiere módulos externos ni credenciales nuevas de WordPress.
