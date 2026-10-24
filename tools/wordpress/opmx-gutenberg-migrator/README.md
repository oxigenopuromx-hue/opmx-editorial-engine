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

## Rehidratación V5 desde snapshot (borrador)

`rehydrate-draft.php` es el conversor de segunda pasada para las notas que ya
fueron importadas como bloques genéricos pero todavía conservan su snapshot
inmutable `_opmx_gutenberg_legacy_content`. Trabaja sobre **un solo ID** por
ejecución, exige que el post siga en `draft` y nunca reemplaza el snapshot.

Convierte el cuerpo a bloques core y conserva los módulos semánticos con las
clases compartidas `opmx-module--brief`, `opmx-module--analysis`,
`opmx-module--sources`, `opmx-module--tags` y `opmx-module--closure`. Elimina el chrome heredado
(masthead, header, hero, footer, share y meta), que corresponde al
frontend. Notas con medios incrustados se rechazan explícitamente: deben pasar
por la reconciliación de medios antes de esta etapa.

Antes de serializar, normaliza dos residuos no editoriales del exportador
histórico: el marcador de recorte `[&hellip;]` (incluidas sus variantes ya
decodificadas) y los saltos de línea literales `\\n`, `\\r` y `\\r\\n`.
Los acentos y el resto del contenido permanecen como UTF-8 normal; no se
convierten a entidades HTML.

```bash
OPMX_TARGET_ID=123 wp eval-file rehydrate-draft.php
```

Después de cada ejecución hay que revisar el borrador en el editor y la ruta
privada de revisión, y conservar el JSON de salida como bitácora del lote.
