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