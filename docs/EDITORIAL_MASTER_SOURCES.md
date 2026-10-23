# OPMX — Fuentes maestras editoriales

Actualizado: 2026-10-23

## Regla universal de descubrimiento

Para cada familia se utiliza exclusivamente la versión semántica más alta indicada en el nombre. Los sufijos automáticos de duplicación `(1)`, `(2)`, `(3)` y equivalentes no constituyen versión.

Si hay varias copias de la misma versión semántica máxima, la precedencia es:
1. fuente maestra actualmente disponible en el Project;
2. adjunto vigente de la conversación actual;
3. copia histórica/Library.

Sólo hay conflicto bloqueante cuando dos archivos de la misma familia tienen la misma versión semántica máxima, contenido distinto y la precedencia no resuelve inequívocamente cuál es vigente.

## Familias maestras editoriales conocidas

| Familia | Versión vigente conocida al consolidar | Estado de materialización en GitHub |
|---|---|---|
| `01_OPMX_TEMPLATE_MAESTRO*.html` | v5 | pendiente de copiar archivo fuente exacto |
| `02_OPMX_CSS_MAESTRO*.css` | v5 | pendiente de copiar archivo fuente exacto |
| `03_PROMPT_MAESTRO_OPMX*.txt` | v4.6 MEDIA | pendiente de copiar archivo fuente exacto |
| `04_CONTRATO_SALIDA_OPMX*.json` | v1.2 MEDIA | pendiente de copiar archivo fuente exacto |
| `CATEGORIAS_OPMX*.json` | catálogo schema v1.1 | pendiente de copiar archivo fuente exacto |

No reconstruir estos archivos desde este documento. Hasta que el archivo exacto esté materializado en el repositorio, la fuente maestra vigente del Project conserva autoridad editorial.

## Contextos editoriales opcionales

Familia conocida:
- `05_CONTEXTO_EDITORIAL_BCS*.json`
- versión vigente conocida: v1.0
- schema: `OPMX_EDITORIAL_CONTEXT`
- status: `ACTIVE`

Los contextos no son una sexta familia maestra universal. Sólo se aplican cuando su `scope` y `apply_when` corresponden materialmente a la nota. Hechos actuales verificados prevalecen sobre el contexto.

## Relación con contracts/

Los contratos técnicos/editoriales ya versionados en `contracts/` no deben degradarse durante esta consolidación. En particular:
- `PROTOCOLO_EDITORIAL_OPMX_v4.2.md`
- `SALIDA_EDITORIAL_OPMX_v2.2.json`
- `SOCIAL_DISTRIBUTION_CONTRACT_v1.0.json`

La coexistencia de estas piezas con las familias maestras debe resolverse explícitamente por responsabilidad, no por sobrescritura automática.

## Workflows n8n

Publisher vigente:
- `workflows/publisher/OPMX_Publisher_MEDIA_v1.2.11.json`
- v1.2.10 se conserva como baseline.

Social Distribution:
- `workflows/social/OPMX_SOCIAL_DISTRIBUTION_ENGINE_v1.0.json`
- `workflows/social/OPMX_SOCIAL_MEDIA_STAGING_v1.0.json`
- `workflows/social/OPMX_SOCIAL_THREADS_v1.0.json`

No modificar Publisher para resolver necesidades de Social salvo incompatibilidad contractual comprobada y aprobada.
