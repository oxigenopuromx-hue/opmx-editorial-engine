# Tecámac revisión23 — conservar una publicación ya confirmada

12nov2026. Corrección de avisos/conciliación; ninguna publicación ni edición CMS desde DEV.

## Publicación acreditada

Paquete tg_dd8ff15fbc93b83b3e579c4266d5aea4bcf2be7b/revisión23, request tg_ada79f9b78fbf8ad073b6ced861a2d8c0dbdca7cd517b7185b99cd7eb9de3917. Guard confirmó recibo durable PUBLISH/TODOS y los tres CMS en ejecución del monitor37870, observado23:06:55.860UTC: OPURO10528, OPOL3537, LIBERAL408, slug samuel-hernandez-observaciones-asf-tecamac; receiptHash9f66b3931e4e0d20e9267326f1f324902a280a4b3426606bf6a5189da4eb2812. WritersIdleVerified/consistentSnapshot=true. Esta es evidencia de publicación confirmada entonces, sin permiso nuevo de escritura.

El Motor998d3e97-8974-8326-bb7a-7b2ed9a7d299 recibió error interno de su única llamada a Publisher y conservó incertidumbre. Antes habían pasado integridad, prueba LITERAL de Guard y ACK de decisión. El usuario recibió los tres enlaces. La pérdida/error de respuesta no demuestra que el backend se detuviera; la causa exacta de transporte sigue en24 y no se atribuye aquí a un timeout concreto.

## Causa exacta de la alerta tardía

Tabla: DRAFT_UNCERTAIN1750,23:05:50.784UTC. Monitor37870 (23:06:48–23:06:59) obtuvo FINAL_PUBLICATION_CONFIRMED y produjo cero avisos, pero no guardó la conciliación. Monitor37876 (23:11:48–23:11:58) volvió a observar el mismo1750; recibió HTTP200/FINAL_PUBLICATION_UNCONFIRMED en9.4s y emitió ALERT_ADMIN1751. No fue un timeout HTTP30s en esa ejecución. No se sabe qué condición interna del observador falló; el problema comprobado es que un resultado ya confirmado se perdió entre ciclos.

## Cambios instalados

1. El monitor persiste PUBLICATION_RECONCILED sólo después de una prueba final PUBLISH completa/autenticada y de verificar el INSERT retornado con ID positivo y todos los campos package/revisión/request/stage/fecha. La fase DRAFT, un parcial, error, respuesta vieja o scope ambiguo no generan esa fila.
2. Esa entrega histórica confirmada resuelve incertidumbre/progreso de la misma solicitud/revisión aunque la próxima consulta falle o llegue un progreso tardío. No afirma que un CMS deba seguir publicado para siempre. Otros bloqueos de contenido/fuentes, solicitudes explícitas diferentes y revisiones distintas siguen visibles.
3. Se contemplan los siete bindings canónicos que tiene cada revisión: el recibo Guard válido selecciona la solicitud efectiva entre ellos. Una etapa legacy sin request_id puede resolverse con un único terminal válido ligado a un binding. Dos solicitudes terminales distintas mantienen la ambigüedad; no se agregan filas repetidas intentando imponer una.
4. Las incertidumbres ya notificadas siguen conciliándose en ciclos posteriores, sin reenviar su aviso si continúa UNCONFIRMED o falla INSERT. Los candidatos nuevos tienen prioridad antes del límite20.
5. El aviso inicial DRAFT_UNCERTAIN/PUBLISH_UNCERTAIN dice «resultado pendiente de confirmación». Los cuerpos, destinatarios, enums, validaciones y reglas de reintento se conservan; fallos deterministas siguen como «proceso detenido». No se habilitaron códigos nuevos.

Monitor NFOBzPfHmvRjVFOA activo efa564a8-3f87-4936-ba1a-2b1a33a0879f,16nodos (antes2d3e18a9-ff68-4f5c-9fdc-ce6a694b1cd6,11nodos). Misma tabla hvKjKjEvTAF4pUms, administrador, remitente y frecuencia cinco minutos. Cinco nodos añadidos y19operaciones incrementales.

MCP bnzVMNkZuGO1GQCZ activo c0de03ed-e7a7-4255-a9c8-9ca76404424e,137nodos; sólo cambian cuatro copias del encabezado. Hash4655c83baa44f05ef5907fd31af7b7810310e543e398b685900b5c02cc588873. Draft ajeno31466116… restaurado como a51f2379-c534-467d-8d8a-cca996f489e7 (112nodos); no publicarlo como si fuera el código activo.

Guard vigente opmx-guard-publication-status23.zip, SHA256028b71d5c5c35060e8fd92f80b0736d0a7d4b5c4b8ba8ca02acf1853de1d518c, Hostinger completado/Actual12nov17:24:57CDMX. Única diferencia runtime respecto al ZIPcef58abf… es writer-release-manifest.mjs con el nuevo pin MCP. No se cambió ninguna protección del escritor.

Fuentes: bf85fd32fb2c08af513343397038c298671dec68 (encabezado/manifiesto) y a38d80782045fdfc0c24006c125b15f2b6d340f5 (persistencia del monitor). Motor6ae9095256948191b33f1e023fbfbf8b, suscripción READY/preview, receptor, otros escritores, autor3 y modo literal permanecen iguales. No se añadieron credenciales, consumidores ni tablas.

## Conciliación del caso existente

Se reconstruyó la fila faltante desde la prueba Guard auténtica retenida de37870. PUBLICATION_RECONCILED1752 conserva occurred_at=23:06:55.860UTC y request exacto; creada23:20:19.721UTC. Es una conciliación histórica, no una nueva comprobación de disponibilidad actual de CMS. La consulta independiente37886 posterior fue UNCONFIRMED; no se ocultó ni se usó como prueba positiva. La fuente de1752 es el resultado autenticado previo; no se cambió la frescura de Guard ni se fabricó un resultado actual.

Se conservan el bloqueo1750 y la alerta1751 como historia. No se escribió PROCESS_COMPLETE/ATTEMPT_COMPLETED ni se revocó/falseó la capacidad del Motor. No se volvió a publicar, cambió la clave, abrió el paquete ni modificó la nota/medios.

## Verificación

542pruebas Node pasan:470 previas,16 de mensajes y56 de persistencia. n8n37893:17 comprobaciones con fixtures sintéticos, cero escrituras de tabla/CMS y cero envíos. n8n37894: datos reales copiados de esta revisión,15filas,7bindings y reconciliación1752; ejecuta el código preparado real de selección y devuelve0elementos de aviso. No ejecuta el monitor completo ni notifica a nadie.

Relectura de MCP/monitor: ambos activos, grafos idénticos a los preparados. Dos ensayos del ZIP ensamblado pasan (arranque y fallo cerrado de las rutas). Probe7IDUF9PeHQ5v331Z restaurado al GET original, inactivo3nodos, sin retención y límite30s; grafo releído idéntico. Las ejecuciones programadas posteriores son el flujo ordinario, nunca una publicación de prueba.

La publicación LITERAL real23 confirma la aceptación operativa del19, con preflight/decisión/recibo PUBLISH y tres destinos acreditados. La corrección30 resuelve la alerta que podía reaparecer tras un éxito ya confirmado. La causa del error de respuesta de herramienta continúa separada en24; esta corrección no afirma eliminarla.

## Reversión

Restaurar monitor2d3e18a9…; revertir MCP a6d60d83d-a99a-4f06-a201-70b5d292b9da junto con Guard opmx-guard-literal19-validation-scope.zip SHA256cef58abf6b311393c0f22690117947cba3d3edba71834eada4b65c1cd93eb128. Conservar1752 y los recibos como evidencia. No revertir publicando un draft ajeno, borrar historia ni repetir la publicación para comprobar.
