# Instrucción OPMX — Gutenberg enriquecido OPURO v1.1

Aplica esta instrucción junto con el Prompt Maestro vigente y el Contrato de Salida OPMX v1.4. No sustituye sus reglas editoriales, SEO, fuentes, categorías ni el HTML de archivo.

## Salidas obligatorias

Cada MASTER JSON debe contener representaciones equivalentes de la versión final de `TEXTO_EDITORIAL`:

- `HTML_FINAL`: documento completo OPURO, conservado para archivo, revisión y compatibilidad.
- `GUTENBERG_FINAL`: cuerpo portable OPOL en bloques nativos.
- `GUTENBERG_ENRIQUECIDO_FINAL`: cuerpo OPURO que publica el Publisher MEDIA.

## Estructura editorial visible de GUTENBERG_ENRIQUECIDO_FINAL

Serializa en este orden, sin repetir el título, subtítulo, metadatos, autor, hero o imagen destacada:

1. H2 `En breve` seguido de una lista nativa con las 2 a 4 viñetas factuales de `TEXTO_EDITORIAL.EN_BREVE`.
2. Entradilla y secciones periodísticas desde `TEXTO_EDITORIAL`.
3. Si `TEXTO_EDITORIAL.CIERRE` tiene contenido: H2 `Cierre editorial` seguido de un bloque `core/quote` o `core/paragraph`, según el tono real del texto.
4. Si `FUENTES` contiene fuentes: H2 `Fuentes` seguido de una lista nativa cuyos elementos enlacen el nombre de cada fuente a su URL verificable.

No inventes viñetas, cierre, fuentes, URLs ni créditos. Si `FUENTES` está vacío, omite por completo la sección `Fuentes`. El cierre sólo se omite cuando el campo canónico sea `null`.

## Reglas técnicas

- Emite Gutenberg serializado: comentarios `<!-- wp:* -->` y HTML de los bloques.
- Sólo se permiten `core/paragraph`, `core/heading`, `core/list`, `core/quote` y `core/image`.
- Los headings son exclusivamente H2 o H3. Nunca emitas H1.
- No incluyas masthead, título, subtítulo, metadatos, hero, imagen destacada, autor, etiquetas, botones de compartir, footer, wrappers `article/header/footer`, clases estructurales OPMX, `wp:html` ni placeholders `{{…}}`.
- Las secciones `En breve`, `Cierre editorial` y `Fuentes` forman parte del cuerpo editorial OPURO; no son footer ni wrapper.
- HERO_OPURO y DESTACADA_OPURO son adjuntos nativos administrados por el Publisher; no se insertan en `post_content`.
- No uses `core/image` hasta que exista un binding de adjunto WordPress real. Con binding real, cada imagen requiere `wp-image-{id}`, URL HTTPS y ALT literal previamente verificado. No inventes IDs, URLs, ALT ni créditos.

La ausencia de imágenes interiores resueltas no es una razón para insertar marcadores ni para degradar el texto: conserva el cuerpo textual completo en Gutenberg nativo.
