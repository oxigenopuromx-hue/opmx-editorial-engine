# Registro vivo — migración Gutenberg OPMX

**Estado:** en curso en CMS candidato aislado. Todo permanece en `draft`; no hay publicación, cambios de DNS ni cambios a producción.

## Avance

- La cola histórica elegible fue convertida a Gutenberg con snapshot legado y Markdown privado.
- Se detectaron **889** borradores que ya eran Gutenberg y requerían backfill de trazabilidad.
- Se completaron **14** borradores Gutenberg sin medios: snapshot de origen, Markdown privado y validación de serialización.
- Lote de **500** expedientes con medios: **492** quedaron auditados como excepción porque el ALT era vacío o inexistente en el contenido fuente. No se inventó ni sustituyó ALT.

## Controles por nota completada

- Estado `draft`.
- Serialización Gutenberg de ida y vuelta.
- Snapshot fuente/legado inmutable según procedencia.
- Markdown privado.
- Ausencia de marcadores y etiquetas estructurales residuales.
- Para medios: adjunto nativo y conservación estricta del ALT de origen cuando existe.

## Punto de control

Los casos con ALT vacío de origen quedaron registrados como excepciones auditadas para no bloquear la cola. La siguiente pasada procesa los expedientes restantes con contenido y medios verificables; los casos sin ALT requieren recuperación editorial antes de poder completarse sin degradar accesibilidad.

_Actualizado: 27 de octubre de 2026 (America/Mexico_City)._

## Hallazgo de recuperación de medios — 27 de octubre

El ALT vacío se reclasificó correctamente como valor original preservable. Al reanudar el lote de 500, el impedimento real fue distinto: la mayoría de las referencias `core/image` apuntan a IDs que ya no existen como adjuntos nativos en el CMS candidato; también hay bloques `core/video` que requieren tratamiento específico. Se completó un caso verificable con ALT vacío preservado y no se modificó ningún contenido visible.

**Siguiente frente antes de producción:** reconciliar/restaurar adjuntos desde el respaldo de `uploads`, volver a validar las notas afectadas y después ejecutar el checklist de salida: SEO, equivalencia de sitemaps, redirecciones, robots/canonicals y smoke test del candidato.

_Actualizado: 27 de octubre de 2026 (America/Mexico_City)._

## Delta editorial antes del corte

Antes del checklist de salida se importará el delta de notas creadas después del último corte de migración —estimado actual: **40–50 notas**— al CMS candidato. Permanecerán en borrador hasta que cada una tenga contenido, metadatos, medios y estado validados. Sólo después se congelará el inventario y se compararán sitemaps, URLs/canonicals, robots y redirecciones para el corte.

_Actualizado: 27 de octubre de 2026 (America/Mexico_City)._

## Restricción de proyecto y dominio final — obligatoria

- **Único proyecto autorizado:** `oxigeno-puro-com-mx` (`prj_2VETh50RkVNY5Rmpx3EHVlAzXoDB`).
- **Dominio público final:** `oxigenopuro.com.mx`.
- **CMS:** `cms.oxigenopuro.com.mx` en Hostinger.
- `oxigeno-puro-mx` y `oxigenopuro.mx` están explícitamente fuera de alcance: no se permiten cambios de dominio, DNS, despliegue, variables, rutas o configuración.
- Auditoría: los únicos recursos usados allí durante esta migración fueron sesiones sandbox efímeras, todas ya detenidas. No se alteró su configuración ni sus dominios.

_Actualizado: 27 de octubre de 2026 (America/Mexico_City)._

## Verificación pre-corte SEO y enrutamiento — 27 de octubre

- En el sitio público actual, una muestra de artículo conserva su slug histórico, canonical absoluto en `https://oxigenopuro.com.mx/<slug>/`, robots `index, follow` y schema que incluye `NewsArticle`. Su `robots.txt` anuncia `https://oxigenopuro.com.mx/sitemap_index.xml`.
- El proyecto autorizado `oxigeno-puro-com-mx` permanece aislado: no tiene dominio personalizado, no tiene despliegue Production activo y su Preview usa `noindex`; las credenciales de migración están limitadas a Preview.
- Antes de activar Production faltan variables explícitas de Production para CMS, URL pública, entorno e indexación. No deben inferirse ni copiarse desde Preview.
- El código actual no contiene la redirección de activos requerida para el corte. Debe añadirse y probarse en el proyecto autorizado: `/wp-content/uploads/:path*` → `https://cms.oxigenopuro.com.mx/wp-content/uploads/:path*` con 301, conservando ruta y query string.
- No se ha modificado DNS, dominio, contenido publicado ni estado de los borradores. Sigue pendiente la auditoría profunda del CMS candidato y la importación del delta editorial de 40–50 notas antes de congelar inventario y comparar sitemaps.

_Actualizado: 27 de octubre de 2026 (America/Mexico_City)._

## Smoke test del preview privado — bloqueo de salida

- El preview devuelve `200` y está correctamente aislado: `meta robots` y `X-Robots-Tag` son `noindex, nofollow`; `robots.txt` desautoriza todo rastreo.
- El frontend sólo recibe un post publicado: `/hello-world/`. Por tanto, `post-sitemap.xml` contiene una URL y `news-sitemap.xml` está vacío. Los artículos migrados en `draft` no son visibles a través de la API pública que consume el frontend.
- La ruta de prueba `/wp-content/uploads/2026/09/__opmx_redirect_probe__.jpg` devuelve `403`, no un `301` hacia el CMS. La redirección de uploads sigue pendiente.
- El preview conserva la frase “Ideas que respiran soberanía” y una descripción de línea política; debe sustituirse por la identidad editorial aprobada de Oxígeno Puro MX antes de cualquier lanzamiento.
- Conservar los posts en borrador sigue siendo correcto durante migración y QA, pero hay un gate explícito antes del corte: publicar únicamente el inventario aprobado —o implementar una estrategia autenticada que no exponga borradores— y luego regenerar/validar sitemaps. Nunca activar el dominio con el estado actual.

_Actualizado: 27 de octubre de 2026 (America/Mexico_City)._

## Identidad y menú editorial aprobados

- Firma breve de marca aprobada: **Respira Soberanía**. Sustituirá tanto el lema superior heredado como la frase institucional del footer.
- Menú principal aprobado, usando categorías existentes y sus rutas históricas: **Noticias**, **Política**, **Plan México**, **Economía**, **Tecnología**, **Innovación**, **Soberanía**, **Estados**, **Internacional**, **Congreso**, **Justicia** y **Opinión**.
- `Gobierno` y `Megalópolis` no existen en Oxígeno Puro y se retiran. `Cultura`, `Deporte` y `Turismo` permanecen como archivos accesibles y se ubicarán fuera del menú principal.
- Corregir enlaces heredados antes del corte: `Deportes` corresponde a `/category/noticias/deporte/`; `Ciencia` a `/category/innovacion/ciencia/`; `Educación` a `/category/noticias/educacion/`; y `Medio ambiente` a `/category/medio-ambiente/`.
- Esta decisión no modifica aún código, WordPress, DNS ni estados de publicación.

_Actualizado: 27 de octubre de 2026 (America/Mexico_City)._