# OPMX Editorial Engine

Repositorio técnico y versionado del flujo editorial OPMX para Oxígeno Puro MX / OXígeno Político MX y automatizaciones n8n.

## Fuente de verdad
GitHub `main` es la fuente de verdad técnica. Si una conversación contradice código o documentación vigente de `main`, prevalece `main`.

## Punto de entrada para ChatGPT Work
Leer primero: `docs/OPMX_PIPELINE_HANDOFF.md`.

Después consultar:
- `docs/SOCIAL_DISTRIBUTION_ARCHITECTURE.md`
- `docs/SOCIAL_PLATFORM_MATRIX.md`
- `contracts/` para contratos editoriales y de integración
- `changelog/` para cambios versionados

## Flujo
Motor Editorial OPMX → Publisher n8n → WordPress → Social Distribution Engine n8n → redes.

## Regla de seguridad
Nunca almacenar secretos, tokens, contraseñas o credenciales en este repositorio.
