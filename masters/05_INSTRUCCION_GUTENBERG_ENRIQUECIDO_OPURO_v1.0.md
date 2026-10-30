# Instrucción OPMX — Gutenberg enriquecido OPURO v1.0

Aplica esta instrucción junto con el Prompt Maestro vigente y el Contrato de Salida OPMX v1.3. No sustituye sus reglas editoriales, SEO, fuentes, categorías ni el HTML de archivo.

## Salidas obligatorias

Cada MASTER JSON debe contener representaciones equivalentes de la versión final de `TEXTO_EDITORIAL`:

- `HTML_FINAL`: documento completo OPURO, conservado para archivo, revisión y compatibilidad.
- `GUTENBERG_FINAL`: cuerpo portable OPOL en bloques nativos.
- `GUTENBERG_ENRIQUECIDO_FINAL`: cuerpo OPURO que publica el Publisher MEDIA v1.3.

## Reglas de GUTENBERG_ENRIQUECIDO_FINAL

- Emite Gutenberg serializado: comentarios `<!-- wp:* -->` y HTML de los bloques.
- Sólo se permiten `core/paragraph`, `core/heading`, `core/list`, `core/quote` y `core/image`.
- Los headings son exclusivamente H2 o H3. Nunca emitas H1.
- No incluyas masthead, título, subtítulo, metadatos, hero, imagen destacada, autor, etiquetas, botones de compartir, footer ni sección de fuentes salvo instrucción editorial expresa.
- Nunca emitas `opmx-editorial`, `data-opmx`, `wp:html`, `<article>`, `<header>`, `<footer>`, clases estructurales propias, ni ningún placeholder `{{…}}`.
- HERO_OPURO y DESTACADA_OPURO son adjuntos nativos administrados por el Publisher; no se insertan en `post_content`.
- No uses `core/image` hasta que exista un binding de adjunto WordPress real. Con binding real, cada imagen requiere `wp-image-{id}`, URL HTTPS y ALT literal previamente verificado. No inventes IDs, URLs, ALT ni créditos.

La ausencia de imágenes interiores resueltas no es una razón para insertar marcadores ni para degradar el texto: conserva el cuerpo textual completo en Gutenberg nativo.
