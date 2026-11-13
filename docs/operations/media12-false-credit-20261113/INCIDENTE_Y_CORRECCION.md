# Servidores IA12 — bloqueo incorrecto por crédito y diagnóstico omitido

**Estado: `DEPLOYED_RUNTIME_CHECK_PENDING`.** Guard, MCP, colector y prompt están desplegados y comprobados. La lectura real de runtime a través de Guard devolvió `RUNTIME_OBSERVATION_UNAVAILABLE` y requiere diagnóstico antes de intentar la recuperación. La operación administrativa nueva no se ha llamado; no hay una publicación ni un acuse nuevo de Telegram que declarar.

## Incidente comprobado

| Campo | Identidad conservada |
| --- | --- |
| Paquete | `tg_efdabf64148316df03e230122001e7311843a4ab` |
| Revisión | `READY12` |
| Decisión confirmada | `CREATE` / `EDITORIAL` / `OPURO` |
| Preview | `c9e8d104ad0a913dad217a07f1f6c38ae9ee11fa1a82e62e25df8d5007c5ff3b` |
| Solicitud canónica | `tg_f88d93dd0e24308affc30991c0f8e34d97a1ce9697ef802d2084bc0798879ddb` |
| Evento registrado | `evt_370af274f74d9d59687a056bb94d4807e6106ff868ca151d` |
| Imagen | `ti_46b87c8a8a461b3fb072371f9c71ec766db0f617`, ordinal4 del inventario íntegro |

El intento original se reclamó a las16:45:14UTC. La recuperación anterior de un intento `RUNNING/AWAITING_DECISION` se confirmó a las17:30:21UTC y permitió leer los materiales. Luego el Motor volvió a detenerlo: el seguimiento1863 registró solamente `MEDIA_FAILED` a las **17:32:52.851UTC / 11:32:52.851CDMX**. La alerta administrativa1864 se registró a las17:36:48.272UTC. No se guardó un stage `DIAG|...` con causa y elemento específicos para ese bloqueo.

La respuesta final del Motor explicó que el JPEG mostraba servidores, coincidía con el tema y carecía de crédito/procedencia. Afirmó haber verificado SHA256 de los siete materiales y cerrado el intento con `ATTEMPT_BLOCKED`, sin reconocer la decisión ni escribir en WordPress. Esos acuses de su ejecución deben distinguirse de una publicación: el inventario continuaba `READY12`, sin resultado durable de Publisher.

La revisión técnica independiente pudo abrir el JPEG original: **341532bytes, 1732×908, RGB**, SHA256 `86cc9ec693d748833063498af43b45e410ca9f91c7bfcee1f736e9df065d1ddd`. Que el archivo sea legible no acredita su autoría ni permite declararlo IA. No se atribuye a este archivo la confirmación de IA que pertenecía a otro paquete.

## Dos fallos distintos

1. **Bloqueo editorial incorrecto.** La política vigente ya permitía dejar vacíos crédito y leyenda de una fotografía ordinaria cuando no se proporcionaron. El contrato MEDIA admite crédito vacío; el Motor no debía exigir metadatos de procedencia de forma general ni inventar autoría. Una composición con indicios concretos de ambigüedad conserva su revisión correspondiente, pero la ausencia de crédito por sí sola no acredita ese supuesto.
2. **Diagnóstico omitido.** El monitor administrativo no perdió una causa que estuviera registrada: reprodujo el fallback de un `MEDIA_FAILED` sin diagnóstico estructurado. El prompt contenía una instrucción final contradictoria que todavía mandaba códigos legados5–11, pese al bloque inicial que exigía el catálogo específico.

No corresponde corregir el mensaje del administrador suponiendo que toda falla de imagen significa falta de crédito. Tampoco corresponde declarar la imagen como IA para eludir el bloqueo ni pedir que se reenvíen los materiales íntegros ya almacenados.

## Corrección preparada

### Política y comunicación del Motor

`MOTOR_PROMPT.txt` elimina la orden de emitir bloqueos legados5–11. La variante antigua queda sólo para progresos0–4; todos los bloqueos nuevos, incluidas las continuaciones manuales, usan el catálogo fijo y la codificación:

```text
1099511627776 + revision_READY_real*16384 + itemOrdinal*256 + codeId
```

La revisión ordinaria de fuentes se comunica como aprobada sólo si pasó integridad y coherencia. Los errores de herramientas, integridad, lectura, generación, formato, dimensiones o recorte utilizan la causa realmente observada; no se inventa una discrepancia SHA desde un error técnico. La lectura histórica de los mensajes legados del backend se conserva.

El prompt refuerza la regla existente de crédito vacío para fotografías ordinarias y mantiene las mismas reglas en el flujo automático y en una continuación manual. Los46códigos y los pins de selectores, compilación literal e imagen permanecen intactos. La capacidad de recuperación no sustituye las pruebas editoriales, el reconocimiento de la decisión ni el cierre del escritor.

Prompt propuesto: **64168caracteres / 64992bytes UTF8**, SHA256 `91e7dbdf0545efbcf5bf804453484d8e90a592ca0eb0993501c87a54b213d35c`. El baseline anterior permanece en `ISSUE31_MOTOR_AFTER.txt`; el diff exacto y las comprobaciones se encuentran junto al nuevo prompt. La instalación exacta de ese prompt ya fue verificada; se conservaron el mismo Motor, sus suscripciones, horario y estado habilitado.

### Reanudación administrativa de un bloqueo sin efectos

La recuperación anterior sólo admitía `RUNNING/AWAITING_DECISION`; repetirla sobre un intento `BLOCKED` no reanudaba el flujo. La nueva operación exige un administrador configurado y la misma identidad READY, revisión, evento, decisión confirmada y preview. Se limita a `CREATE EDITORIAL`; no abre compatibilidad nueva para LITERAL o UPDATE.

Bajo los bloqueos reales comprueba cuota, paquete, intento `BLOCKED`, fence `RECONCILING`, ausencia de sesión/lease y ausencia de una auditoría previa `RESUME_UNWRITTEN` para esa revisión. Rechaza cualquier reserva, target, medio, reclamación, aceptación de Publisher, recibo o trabajo UPDATE, incluso cuando todavía no exista un ID de post. Verifica los materiales activos y su SHA contra la decisión confirmada, siete bindings/clases canónicos, las cancelaciones vigentes y el gate completo de los cinco escritores fijados.

La captura de política debe conservar la solicitud, modalidad, destino, autorización y todos los resultados `BLOCKED/NO_PUBLICATION_SIDE_EFFECTS_CONFIRMED`, sin postId. Sólo entonces invalida la capacidad anterior, guarda la nueva capacidad privada, retorna el mismo intento a `RUNNING/AWAITING_DECISION` y registra `RESUME_UNWRITTEN` en el mismo COMMIT. Conserva paquete, revisión, evento y request_id; no crea otra confirmación editorial, una sesión Telegram o un Motor.

`BLOCKED_UNWRITTEN_ATTEMPT_RECOVERED` exige todavía el reconocimiento normal de la decisión. Devuelve `writeAuthorized:false`, `reopenAuthorized:false` y `retryPermitted:false`; la capacidad nunca se guarda en esta documentación. Un COMMIT o limpieza sin acuse confirmado produce incertidumbre y obliga a observar, sin repetir la recuperación. No se usa un timeout, la ausencia de aviso o un SELECT parcial como prueba de ausencia de efectos.

### Ejecución administrativa y observación real de n8n

La llamada nativa de recuperación mantiene activa su propia ejecución MCP mientras el Guard observa n8n. El colector ahora puede consultar, mediante su credencial existente de sólo lectura, los metadatos reales de esa ejecución exacta. El contexto `nonWritingRecoveryExecution` lo deriva la adaptación HTTP autenticada del workflow/ejecución nativos; no forma parte de los argumentos públicos de la herramienta ni puede obtenerse de una fuente editorial.

`administrativeExecutionProof` proyecta únicamente `id`, `workflowId`, `workflowVersionId`, `mode`, `status`, `startedAt` y `stoppedAt`. Exige una ejecución MCP `webhook/running`, con versión real igual al pin, sin cierre y con una coincidencia única en la página completa de ejecuciones. El scope de paquete/revisión/evento/nonce sigue teniendo cuatro claves y todas las páginas y grafos se conservan. Sin ese contexto no ejecuta el GET adicional y devuelve prueba nula.

La API observada no devuelve runData upstream para esta ejecución; **no se afirma que la API haya observado la acción interna del MCP**. La identificación administrativa combina la aserción del adaptador HTTP autenticado/fijado con los metadatos reales consultados. La ejecución sigue visible y `noActiveN8nWriters` permanece falso mientras está activa. Sólo ese gate acotado puede reconocer que no es un escritor de publicación; cualquier otro trabajo activo, prueba ausente o dato incompatible conserva el rechazo. No afirma terminación física de ChatGPT.

## Versiones y conservación

| Componente | Estado de este corte |
| --- | --- |
| MCP activo comprobado | `d5643470-197c-484e-8742-ca69462cb608`,155nodos y grafo exacto; tres cambios de parámetros. Grafo `f417fd8994556806e7193c23513ea8a5e122c1e13227e2b074f398ad14a29846`. |
| Borrador MCP preservado | El borrador112 se restauró idéntico, con retenciónnone, en `3648414f-92df-490b-93c3-6da005393a7f`. La versión activa anterior era `cf4f65ab-35b6-4120-a36d-ddce2e94b91c`. |
| Colector publicado | `ee6b5d38-f736-4a01-9461-030b596e3a58`,13nodos; grafo `fafd8fb10bf4721e3b51b4ad7f64a7c9b424a2ac8e5acef6cf6324151f622bc9`. Borrador9 restaurado idéntico, con ajustes/retenciónnone, versión `89d76e04-2d7f-4064-a30c-db7ff6b6dc73`. |
| Ajustes y grafo del colector | n8n omitió valores por defecto `retryOnFail:false` y `onError:stopWorkflow` al agregar el nodo. La comparación canónica incluyendo ajustes resultó equivalente; no se trató la diferencia de serialización como otro comportamiento. |
| Guard Actual/completado | `opmx-guard-media12-verified-recovery.zip`,227406bytes,90archivos, SHA256 `efaa335614046c2f7d197e931f8a267d49c98baafbf85c8083424401910103f0`. Completado a las12:01:15CDMX /18:01:15UTC. |
| Pines | Sólo cambia el pin MCP al preparado; los otros cuatro escritores permanecen iguales. El colector no es uno de esos cinco escritores. |
| Motor | Prompt instalado y verificado:64168caracteres/64992bytes, SHA256 `91e7dbdf0545efbcf5bf804453484d8e90a592ca0eb0993501c87a54b213d35c`. Motor, suscripciones READY/preview, horario y estado habilitado preservados. |

El ZIP difiere del release anterior en siete archivos: añade `blocked-unwritten-attempt-recovery.mjs` y modifica `motor-attempt-store.mjs`, `motor-runtime-services.mjs`, `revision-reconciliation.mjs`, `runtime-observation-client.mjs`, `writer-release-contract.mjs` y `writer-release-manifest.mjs`, todos bajo `tools/telegram/guard-recovery-candidate/`. No contiene un escritor CMS nuevo.

## Comprobación y pendientes

- **189pruebas únicas PASS** en la revisión dirigida, sin volver a sumar las regresiones que compartían archivos de prueba.
- Arranque aislado del ZIP: **1respuesta401 y12respuestas503 PASS** ante ausencia simulada de MySQL. Esa prueba no se conecta a producción ni acredita recuperación o publicación.
- JPEG original legible, bytes/huella y dimensiones comprobados; no se modificó su atribución ni se infirió IA.
- Lectura real de runtime39761: POST de sólo lectura a Guard, sin origen administrativo, devolvióHTTP503 / `RUNTIME_OBSERVATION_UNAVAILABLE`. La causa todavía no quedó identificada. No se llamó a la recuperación para probar si avanzaba.
- QA nativo39767: copia del colector13 en un probe inactivo/manual de14nodos, sólo lecturas. Pasaron el IF real, cinco GET de versiones, Code final, schema, versiones y páginas completas; la prueba administrativa fue nula. Duración1.1s. El cliente nuevo aceptó localmente esa respuesta; esto no acredita el transporte real Guard→n8n.
- Probe restaurado a sus tres nodos, inactivo, grafo/conexiones/ajustes exactos, retenciónnone y límite30s; versión `ebaa160a-5d30-4add-85d6-9b9c8725716f`.
- Pendiente: identificar la causa de la lectura runtime real y confirmar ese transporte antes de una operación administrativa de recuperación.
- Pendiente: reconocimiento de decisión, validación de archivos, resultado durable por destino y acuse Telegram, si la recuperación real es admitida. Hasta entonces no se declara la nota publicada ni se repite Publisher.

El detalle estructurado está en `release.json`. Toda actualización posterior debe añadir el acuse real y mantener separadas preparación, despliegue, recuperación y publicación.

## Diagnóstico de transporte posterior

Guard actual/completado observado a las12:12:32CDMX: `opmx-guard-media12-runtime-diagnostics.zip`,90archivos/227866bytes, SHA256 `cc21457b71ea1c8d69d852fcc07b93d6572e43c0492f39ba5730a19be097fdf2`. Sólo cambia `runtime-observation-client.mjs` frente al ZIP inicial de esta corrección; añade causas técnicas acotadas sin cuerpos, headers, excepciones ni capacidades. No relaja ningún gate. El archivo exacto se conserva junto a este documento.

La lectura39776 agotó el plazo exterior25s; no se obtuvo un diagnóstico interno ni se invocó recuperación. Una lectura39787 usa45s para permitir que termine el plazo30s del observador; sigue pendiente de acuse y posterior restauración del probe. No repetir una publicación: no se ha llamado al nuevo reanudador ni a Publisher desde esta intervención.
