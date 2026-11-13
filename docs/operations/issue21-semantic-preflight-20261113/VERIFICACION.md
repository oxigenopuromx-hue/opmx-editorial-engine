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

## Integración comprobada; despliegue pendiente por entorno no disponible

Fuente21:4b9116419a2d5a6b7ff12152f7a26b762a58219a. Preparación n8n:11operaciones aplicadas,152nodos, cinco grupos; sólo advertencia de lienzo preexistente. Grafo cotejado exactamente contra builder, IDs originales y conexiones esperadas: huella1b1de2dea56ac4c738c9bf2c8ad26af6f082f520fd4cc64f361da2596b6ed56b. Versión candidata guardada en historia:1b78dc88-cb9b-456f-b711-c3328031e61d. NO PUBLICADA.

Se ensambló un Guard basado íntegramente en issue24, conservando sus13deltas runtime anteriores y cambiando únicamente writer-release-manifest.mjs al pin candidato. Arranque y14rutas de denegación sin estado auténtico:PASS. Archivo preparado opmx-guard-semantic-preflight21.zip,195143bytes,SHA256c023a111a8448df8b0cf96c4fcfc5eb8fe26a2cd9d2d5468ecb8ab25dd45a3ec. Fuente/manifiesto candidato inmutable:edb20e76ad20b033cc68b80af98100dde33eb9a6. El ZIP local puede requerir reconstrucción si se pierde el entorno; el commit preserva las fuentes.

El panel Hostinger se observó antes de subir: seguía Actual/completado opmx-guard-publisher-submission24.zip. La llamada de preparación de documentación del navegador agotó300s y el entorno pasó a unavailable; desapareció la capacidad de navegador. No se llegó a pulsar Redistribuir ni a subir el ZIP. No se modificó Hostinger y NO se publicó el MCP candidato. No hay bloqueo de aprobación ni una decisión pendiente del usuario.

Por seguridad operativa se restauró el draft ajeno112nodos desde719ed751-2e44-418f-bbe9-90e9965084d1; nuevo draft a342823c-1a68-4dfc-81ab-622daf2061cd. Relectura: nodos/conexiones idénticos al snapshot original, activo todavía1b3bb5c6-e871-4d43-a9c1-21f7ef11cacb/151nodos. El manifiesto de la punta de rama se devuelve al pin productivo anterior; el commit candidato anterior queda disponible. Shared y los otros escritores no cambiaron.

## Continuación necesaria

1. Recuperar un entorno con acceso al panel Hostinger y las fuentes fijadas; releer este índice, versiones activas y drafts por concurrencia.
2. Reconstruir/preparar el release candidato desde la base24 y su único delta de manifest; volver a cotejar huella/pins y comprobar escritores inactivos. No activar el draft112.
3. Desplegar Guard compatible y publicar exactamente la versión candidata152 de forma coordinada, o regenerarla desde activo si la historia expiró. Conservar/restaurar el draft ajeno.
4. Comprobar estado Hostinger y observar versiones/huellas reales desde Guard. Sólo entonces cerrar21. No reenviar paquetes ni publicar notas como prueba.

## Límites y reversión

VALIDATION_FAILED lleva campos acotados,writesStarted:false,retryPermitted:false. Errores locales desconocidos siguen FILES_REJECTED; resultados posteriores a aceptar siguen sujetos a conciliación24. La validación estática no promete disponibilidad/permisos actualesCMS. No se alteró el único Motor ni preview por esta candidata. Como21no se activó, no requiere reversión productiva; el draft112ya está restaurado y Guard/MCP actuales siguen compatibles.
