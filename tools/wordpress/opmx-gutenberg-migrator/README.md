# OPMX Gutenberg Migrator

Conversor de recuperación para artículos OPMX V5 que llegaron como un único bloque `core/html`.

## Garantías

- Sólo selecciona monolitos con el marcador estructural V5 `opmx-editorial__masthead`.
- Conserva título nativo, slug, estado, fecha, autor, taxonomías, metadatos SEO y medios existentes.
- Recompone la pieza con bloques core (`group`, `paragraph`, `heading`, `image`, `quote`, `list`); no inventa texto ni reescribe la nota.
- Genera el marcado con `serialize_blocks()` y exige un round-trip del parser antes de escribir.
- Por defecto no escribe nada. `--apply` es explícito y el lote está limitado a un post.

## Uso de validación

```bash
wp opmx migrate-v5 --post=1339
wp opmx migrate-v5 --post=1339 --apply
wp opmx migrate-v5 --all --limit=5
```

El piloto debe hacerse contra una copia de un borrador, inspeccionarse en el editor y compararse visualmente con el original antes de aplicar a cualquier artículo fuente.
