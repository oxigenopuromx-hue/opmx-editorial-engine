# Issue 21: evidencia de validación estática

Fecha: 13 de noviembre de 2026. Alcance: detectar rechazos semánticos conocidos antes de aceptar Publisher, sin publicar ni repetir paquetes pendientes.

## Fuente y QA aislado

- 48 pruebas específicas del preflight: PASS.
- 741 pruebas conjuntas de editorial, Guard y Receiver: PASS.
- Ejecución n8n `38026`: `SEMANTIC_PREFLIGHT_QA_PASSED`, 27 casos y 157 aserciones. El integrador confirmó la restauración del probe inactivo después de la prueba.
- Resultado del probe: `externalIoCalls:0`, `cmsWrites:0`, `telegramMessages:0`, `guardMutations:0`, `scope:STATIC_CODE_ONLY`.

El probe ejecutó las fuentes candidatas reales del Code y del formatter con datos sintéticos. Cubrió los siete conjuntos de destinos, campos obligatorios, categorías, jerarquía, estado, autor prohibido, slug, archivos, bloques y placeholders; además, validación sin identificador externo, rechazo de escritura sin identificador, OPOL sin Hero y conservación del contenido LITERAL. No es una prueba de publicación en WordPress.

El grupo visual añadido después del probe no cambió ninguna fuente ejecutada: el Code de QA generado es idéntico byte por byte al de `38026`. La regresión de fuente se repitió después de agregar el grupo y conservó los 741 PASS.

## Fuentes exactas y grafo

Base publicada MCP: `bnzVMNkZuGO1GQCZ`, versión `1b3bb5c6-e871-4d43-a9c1-21f7ef11cacb`, 151 nodos. La candidata añade un Code y conserva los controles existentes: 152 nodos previstos.

Shared sin cambios: `4o7K5TmKc7joScqB`, versión `4263fea4-90a4-406d-a234-da7397d456bf`, 146 nodos.

| Fuente Shared incrustada | SHA-256 |
| --- | --- |
| Preparar MASTER y binarios | `8db8e0c0aaafd824450551a91b174c073a02d2da4c7c8c5c4069a22766add645` |
| Validar y normalizar OPMX MASTER | `710a625882e6ffcdf05a4ff694d1475b07b60a068006702a76ff7ace84bb6b5c` |

Las 11 operaciones candidatas agregan el grupo `Validación MASTER antes de aceptar` con ID `00e1fe38-96aa-4a71-94c0-da882b61421d`, cuyo único miembro es `MASTER — Validación estática Shared`. Se conserva la identidad y membresía de los cuatro grupos previos. El único miembro concentra todas las entradas y salidas externas del grupo; no se incluye ningún trigger ni se solapan miembros.

## Integración y despliegue: completar antes del cierre

Estos campos son pendientes explícitos del integrador; no acreditan activación:

| Comprobación | Evidencia pendiente |
| --- | --- |
| Nueva versión MCP activa, 152 nodos | `PENDIENTE_ROOT_MCP_VERSION_ID` |
| Huella del grafo MCP publicado, cotejado con candidato | `PENDIENTE_ROOT_MCP_GRAPH_SHA256` |
| Relectura de grupos: sin grupos omitidos o eliminados | `PENDIENTE_ROOT_MCP_GROUPS_VERIFIED` |
| Guard compatible: artefacto/versión y SHA-256 | `PENDIENTE_ROOT_GUARD_ARTIFACT_AND_SHA256` |
| Manifiesto compartido y comprobación de compatibilidad | `PENDIENTE_ROOT_WRITER_MANIFEST_VERIFIED` |
| Borrador ajeno de 112 nodos restaurado, versión resultante | `PENDIENTE_ROOT_RESTORED_DRAFT_VERSION_ID` |
| Relectura final: activo 152, borrador ajeno 112 | `PENDIENTE_ROOT_ACTIVE_AND_DRAFT_VERIFIED` |

El borrador ajeno previo es la versión `719ed751-2e44-418f-bbe9-90e9965084d1`, 112 nodos. Antes de preparar la candidata deben preservarse sus nodos, conexiones, grupos, parámetros, credenciales y configuración. La candidata se arma desde el grafo activo de 151 nodos. Tras publicar la nueva versión, se restaura el contenido del borrador ajeno sin publicarlo; la restauración genera otro identificador de borrador. La comprobación final debe volver a leer tanto `activeVersion` como el borrador y cotejar ambos contenidos con sus respectivos snapshots.

## Límites y reversión

Los diagnósticos conocidos de esta etapa son `VALIDATION_FAILED` con campos acotados, `writesStarted:false` y `retryPermitted:false`. Un error local no reconocido produce `FILES_REJECTED` sin datos crudos. `FILES_VALIDATED` declara el alcance estático y `live_cms_checks:NOT_CHECKED` / `request_binding:NOT_CHECKED`; no promete permisos o disponibilidad actual de WordPress.

La aceptación durable del issue 24 y sus resultados asíncronos conservan su contrato. Un error posterior a aceptar o un resultado incierto requiere conciliación; esta corrección no autoriza reintentar paquetes históricos.

La reversión debe usar la versión activa previa y un Guard/manifiesto compatibles, conservando recibos e intentos históricos. El borrador ajeno de 112 nodos no es una versión de reversión productiva. No se alteran la suscripción actual del Motor ni su evento de vista previa.
