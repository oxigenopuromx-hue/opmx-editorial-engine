# Revisión19 — parámetro nulo en validación de archivos

12nov2026. Seguimiento del issue19 abierto. No se autoriza publicar desde DEV.

## Evidencia y causa

Motor a536edd4-39a0-832b-9ea5-fc4e12cda65f,22:43:09–22:45:50UTC, informa bloqueo VALIDATION_FAILED en CONTROL_EDITORIAL.LITERAL antes de ACK/escritor, writesStarted=false. La instrucción histórica de48bytes está DISCARDED; la revisión19 confirma CREATE/LITERAL/TODOS y conserva artículo/fotos. La integridad y validación local pasaron según el resultado.

La causa se reproduce con el protocolo activo real: validar_archivos_opmx no admite request_id en su esquema y construye request.request_id=null. Comprobar MASTER pasaba ese null a validateLiteralMaster, que lo comparaba con CONTROL_EDITORIAL.LITERAL.REQUEST_ID y rechazaba todo MASTER literal válido. El modelo había llamado el validador local sin ese argumento y obtenía ok. El código de error agrupa fallo local y fallo Guard; los metadatos de ejecución productiva no conservaron un trace interno, por lo que la localización se sustenta en esa reproducción determinista del protocolo activo.

## Cambio acotado

Sólo en operation=validar_archivos_opmx con request_id exactamente null se normaliza a undefined para la comprobación local. El candidato sigue incluyendo su REQUEST_ID del MASTER y va a Guard, que comprueba binding único, revisión actual, clave canónica, intento/fence, decisión, texto y versiones reales. Esa normalización no concede permisos CMS.

Crear/publicar conservan exigencia de request_id externo: ausente, null o distinto siguen rechazados. Se mantiene el validador estricto; no se cambia el contrato ni se inventa request_id para validar_archivos. Guard recibe exactamente siete campos.

MCP bnzVMNkZuGO1GQCZ: versión activa6d60d83d-a99a-4f06-a201-70b5d292b9da,137nodos; sólo cambia jsCode de Comprobar MASTER. Hash4e1a884c2546efcca8d99f52cf1b531ad1dfb50fe65a54a2cc43c9e3b0cdfec7. Las conexiones, credenciales y otros136nodos permanecen iguales.

Guard actual: opmx-guard-literal19-validation-scope.zip SHA256cef58abf6b311393c0f22690117947cba3d3edba71834eada4b65c1cd93eb128, Hostinger completado/Actual16:52:48CDMX. Única diferencia de runtime respecto a ZIP518721f5…: writer-release-manifest.mjs con el nuevo pin/huella MCP. No se relajó la prueba de texto ni se cambió el resto de escritores.

Fuente7177c927c24ad9f03f1d93e5add6db4b277c4bb9. Incluye fixture público con las funciones genéricas reales del protocolo; sin operadores, credenciales ni payloads privados.

## Comprobación

470 pruebas Node pasan. Suite del builder23casos y QA n8n37734 con43assertions: esquema real sin request_id → protocolo con null → parser → cuerpo Guard de siete campos → proof simulado correlacionado. Negativos para creación/publicación sin ID/null/distinto siguen rechazados. Cero solicitudes Guard/CMS en esa QA.

Dos ensayos del ZIP ensamblado pasan: arranque CommonJS y bloqueos de rutas sin estado confiable. Tras activar se restauró el draft ajeno ab60c994… a nuevo31466116-ce37-49c7-8ca1-380e0e45e49d (112nodos); el grafo ACTIVO137nodos se releyó idéntico al preparado. No publicar ese draft ajeno como si fuera el activo.

Observación runtime37740, sólo lectura con etiqueta de scope sintética: RUNTIME_OBSERVED, versionsMatch=true, noActiveN8nWriters=true y los cinco IDs activos esperados. authorizesRecovery=false/motorTerminationVerified=false. Esa etiqueta no acredita un evento registrado ni la publicación del paquete.

Observación final WEG37735 devolvió FINAL_PUBLICATION_UNCONFIRMED en26s; no autoriza escribir ni modifica el recibo. Se aisló runtime y la segunda lectura CMS37743 devolvió FINAL_PUBLICATION_CONFIRMED en11.4s: pins/huellas/idle correctos, recibo durable y OPURO10513/OPOL3524/LIBERAL397 en publish. No se modificó ni publicó ninguna nota. Evidencia completa en EVIDENCIA_REV19.json. No se infiere borrado ni ausencia de nota de ese resultado incierto.

Probe7IDUF9PeHQ5v331Z restaurado al grafo GET original, inactivo3nodos, sin retención y límite30s original; relectura idéntica.

Motor/suscripción sin cambios en este seguimiento. Receptor, Shared, Form, transporte UPDATE, autor3, imágenes y créditos conservados. DEV no reabrió, descartó, confirmó, reclamó ni publicó la revisión19.

Issue19 permanece abierto hasta aceptación real. Para una nueva prueba el operador debe reabrir el paquete, solicitar /opciones crear literal TODOS y /listo y confirmar la nueva vista. El descarte ya existe: no repetirlo ni usar el hash de revisión19.

## Reversión

Revertir conjuntamente MCP a32e28420-47ef-4732-b346-22c2708bff49 y Guard a opmx-guard-literal19.zip SHA256518721f59f5803885e852d99f6e884901031310974e6865775074ee91d92c163. No publicar el draft ajeno como reversión. El prompt de materiales descartados y pin68134a5b del helper de imagen no cambian.
