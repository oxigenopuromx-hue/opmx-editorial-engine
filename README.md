# OPMX Editorial Engine

Repositorio técnico y versionado del flujo editorial OPMX para Oxígeno Puro MX / OXígeno Político MX y automatizaciones n8n.

## Fuente de verdad
GitHub `main` es la fuente de verdad técnica y versionada. Si una conversación contradice código o documentación vigente de `main`, prevalece `main`.

## Punto de entrada para ChatGPT Work
Leer primero: `docs/OPMX_PIPELINE_HANDOFF.md`.

Después consultar:
- `docs/SOCIAL_DISTRIBUTION_ARCHITECTURE.md`
- `docs/SOCIAL_PLATFORM_MATRIX.md`
- `contracts/` para contratos editoriales y de integración
- `workflows/publisher/` para exports n8n del Publisher
- `workflows/social/` para Social Distribution Engine
- `changelog/` para cambios versionados

## Motor Editorial maestro
El Motor Editorial OPMX mantiene además cinco familias maestras editoriales y contextos opcionales. Su resolución siempre es por versión semántica más alta; sufijos automáticos como `(1)`, `(2)` o `(3)` no cuentan como versión.

Familias:
1. `01_OPMX_TEMPLATE_MAESTRO*.html`
2. `02_OPMX_CSS_MAESTRO*.css`
3. `04_CONTRATO_SALIDA_OPMX*.json`
4. `CATEGORIAS_OPMX*.json`
5. `03_PROMPT_MAESTRO_OPMX*.txt`

Contextos opcionales: `05_CONTEXTO_EDITORIAL_*.json`. No constituyen una sexta familia universal y sólo se aplican cuando su scope/apply_when corresponde materialmente.

La incorporación física de estos maestros al repositorio debe preservar exactamente sus archivos vigentes; no reconstruirlos desde documentación histórica. Mientras una familia no esté materializada en GitHub, la fuente maestra vigente del Project conserva autoridad editorial para esa familia.

## Flujo
Motor Editorial OPMX → Publisher n8n → WordPress → Social Distribution Engine n8n → redes.

## Publisher vigente
`workflows/publisher/OPMX_Publisher_MEDIA_v1.2.11.json` es la versión operativa vigente. `v1.2.10` se conserva como baseline histórico previo a la parametrización del CMS OPURO.

## Regla de seguridad
Nunca almacenar secretos, tokens, contraseñas o credenciales en este repositorio.
