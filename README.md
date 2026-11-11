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
El Motor Editorial OPMX mantiene además seis familias maestras editoriales y contextos opcionales. Su resolución siempre es por versión semántica más alta; sufijos automáticos como `(1)`, `(2)` o `(3)` no cuentan como versión.

Familias:
1. `01_OPMX_TEMPLATE_MAESTRO*.html`
2. `02_OPMX_CSS_MAESTRO*.css`
3. `04_CONTRATO_SALIDA_OPMX*.json`
4. `CATEGORIAS_OPMX*.json`
5. `03_PROMPT_MAESTRO_OPMX*.txt`
6. `05_INSTRUCCION_GUTENBERG_ENRIQUECIDO_OPURO*.md`

Contextos opcionales: `05_CONTEXTO_EDITORIAL_*.json`. No constituyen una familia maestra universal y sólo se aplican cuando su scope/apply_when corresponde materialmente.

La incorporación física de estos maestros al repositorio debe preservar exactamente sus archivos vigentes; no reconstruirlos desde documentación histórica. Mientras una familia no esté materializada en GitHub, la fuente maestra vigente del Project conserva autoridad editorial para esa familia.

## Flujo
Motor Editorial OPMX → Publisher n8n → WordPress → Social Distribution Engine n8n → redes.

## Publisher y Telegram — estado operativo

Leer primero el [estado compartido del 11 de noviembre de 2026](docs/operations/ESTADO_COMPARTIDO_TELEGRAM_20261111.md): versiones publicadas comprobadas, cambios en n8n/Guard/Motor, autor3 de El Liberal, pruebas, límites y prioridades abiertas. Incluye referencias inmutables al código y los informes de despliegue que están en ramas técnicas.

Los exports antiguos de `main`, el [corte del 4 de noviembre](docs/operations/PUBLISHER_TELEGRAM_ESTADO_2026-11-04.md) y la [política v1](contracts/TELEGRAM_PUBLICATION_POLICY_v1.0.md) son referencias históricas para versiones/defaults y no deben usarse solos para restaurar producción. Comprobar la versión activa y el manifiesto Guard antes de modificar un escritor; conservar borradores de otros chats y la única suscripción del Motor. AMBOS mantiene OPURO+OPOL; TODOS incluye también LIBERAL. La autorización efectiva se obtiene del paquete y su revisión, no de una política histórica.

## Social vigente — 2026-10-25

v1.0.1 es **preflight offline**, con 35 pruebas Node y validación de los Code nodes
embebidos en los exports JSON. No se ha importado/probado en n8n nativo y no publica
en redes. Las nueve ramas emiten estados explícitos; `dry_run` no ejecuta uploads
ni llamadas externas. Publicación real bloqueada hasta implementar/probar el
almacén durable de idempotencia. Los exports v1.0 se conservan como históricos y
**no deben activarse**. Ver `tools/social/README.md` para reproducción y prueba.

## Regla de seguridad
Nunca almacenar secretos, tokens, contraseñas o credenciales en este repositorio.


## Decisión vigente — Publisher integrado v3 (2026-11-05)

DEFINIDO por OPMx: la referencia técnica es OXígeno Puro en producción (`feat/portadas-categoria-cache`, `8acd8bff524e329dadf14e645559d0f99c3a5eeb`). Se descarta el receptor WordPress independiente de Liberal. Los cuatro workflows OPMX existentes y el guard ya integran LIBERAL por REST nativa con Gutenberg enriquecido, Hero/destacada propios y Rank Math.

Contrato: OPURO, OPOL, LIBERAL; AMBOS significa permanentemente OPURO + OPOL; TODOS incluye todos los destinos registrados, actualmente los tres. Se admiten combinaciones por comas con espacios, mayúsculas y duplicados normalizados. Un miembro desconocido o vacío rechaza el conjunto antes de escribir. Categorías/autor/adjuntos/credenciales se resuelven por CMS; nunca reutilizar IDs de otros sitios.

Código y pruebas del runtime activo: [Publisher v3](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/tree/feat/publisher-liberal-v3). [ADR y evidencias](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/blob/feat/publisher-liberal-v3/docs/architecture/ADR_PUBLISHER_DESTINOS_v3.0.md). [Decisión oficial en Drive](https://drive.google.com/file/d/1ZcHahE8JUJu8eSnokJXFPn5-34SS1-jg/view). CI 42061182423 y 112 pruebas aprobadas; borrador privado real 5712 y duplicados 5713/5719. No se publicó el fixture.

El transporte actual lleva Hero y destacada. Para LIBERAL se rechazan core/image interiores con IDs de otro CMS antes de cualquier escritura; no se falsea la vinculación nativa. El servidor tools/list anuncia el nuevo destino string y post_id_liberal; un cliente que conserve el enum antiguo debe redescubrir ese esquema. Se mantienen las órdenes explícitas de publicación y el preflight conjunto antes de cambiar estados.
