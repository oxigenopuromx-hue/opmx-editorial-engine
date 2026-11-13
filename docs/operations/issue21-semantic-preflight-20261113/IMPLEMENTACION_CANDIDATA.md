# Issue 21: validación semántica antes de aceptar Publisher

Estado: fuente y operaciones candidatas verificadas; este documento no acredita despliegue. La activación, el manifiesto compartido y la evidencia de n8n se registran después de integrar los issues 25 y 15.

## Problema y comportamiento

`FILES_VALIDATED` comprobaba archivos y algunas propiedades del MASTER. El escritor Shared aún podía rechazar otros campos obligatorios antes de escribir en WordPress. Con la aceptación asíncrona del issue 24, esos errores posteriores no pueden reinterpretarse como rechazos seguros por su texto: una operación ya aceptada exige consultar el resultado durable.

La candidata ejecuta la preparación y normalización estáticas completas de Shared antes de la rama de aceptación. Un error conocido produce `VALIDATION_FAILED`, con código y campos acotados, `writesStarted:false` y `retryPermitted:false`. Los errores locales no reconocidos producen `FILES_REJECTED` sin copiar excepciones, valores editoriales o URLs al diagnóstico. Los errores que ocurran después de la aceptación conservan el tratamiento asíncrono existente y nunca liberan un reintento.

## Base y alcance

| Componente | Versión activa leída | Nodos |
| --- | --- | --- |
| MCP `bnzVMNkZuGO1GQCZ` | `1b3bb5c6-e871-4d43-a9c1-21f7ef11cacb` | 151 → 152 |
| Shared `4o7K5TmKc7joScqB` | `4263fea4-90a4-406d-a234-da7397d456bf` | 146, sin cambios |

Se usaron los grafos publicados, porque los borradores guardados difieren de producción. El builder genera 11 operaciones: un nodo Code nuevo, su configuración de error, la reconexión de las dos entradas previas, sus salidas, la actualización de dos nodos existentes y un grupo visual para el nuevo Code. No agrega llamadas HTTP, credenciales ni tablas. Los cuatro grupos existentes permanecen intactos.

El nuevo nodo `MASTER — Validación estática Shared` contiene las fuentes exactas de `Preparar MASTER y binarios` y `Validar y normalizar OPMX MASTER`. Las ejecuta sobre una copia local con helpers de binario que sólo generan metadata en memoria; no usa el almacenamiento de n8n. El payload original continúa intacto hacia el escritor. Los campos, categorías estáticas, jerarquía, placeholders, bloques y perfil LITERAL se validan con la misma implementación del escritor. El formato canónico del slug se comprueba además antes de aceptar.

| Fuente copiada | SHA-256 |
| --- | --- |
| Preparar MASTER y binarios | `8db8e0c0aaafd824450551a91b174c073a02d2da4c7c8c5c4069a22766add645` |
| Validar y normalizar OPMX MASTER | `710a625882e6ffcdf05a4ff694d1475b07b60a068006702a76ff7ace84bb6b5c` |

`FILES_VALIDATED` incorpora `validation_scope`: identifica estas fuentes y declara `live_cms_checks:NOT_CHECKED` y `request_binding:NOT_CHECKED`. No comprueba existencia o permisos actuales del CMS ni sustituye Guard, la reserva del escritor, la autenticación de LITERAL o la confirmación final.

`validar_archivos_opmx` no recibe `request_id`. Sólo para esa lectura, la copia local usa un identificador de sintaxis sin efecto de binding. Si el perfil es LITERAL se usa su `REQUEST_ID` original, ya comprobado por la etapa Guard existente. El MASTER y el payload transmitido conservan sus valores originales. La excepción no se aplica a crear o publicar: esas operaciones exigen el identificador real coincidente.

## Archivos

- `tools/telegram/guard-recovery-candidate/publisher-master-preflight.mjs`: helpers, clasificador limitado y respuesta segura.
- `tools/telegram/guard-recovery-candidate/receiver/build-master-semantic-preflight-operations.mjs`: builder contra los grafos activos, con rechazo de orden, ramas o helpers inesperados.
- `tools/telegram/guard-recovery-candidate/receiver/build-master-semantic-preflight-qa.mjs`: Code aislado reproducible para el probe inactivo de QA; sólo datos sintéticos.
- `tools/telegram/guard-recovery-candidate/receiver/fixtures/shared-master-static4263.mjs`: snapshots sanitizados de las dos fuentes Shared y de los nodos MCP necesarios.
- `tools/telegram/guard-recovery-candidate/receiver/master-semantic-preflight.test.mjs`: regresiones de la candidata.

## Verificación de fuente

Se ejecutaron 48 pruebas del preflight y 741 pruebas conjuntas de editorial, Guard y Receiver, todas correctas. Se incluyen los siete conjuntos de destinos, fallas por campo, errores desconocidos, inyección de diagnóstico, LITERAL original y alterado, conservación del fallback de categoría OPURO, OPOL sin Hero, identificadores ausentes y desvíos del grafo.

El Code de QA generado ejecutó las fuentes candidatas: 27 casos y 157 aserciones, con cero I/O externo. Comprueba los rechazos antes de aceptar y la conservación de payload. La ejecución aislada n8n `38026` también pasó esos casos y el probe fue restaurado; falta comprobar el grafo publicado tras la integración. La evidencia y los campos pendientes están en `VERIFICACION.md`.

No se modificaron paquetes, publicaciones, avisos, suscripciones del Motor ni estados de Guard durante esta implementación. Tampoco se alteró el manifiesto compartido del escritor.
