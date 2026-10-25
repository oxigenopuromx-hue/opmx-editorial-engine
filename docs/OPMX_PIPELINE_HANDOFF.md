# OPMX Pipeline — Handoff maestro

Actualizado: 2026-10-25

## Propósito
Punto de entrada técnico para cualquier instancia de ChatGPT Work que opere el flujo OPMX desde la salida editorial hasta distribución social.

## Fuente de verdad
- GitHub `main` es la fuente de verdad técnica y versionada.
- Los chats sirven para dirección, decisiones y aprobación.
- Work implementa, prueba y documenta.
- Si una conversación contradice código o documentación vigente en `main`, prevalece `main`.
- Nunca guardar secretos, tokens, contraseñas ni credenciales en el repositorio.

## Cadena
Motor Editorial OPMX → Publisher n8n → WordPress OPURO/OPOL → Social Distribution Engine n8n → plataformas.

## Estado al 2026-10-23
### Motor Editorial
Contratos vigentes ya versionados en `contracts/`, incluyendo Protocolo v4.2 y Salida Editorial v2.2.

### Publisher
Versión operativa vigente y validada: `OPMX Publisher MEDIA v1.2.12`, versionada en `workflows/publisher/`. El usuario confirmó una ejecución real exitosa el 2026-10-23, incluyendo una categoría OPURO que no pertenecía a la antigua whitelist embebida. v1.2.12 elimina exclusivamente la whitelist embebida de categorías OPURO: la categoría sigue siendo obligatoria y `OPURO — Buscar categoría` + `OPURO — Resolver categoría` consultan WordPress y exigen coincidencia exacta normalizada para obtener el ID; no se crean categorías automáticamente. OPOL conserva su catálogo embebido y validación jerárquica. v1.2.11 permanece como rollback probado y v1.2.10 como baseline histórico.

Regla: no modificar Publisher para resolver necesidades de Social salvo incompatibilidad contractual comprobada y aprobada.

### Social Distribution Engine
Estado vigente: **v1.0.1 OFFLINE_PREFLIGHT_TESTED**. No se ha importado/ejecutado
en n8n nativo ni publicado en plataformas. No confundir las pruebas Node con esas pruebas.

Terminado el 2026-10-25:
- Contrato técnico `contracts/SOCIAL_DISTRIBUTION_CONTRACT_v1.0.1.json`; entrada
  wire mantiene `social_contract_version=1.0`. Exige `source_site=OPURO`, booleans
  reales, nueve targets explícitos y nueve resultados de plataformas distintas.
- Tres exports v1.0.1 completos y desactivados: coordinador, preflight staging y
  preflight Threads. Son subworkflows, no webhooks públicos sin autenticación.
- El coordinador devuelve nueve ramas independientes con consolidado validado.
  No llama staging ni workers remotos durante simulación.
- Los exports v1.0 se preservan históricamente, pero tienen incompatibilidades
  conocidas y **no deben activarse**; ver `changelog/SOCIAL_v1.0.1.md`.
- `tools/social/` permite regenerar exports, ejecutar pruebas y verificar que no
  divergen del código fuente. Validadores Ajv empaquetados sin dependencia npm en n8n.
- Corregidos sólo punteros documentales atrasados del Publisher en manifest y
  fuentes maestras. Los tres exports Publisher y maestros no cambian.

Probado:
- 35 pruebas Node aprobadas, incluyendo ejecución de los Code nodes exactos del
  JSON en VM sin red, rechazo de entradas inválidas, consolidado de nueve estados,
  `dry_run` sin IO externo, live bloqueado, hash/firma del binario y preservación.
- JSON Schema 2020-12 de entrada/salida, generación reproducible, grafo y
  `git diff --check`. Audit npm incluyendo desarrollo: 0 vulnerabilidades reportadas.
- CI agregado para repetir build-check/tests. No declarar aprobado CI remoto
  hasta consultar la ejecución GitHub correspondiente.

No terminado / bloqueos:
- **Idempotencia efectiva pendiente:** no hay almacén durable elegido, provisionado
  ni adaptador con claim atómico. Requisitos en `docs/SOCIAL_DURABLE_STORE_REQUIREMENTS.md`.
  El gate `LIVE_BLOCKED` está en código, no admite bypass por input/variable.
- Falta comprobar versión/configuración n8n (Merge 9 inputs y built-in crypto),
  importar la revisión nueva y ejecutar el primer dry run nativo.
- Fase 1 sigue exclusivamente OPURO (`oxigenopuro.com.mx`). `IMAGEN_SOCIAL` sigue
  siendo un tercer asset manual de Canva posterior a Publisher; no HERO/interior.
- Staging objetivo aprobado: WordPress OPURO temporal, no R2, mediante
  `OPMX_OPURO_WP_BASE_URL`. v1.0.1 sólo inspecciona/prepara metadata offline; no
  sube ni elimina medios. Retención siete días desde distribución terminada,
  fecha de limpieza aún null durante preflight.
- Pendientes: upload/readback WordPress, OAuth/permisos por red, publicación,
  readback remoto y pruebas persistentes de duplicado/concurrencia/timeout.
- Threads conserva propuesta de formato, no nueva aprobación editorial. El helper
  offline ya lee `media.social.alt_text` y produce saltos de línea reales.
- TikTok sigue bloqueado por migración/verificación del CMS definitivo;
  YouTube Community y WhatsApp Channel siguen `SKIPPED/MANUAL_REQUIRED`.

Siguiente paso: importar v1.0.1 en un workflow de prueba **separado del Publisher**
y ejecutar `dry_run=true`. En paralelo, el chat principal debe aprobar el servicio
persistente que cumpla los requisitos de idempotencia; no se selecciona uno aquí.
Sólo después implementar store y adapters, empezando por el orden de habilitación
de `SOCIAL_INTEGRATION_CHECKLIST.md`. No activar publicaciones ni limpieza antes.

Debe construirse como workflow independiente y conectarse posteriormente al Publisher mediante contrato explícito. No crear un workflow monolítico.

Destinos previstos:
X, LinkedIn, Google Business Profile, Facebook, Instagram, Threads, TikTok, YouTube y WhatsApp Channel.

Cada rama debe ser independiente y terminar en `SUCCESS`, `FAILED` o `SKIPPED`.

YouTube Community y WhatsApp Channel deben permanecer `SKIPPED/MANUAL_REQUIRED` mientras no exista una vía oficial adecuada y aprobada.

## Reglas funcionales ya aprobadas
- X / LinkedIn / Google Business / Facebook / Instagram: `SUBTITULO + "\n\n" + URL_OPURO`.
- TikTok PHOTO: título = `TITULO_SEO`; descripción = `SUBTITULO`; sin URL_OPURO.
- YouTube deseado: `SUBTITULO + "\n\n" + URL_OPURO`; imagen derivada 1:1 con recorte alineado arriba, sin alterar el original.
- WhatsApp Channel: compartir URL_OPURO manualmente para generar link card.
- Threads: rama independiente. Su formato definitivo y API deben cerrarse durante diseño/implementación contra documentación oficial vigente.
- La imagen social original nunca debe alterarse para satisfacer otra plataforma; las transformaciones son copias derivadas.

## Principio arquitectónico
ChatGPT toma decisiones editoriales. n8n ejecuta y valida operaciones técnicas.

## Protocolo de hitos para Work
En CADA hito relevante:
1. Actualizar este archivo con estado, versión vigente y siguiente paso.
2. Actualizar `docs/SOCIAL_DISTRIBUTION_ARCHITECTURE.md` si cambia arquitectura o comportamiento.
3. Actualizar `docs/SOCIAL_PLATFORM_MATRIX.md` si cambia una plataforma, API, permiso o estado.
4. Versionar workflows JSON completos/importables; no documentar sólo fragmentos.
5. Registrar contratos nuevos o modificados en `contracts/`.
6. Dejar un resumen breve: hecho / probado / pendiente / bloqueos.
7. No declarar algo “probado” sin evidencia de ejecución.

## Siguiente hito
Prueba n8n nativa del preflight v1.0.1 y aprobación del almacén durable. Después,
claim atómico + staging WordPress + primer adapter real con verificación, sin
modificar Publisher. Faltan aprobación funcional del formato Threads y sus pruebas.


## Unificación Motor Editorial — 2026-10-23

Este repositorio también será el punto de convergencia versionado de los maestros del Motor Editorial OPMX. La migración se hace sin degradar componentes ya más nuevos de `main`.

Reglas:
- No sustituir `SALIDA_EDITORIAL_OPMX_v2.2.json`, `PROTOCOLO_EDITORIAL_OPMX_v4.2.md` ni otros contratos técnicos vigentes por archivos históricos sólo porque provengan de un chat anterior.
- Las cinco familias maestras del Motor se resuelven por versión semántica máxima; sufijos de copia no son versión.
- Los contextos `05_CONTEXTO_EDITORIAL_*.json` son opcionales y se resuelven por familia y versión semántica máxima.
- Hechos actuales verificados prevalecen sobre cualquier contexto editorial.
- `workflows/publisher/OPMX_Publisher_MEDIA_v1.2.12.json` es la versión vigente y validada; v1.2.11 permanece como rollback probado y v1.2.10 como baseline.
- `workflows/social/` permanece separado del Publisher y sigue el contrato Social activo.
- No reconstruir Template, CSS, Prompt Maestro, catálogo ni contrato MEDIA desde memoria. Su incorporación al repo debe hacerse desde el archivo fuente vigente exacto.


## Gutenberg editorial rendering — 2026-10-24

Se agregó `docs/GUTENBERG_EDITORIAL_RENDERING_CONTRACT_v1.0.md`: especificación del próximo adaptador Gutenberg del Publisher. Define bloques nativos, clases semánticas, separación entre contenido y chrome del frontend, UTF-8, validación de readback y compatibilidad OPURO/OPOL.

Estado: piloto visual verificado en OPURO con el borrador `post_id=2790` (“Claude Duet”). El Publisher vigente **no se ha modificado**: `SALIDA_EDITORIAL_OPMX_v2.2.json` sigue declarando `clean_html`. La migración a `gutenberg_blocks_v1` requiere una versión contractual y un workflow Publisher nuevos, pruebas de bloque y aprobación antes de activarse.


### Decisión adicional — cuerpo compartido

`GUTENBERG_EDITORIAL_RENDERING_CONTRACT_v1.0.md` ahora fija `content_gutenberg_v1` como futuro cuerpo editorial canónico compartido por OPURO y OPOL: un documento con bloques Gutenberg nativos, no un bloque HTML monolítico. El Motor entrega blueprint estructurado; Publisher serializa y valida; cada frontend aplica su piel de marca. Pendiente: contrato formal, Publisher vNext, serializador, pruebas y CSS de paridad OPOL.
