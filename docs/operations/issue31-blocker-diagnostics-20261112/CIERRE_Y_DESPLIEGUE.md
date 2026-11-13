# Issue31 — causas y acciones de bloqueos Telegram

Estado: **DESPLEGADO Y VERIFICADO**. Guard aparece Actual/completado el12nov2026 a las22:20:03CDMX (13nov04:20:03UTC); MCP y monitor administrativo activos coinciden exactamente con sus candidatas verificadas. El Motor único conserva su identidad, suscripciones y prompt previo como sufijo exacto.

Fuente: [adc426fbc3b8903991efde0f18833453673ae50e](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/commit/adc426fbc3b8903991efde0f18833453673ae50e), local219edc4.

## Comportamiento

Un bloqueo nuevo puede indicar **causa comprobada, dato afectado y cómo continuar**, en el mensaje del operador y en el aviso al administrador. El catálogo tiene46códigos fijos: procedencia/crédito obligatorio de imagen, archivo/recorte/formato/dimensiones, generación de imagen, PDF/URL/texto, coherencia e integridad, campos editoriales, modo literal, categorías, permisos, conflictos y resultados de Publisher. Categorías y permisos tienen variantes explícitas para OPURO/OPOL/LIBERAL cuando ese sitio está acreditado en el resultado observado.

No se inventan causas desde una etapa genérica. Un MEDIA_FAILED antiguo informa que esa revisión no guardó un motivo más específico; no se transforma retrospectivamente en falta de crédito. El paquete del ejemplo `tg_3f682b3ea4561f11a423a483b636ca85ac96fb77` no se reabre ni se procesa de nuevo por este cambio; el incidente citado correspondía a versión8 y la revisión posterior12 se conserva.

Una fotografía ordinaria no pasa a requerir crédito obligatorio de forma general. `IMAGE_ORIGIN_UNCLEAR` pide aclarar fotografía/composición/IA sin asumir que sea IA. Si la generación con IA ya está acreditada y únicamente falta su identificación estándar, es una corrección del Motor y no otra declaración exigida al operador.

Las acciones sobre materiales empiezan por abrir el **mismo paquete**, señalan el dato que falta y solicitan una vista con `/listo` antes de confirmar. Sólo un ordinal comprobado contra el inventario puede identificar un elemento. Para sustituir una copia defectuosa se puede ofrecer `/descartar <itemId>` tras abrir el paquete, conservando el original en historial. No se crean paquetes nuevos ni reenvíos automáticos para sortear bloqueos. Una respuesta parcial o incierta de Publisher pide estado/conciliación, no repetir a ciegas.

El alcance extendido es **READY**: preparación editorial, medios, fuentes, validación y resultado de Publisher, con su seguimiento administrativo. Los códigos descriptivos de preview quedan reservados y **no habilitan** mensajes de revisión OPEN por la ruta READY. Las vistas abiertas conservan su ruta y sus permisos existentes.

## Cambios y preservación

| Componente | Versión de esta entrega | Cambio |
|---|---|---|
| MCP `bnzVMNkZuGO1GQCZ` |`29702889-430d-4a87-952a-a9ef6c5b6ece`|155nodos/6grupos; cinco parámetros Code exactos. |
| Administrador `NFOBzPfHmvRjVFOA` |`cac1f08f-fff4-44ec-bd81-ed2f123287c8`|16nodos; dos cuerpos Code exactos. |
| Guard |`opmx-guard-blocker-diagnostics31.zip`|Sólo cambia el manifiesto de writers para fijar el MCP nuevo. |
| Motor |Mismo `6ae9095256948191b33f1e023fbfbf8b`|Plan60558caracteres, SHA256 `3215baec271d589c859fbe11e29e41fd378db15235e78b88eb06e6ed4c7eea83`; el prompt anterior queda como sufijo exacto. |

ZIP: **212023bytes/87archivos**, SHA256 `bbbd1e46cf4d5d930eca2d769866704f2bd98d6f640bcde86abdbc1efd85e323`. Frente al Guard13,86archivos permanecen byteidénticos y sólo cambia `tools/telegram/guard-recovery-candidate/writer-release-manifest.mjs`. El manifiesto SHA256 es `10810f706bc31d015c240a3b80a8069809801a219de761f9e5a8e0731562ff0d`. No cambia el esquema del almacenamiento ni el contenido de los paquetes.

Se conservan: el único Motor y sus eventos/suscripciones, el cierre atómico18, la autoridad de colocación13, el preflight21 y su copia estática/pin de Shared, el aviso de resultado pendiente24 y la conciliación/deduplicación30. Shared/Form/Reader/UPDATE mantienen sus versiones; el receptor Telegram no se modifica. No hay cambios de credenciales, destinos, autores o condiciones de publicación.

## Transporte y registro

La firma pública de `informar_revision_telegram_opmx` sigue teniendo los mismos tres argumentos. El namespace compatible de entero transporta código/ordinal y se reconoce antes de los alias legacy. Los32slots anteriores conservan su comportamiento. El reporte se resuelve a revisión real, misma identidad/paquete y motivo base; ningún texto, enlace, destinatario o permiso libre se incorpora al mensaje.

La causa editorial se expone como `blocker_diagnostic`, separada del campo anterior `diagnostic`, que sigue describiendo ACK/error de Telegram. El preparador sólo emite un marcador interno de alcance tras comprobar el manifest exacto y, para ordinales positivos, el inventario real sin filtrar/reordenar. IDs RAWcamelCase y MCPsnakeCase deben ser válidos, coincidentes cuando existen ambos y únicos; material noSTORED o una posición inexistente no acreditan un detalle.

Si falta el alcance o está vieja la revisión, el formatter devuelve `FAILURE_NOT_SENT`, sin causa persistible. Un envío efectuado con alcance validado que termina en ACKincierto o error de Telegram conserva `FAILURE_UNCERTAIN`; su causa puede quedar registrada para administración sin afirmar entrega ni permitir reintento. No se falsea un ACK positivo.

La columna existente `stage` registra el carrier acotado `DIAG|BASE_REASON|CODE|ordinal`; `request_id` conserva exclusivamente su función de correlación. El monitor normaliza a la etapa base antes de las comprobaciones30, mantiene la identidad original de la fila y sólo registra ACK de las alertas efectivamente incluidas. El presupuesto conservador de3800unidades JS selecciona un prefijo de alertas completas; no corta causa, paquete ni remedio. El resto queda para la siguiente lectura.

**Persistencia best effort:** no se añade un outbox durable de mensajes/telemetría. Una interrupción entre envío y registro, o un fallo del INSERT, puede dejar la causa sin fila de seguimiento. Esto no autoriza reenviar mensajes inciertos ni afirmar que llegaron. Tampoco una etapa de bloqueo por sí sola demuestra ausencia de escrituras o publicación; las afirmaciones de rechazo antes de escribir requieren la respuesta explícita correspondiente.

## Comprobaciones existentes

| Evidencia | Alcance y resultado |
|---|---|
| n8n38791 |91comprobaciones PASS sobre los cinco cuerpos Code reales, más el protocolo legacy original;32slots comparados, límites, scopes, ordinales, ACKincierto y datos inválidos. Sin eval, require, cambios de prototipo, red, DB, CMS o Telegram. `mcp-code-qa.json`. |
| n8n38793 |17casos/52comprobaciones PASS sobre los dos Code reales del monitor y una función de conciliación30 conservada. Incluye campos por sitio, carriers inválidos, incertidumbre parcial, dedup y prefijo de veinte alertas con continuidad. `admin-code-qa.json`. |
| Nativo |El registro de validación reportó46pruebas dirigidas PASS y100pruebas de regresión administrativa/conciliación PASS; son conjuntos con solapamiento y no se presentan como una suma. Se añadió además un check unitario del arnés Code. |
| Startup |CJS síncrono, un listen/una pool;19casos sin autenticación401 y19autenticados con DB no disponible503, sobre18rutas únicas. Sin conexiones DB reales ni red externa; el mock no está en el ZIP. `startup.json`. |
| Comparación de versiones |Los cinco parámetros MCP y dos Code administrativos son el delta exacto; nodos, conexiones, grupos y resto de parámetros se conservaron. Versiones/huellas en `stage.json`; activación confirmada por `final-readback.json` y `independent-final-readback.json`. |

Estas pruebas sintéticas no afirman una nueva entrega Telegram real ni una publicación editorial. No se creó, editó ni publicó ninguna nota para probar este cambio, ni se reintentó automáticamente un paquete bloqueado. Las evidencias anexas contienen resúmenes, IDs técnicos y hashes, no prompts, credenciales, nodos completos ni cuerpos de fuentes. El procedimiento de reversión está en `ROLLBACK.md`.

## Readback final

El endpoint autenticado de observación respondió HTTP200 en n8n38814: cinco versiones/huellas de writers coinciden, sin autorizar recuperación ni realizar escrituras editoriales. El cliente público aceptó el carrier nuevo y rechazó correctamente una revisión deliberadamente vieja del paquete del incidente: `FAILURE_NOT_SENT / REVISION_MISMATCH`, sin permiso de reintento ni aviso enviado. No se repitió el paquete.

El probe manual quedó inactivo, tres nodos, grafo y ajustes originales exactos (retención none y timeout30s). El borrador MCP112 fue preservado exacto. La verificación independiente confirmó también los otros cuatro writers, el receptor y sus ajustes sin cambios.
