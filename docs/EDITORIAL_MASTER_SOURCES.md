# OPMX — Fuentes maestras editoriales

Actualizado: 2026-10-25

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
| `01_OPMX_TEMPLATE_MAESTRO*.html` | v5 | `masters/01_OPMX_TEMPLATE_MAESTRO_v5.html` |
| `02_OPMX_CSS_MAESTRO*.css` | v5 | `masters/02_OPMX_CSS_MAESTRO_v5.css` |
| `03_PROMPT_MAESTRO_OPMX*.txt` | v4.6 MEDIA | `masters/03_PROMPT_MAESTRO_OPMX_v4.6_MEDIA.txt` |
| `04_CONTRATO_SALIDA_OPMX*.json` | v1.2 MEDIA | `masters/04_CONTRATO_SALIDA_OPMX_v1.2_MEDIA.json` |
| `CATEGORIAS_OPMX*.json` | catálogo schema v1.2 | `masters/CATEGORIAS_OPMX_v1.2.json` |

Los cinco archivos fuente exactos están materializados en `main`. `manifest.json` registra los punteros aprobados; la regla universal de descubrimiento semántico sigue siendo el control contra downgrades o copias históricas.

## Contextos editoriales opcionales

Familia conocida:
- `05_CONTEXTO_EDITORIAL_BCS*.json`
- versión vigente conocida: v1.0
- schema: `OPMX_EDITORIAL_CONTEXT`
- status: `ACTIVE`
- materializado: `contexts/05_CONTEXTO_EDITORIAL_BCS_v1.0.json`

Los contextos no son una sexta familia maestra universal. Sólo se aplican cuando su `scope` y `apply_when` corresponden materialmente a la nota. Hechos actuales verificados prevalecen sobre el contexto.

## Relación con contracts/

Los contratos técnicos/editoriales ya versionados en `contracts/` no deben degradarse durante esta consolidación. En particular:
- `PROTOCOLO_EDITORIAL_OPMX_v4.2.md`
- `SALIDA_EDITORIAL_OPMX_v2.2.json`
- `SOCIAL_DISTRIBUTION_CONTRACT_v1.0.1.json` (revisión técnica; wire de entrada `1.0`)

La coexistencia de estas piezas con las familias maestras debe resolverse explícitamente por responsabilidad, no por sobrescritura automática.

## Workflows n8n

Publisher vigente:
- `workflows/publisher/OPMX_Publisher_MEDIA_v1.2.12.json`
- v1.2.11 se conserva como rollback probado y v1.2.10 como baseline. Este cambio
  sólo alinea el puntero con README/handoff; no modifica los workflows.

Social Distribution:
- `workflows/social/OPMX_SOCIAL_DISTRIBUTION_ENGINE_v1.0.1.json`
- `workflows/social/OPMX_SOCIAL_MEDIA_STAGING_v1.0.1.json`
- `workflows/social/OPMX_SOCIAL_THREADS_v1.0.1.json`

Social v1.0.1 es preflight offline probado, no publicación real habilitada.
Los exports Social v1.0 son históricos con inconsistencias conocidas; no activarlos.

No modificar Publisher para resolver necesidades de Social salvo incompatibilidad contractual comprobada y aprobada.
