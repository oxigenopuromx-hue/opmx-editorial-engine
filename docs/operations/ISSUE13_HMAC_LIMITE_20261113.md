# Issue13 — límite de comprobación HMAC sin publicar contenido

Corte: 13nov2026 UTC. Revisión técnica de sólo lectura del commit de referencia productiva `bf94246d2f823056c3644e4d951507ad06d45783`, repositorio `oxigenopuromx-hue/oxigeno-puro-com-mx`. No se modificó producción, no se llamó al endpoint de revalidación y no se consultó ningún secreto.

## Conclusión

No existe en el código revisado un disparador REST o administrativo que permita a la autenticación WordPress Basic ya utilizada por n8n pedir una prueba HMAC y devolver el HTTP observado sin modificar contenido u opciones. El plugin dispone de una función PHP interna para enviar el aviso firmado, pero no la publica como endpoint ni como comando WP-CLI y tampoco devuelve el código HTTP.

Una autenticación de Publisher contra Next o una firma con la clave de Publisher sólo probaría esa otra vía: no acreditaría el emisor WordPress ni la clave independiente de WordPress.

## Evidencia de código

- [Plugin de revalidación, líneas104–114](https://github.com/oxigenopuromx-hue/oxigeno-puro-com-mx/blob/bf94246d2f823056c3644e4d951507ad06d45783/wordpress/opmx-editorial-revalidation/opmx-editorial-revalidation.php#L104): `opmx_revalidation_send($payload)` toma la clave de la constante o entorno `OPMX_REVALIDATION_SECRET`, firma timestamp+cuerpo y usa `wp_remote_post` hacia `https://oxigenopuro.com.mx/api/revalidate/`. Sólo registra un fallo genérico si no recibe200; no devuelve estado al llamante. Blob Git: `76918c88c99329bd0d6090c2588e10629adc8c7a`.
- En el mismo plugin, líneas16–19/59–70/96–102: un borrador nuevo o un cambio de metadatos de un borrador no se considera entrada pública y no dispara la cola de story. El QA desechable REST de un borrador no prueba ese aviso.
- En el mismo plugin, líneas88–95: cambiar opciones `oxpuro_home` o `oxpuro_category_home_<ID>` sí puede programar un aviso. Es una modificación editorial de producción y queda fuera de esta subtarea; no se hizo.
- En el mismo plugin, línea135: el envío agrupado se ejecuta en el hook `shutdown`. No hay `register_rest_route`, `admin_post`, `wp_ajax` ni `WP_CLI::add_command` para una prueba manual.
- [Next receptor, líneas28–56](https://github.com/oxigenopuromx-hue/oxigeno-puro-com-mx/blob/bf94246d2f823056c3644e4d951507ad06d45783/app/api/revalidate/route.ts#L28): `WORDPRESS_REVALIDATION_SECRET` admite HMAC; `REVALIDATION_SECRET` admite HMAC o Bearer. La respuesta200 aplica tags y rutas y devuelve `revalidated:true`. Blob Git: `afe06fc35f8e1e4494018121ec996a2d740c4b74`.
- [API Core, líneas290–336](https://github.com/oxigenopuromx-hue/oxigeno-puro-com-mx/blob/bf94246d2f823056c3644e4d951507ad06d45783/wordpress/oxigeno-puro-core/includes/api.php#L290): las rutas registradas son health, categorías, home y stories; no hay ruta de prueba de firma o revalidación. Blob Git: `739ece956b17e087062e4572c0f638dfaa3160dd`.
- [Contrato/estado histórico](https://github.com/oxigenopuromx-hue/oxigeno-puro-com-mx/blob/bf94246d2f823056c3644e4d951507ad06d45783/docs/portadas-categoria-y-cache.md): el disparador fue actualizado y la clave configurada el5nov, pero la prueba realizada desde WordPress respondió401 con el frontend anterior. Ese registro no prueba el estado actual de los secretos ni del proceso web.

## Ruta no destructiva condicionada a acceso ya existente

Si el coordinador dispone YA de una sesión WP-CLI/SSH autenticada al CMS correcto, puede invocar la función real `opmx_revalidation_send(['scope'=>'home'])`, sin leer ni imprimir la clave, y observar únicamente el código de respuesta mediante un listener PHP temporal en memoria sobre `http_api_debug`. La salida debe limitarse al destino fijo, código HTTP, indicador de error y que no hubo cambios de contenido. No serializar argumentos HTTP, encabezados, firmas, constantes ni entorno.

Esta llamada sólo invalida la caché de portada; no publica ni edita una nota o una opción. No requiere crear un webhook nuevo ni instalar código. No se ejecutó aquí porque la subtarea fue de sólo lectura y los conectores disponibles revisados no ofrecen ejecución PHP/WP-CLI.

Un200 de esa llamada acreditaría PHP WordPress CLI→Vercel con firma interna. NO demostraría por sí solo que el proceso WEB del CMS ve la misma configuración ni que un hook real de publicación/meta genera correctamente el aviso. Para acreditar esa afirmación adicional hace falta observar una petición web autorizada, con contenido de prueba específicamente autorizado o un mecanismo diagnóstico existente verificado; no se inventó ninguno.

## Límite operativo a documentar

`hmacInvalidationObserved:false` sigue siendo la descripción fiel de las pruebas del task actual. El QA de exclusiones REST y las lecturas públicas aprobadas no equivalen a la entrega HMAC real WordPress WEB→Vercel. No se publicó contenido de prueba, no se editaron notas reales, no se cambiaron opciones y no se extrajeron secretos.

La lectura de GitHub certifica el código del commit indicado; no acredita que los bytes del plugin actualmente instalado en Hostinger coincidan exactamente con ese blob.
