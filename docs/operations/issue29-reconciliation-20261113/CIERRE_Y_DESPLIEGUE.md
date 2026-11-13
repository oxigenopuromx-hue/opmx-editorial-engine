# Issue29 — cancelación dirigida y recuperación de intentos

**DESPLEGADO Y VERIFICADO — 13nov2026.** Guard figura Actual/completado en Hostinger (inicio09:36:57CDMX; detalle completado09:38). Fuente funcional [feb31a5](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/commit/feb31a5355a44f87c6635e19f842d4d671073127) y ajuste de continuidad HTTP del monitor [d1b9eda](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/commit/d1b9edab88b29170c66be65c85422ee88d7a493d).

El incidente técnico del #29 queda conciliado: cancelación durable de Simey/LIBERAL y dos paquetes habilitados para el flujo auténtico de reapertura. No se publicaron notas, no se creó una revisión OPEN/READY nueva ni se fabricó la confirmación editorial. Waldo y China–Cuba ya estaban conciliados y no se intervinieron. La cancelación general28 permanece diferida.

## Alcance exacto

| Caso | Identidad | Resultado autorizado |
| --- | --- | --- |
| Simey | Paquete `tg_00991fbbd87a751fb8513f4d4f6fcebca8469bee`, READY10; request `tg_e6400942bcd85878aaa03f722f03b7644261071d6339593c2dede692f582edbf` | Cancelar únicamente la entrega pendiente LIBERAL393; conservar OPURO10493 y OPOL3515 publicados. |
| Servidores IA | Paquete `tg_efdabf64148316df03e230122001e7311843a4ab`, READY9; request OPURO `tg_d4e7c89e61a84bfedbddb912bbf7f7d477b934463503810bdf9788b6faae9560` | Conciliar y cerrar la capacidad anterior; comprobar que puede solicitarse `/abrir` auténtico. |
| Comisión Morena | Paquete `tg_c11966b7bf1994c072c1e54999dfbd3579f619fb`, READY8; request TODOS `tg_91608877b6314f8e579ccd003076521a1984a11144defc8f17c0866ac98621f4` | Conciliar el histórico sin intento registrado y comprobar la misma continuación mediante el bot. |

La lectura autenticada exacta de WordPress, ejecución **39144**, observó OPURO10493 y OPOL3515 en `publish`, con slug `simey-olvera-innovacion-tecnologica-reducir-desigualdades`. LIBERAL393 ya estaba en `trash`, con ese slug más `__trashed`. Esta intervención no lo envía a la papelera, restaura, elimina, recrea ni publica. El estado observado no es un borrador ni una prueba de ausencia del post.

La antigua conciliación38084 verificó resultados BLOCKED con ROLLBACK; no concedió autoridad para escribir o reintentar. Los resultados posteriores `ATTEMPT_ALREADY_CLAIMED` y `ATTEMPT_NOT_REGISTERED` tampoco liberaron las revisiones.

## Comportamiento implementado

La cancelación administrativa exige el alcance exacto de Simey10/LIBERAL393 y la operación estable `requested-20261113-issue29-simey-liberal`. Bajo los bloqueos de cuota, paquete, intento y fence comprueba el evento, siete bindings/clases canónicos, controles originales íntegros, tres targets originales y runtime de escritores completo, fijado e inactivo. Sólo admite LIBERAL393 en `draft` con slug original o en `trash` con el sufijo exacto; los otros dos IDs deben seguir publicados. Rechaza estados desconocidos,404, identidades distintas, jobs UPDATE y recibos PUBLISH incompatibles.

La transacción guarda el registro inmutable de cancelación, evidencia y SHA256 en `opmx_tg_destination_cancellations_v1`, registra auditoría, revoca la capacidad previa si existe y conserva el fence `RECONCILING`. No modifica WordPress ni los ledgers y recibos históricos de publicación. La cancelación se consulta antes de las rutas de CREATE, medios, UPDATE, consumo, selección, vista y reconocimiento de decisiones, también para revisiones futuras del mismo paquete. Una cancelación persistida nunca puede volver a heredar automáticamente el destino LIBERAL de la autorización original TODOS.

Un COMMIT sin acuse confirmado devuelve incertidumbre y exige **observar**, sin repetir la mutación. El observador de cancelación es sólo lectura: comprueba el registro/hash, auditoría, fence, revisión, runtime actual y CMS exacto. Sólo entonces informa el resultado mixto `PUBLISHED`, `PUBLISHED`, `CANCELLED`; mantiene `wordpressStatus: trash` para393 cuando ése es el estado real. No lo convierte en un recibo PUBLISH ni afirma tres publicaciones. Un fallo al terminar ROLLBACK o liberar la conexión impide devolver confirmación.

Para IA y Morena, `freeze-unwritten` admite cero o un intento, conservando la prueba completa de ausencia de efectos. No fabrica un intento, token, evento, request o recibo Telegram. Después del COMMIT, `recovery-readiness` comprueba con ROLLBACK el mismo alcance e inventario, los controles y la disponibilidad de sesión/lease. Conserva READY y la revisión original. El valor `nextOpeningRevision` es una posibilidad verificada, no una revisión creada.

### Rutas administrativas

Todas conservan la autenticación Guard y las comprobaciones de administrador; no se incluyen credenciales ni identidades privadas en este documento.

| Ruta POST | Contrato y efecto |
| --- | --- |
| `/v1/telegram/destination-cancellations/cancel` | `owner,chat,packageId,revision,requestId,destination,postId,operationId` exactos; única cancelación dirigida autorizada. |
| `/v1/telegram/destination-cancellations/observe` | Observación sólo lectura. El monitor envía únicamente `packageId,revision` y el servidor deriva el alcance fijo. |
| `/v1/telegram/reconciliation/freeze-unwritten` | `owner,chat,packageId,revision`; conciliación durable sin efectos, sin permiso de escritura. |
| `/v1/telegram/reconciliation/recovery-readiness` | Comprobación administrativa sólo lectura de la continuación elegible; no abre sesión. |

El próximo paso editorial sigue siendo un `/abrir <paquete>` real recibido por el bot. Después se revisa el inventario, se usa `/listo` y se confirma la vista vigente. Work no fabrica el recibo Telegram ni la confirmación del operador. La revisión siguiente y su request se derivan mediante el flujo canónico; el snapshot conserva la identidad histórica. Este despliegue no acredita ni realiza publicaciones de IA o Morena.

## Release y preservación

Guard activo: `opmx-guard-issue29-reconciliation.zip`, **221553 bytes**, **89 archivos**, SHA256 `a86b41d24792266f8270cdce750f27d818a42532bb51eecba7f1254dcca3af31`. Frente a Guard31 hay 82 archivos idénticos, 5 modificados y 2 nuevos. El manifiesto de escritores permanece idéntico.

Los cinco módulos modificados son `tools/mcp-publisher/guard-server.mjs`, `cms-observation-client.mjs`, `fence-preview-start.mjs`, `motor-runtime-services.mjs` y `unwritten-attempt-freeze.mjs`; los últimos cuatro están en `tools/telegram/guard-recovery-candidate/`. Se añaden allí `destination-cancellation.mjs` y `destination-cancellation-enforcement.mjs`. La aceptación del slug `__trashed` es optativa y exclusiva del observador de cancelación; el reconciliador normal no amplía sus estados aceptados.

El monitor administrativo `NFOBzPfHmvRjVFOA` está activo en `b3a4b97f-315e-481b-9108-dd6ac629fae1`:18 nodos, cuatro cuerpos Code existentes modificados y dos nodos nuevos, HTTP y Code. La candidata inicial602e9c32 fue seguida por una corrección explícita de tres ajustes HTTP que addNode no había aplicado: continueRegularOutput, alwaysOutputData=true y retryOnFail=false. Los cinco cuerpos Code y42checks del QA39151 son idénticos. Huella canónica JSON del grafo final: `071eae20f260119ab9e1203defb8852f22ac124b055b01302d0748c115cabf9a`. El diseño conserva la distribución previa del canvas; no agrupa ni reorganiza nodos ajenos.

El monitor sólo suprime la incertidumbre obsoleta de esa solicitud/revisión tras prueba Guard exacta y acuse INSERT completo del stage `DELIVERY_CANCELLED_RECONCILED|<hash>`. No genera `PUBLICATION_RECONCILED` para esta cancelación, no borra historia y conserva los diagnósticos31, sus límites de mensaje y la conciliación30.

Se conservan el mismo Motor, las suscripciones READY/vista previa, el MCP productivo, los cinco pins de escritores, las validaciones LITERAL, autor3 de El Liberal, el cierre atómico18 y la autoridad de categorías/home13. No se crea otro consumidor ni se cambia la autorización editorial vigente.

## Validación completada

| Comprobación | Resultado y límite |
| --- | --- |
| Suite local dirigida | **252 pruebas PASS**. Incluye cancelación, corrupción de evidencia, gates de escritores, históricos sin intento, HTTP y cleanup. Es una suite única; no sumar de nuevo sus subconjuntos. |
| Code QA real de n8n | Ejecución **39151**, **13 casos y42 comprobaciones PASS**, con los cuerpos reales del monitor. Sin llamadas de red, escrituras de tabla ni mensajes Telegram en la prueba. |
| Arranque CJS aislado del ZIP | **23 respuestas401 y23 respuestas503 PASS**; arranque/listen síncrono. MySQL simulado no disponible, cero conexiones reales, escrituras CMS o mensajes. |
| Comparación de release | 89 archivos; 82 idénticos a Guard31; manifiesto de escritores sin cambios. |

Estas pruebas no sustituyen el acuse productivo de cada operación ni demuestran por sí mismas una reapertura o publicación real. El resultado operativo final debe leerse en la tabla siguiente y en `release.json`.

## Acuses operativos confirmados

| Paso | Resultado real |
| --- | --- |
| Guard | Hostinger Actual/completado; observación39161 HTTP200, cinco pins/grafos coinciden y ningún escritor activo. Una lectura inicial durante el reinicio no produjo JSON;39159/39161 confirmaron la respuesta correcta antes de operar. |
| Monitor |18 nodos, activo finalb3a4b97f; cuerpos Code coinciden con QA y ajustes HTTP confirmados. `admin-final-activation.json`. |
| Simey |39167: cancelación confirmada, fenceRECONCILING e intentoREVOKED. Registro/hash `0e21b0ae331669f22c8be9807ce5611e85b2413a6e7f048184fed519446b2d1f`. Se invocó una sola vez. |
| IA9 |39163: freeze durableREVOKED.39172: RECOVERY_READY_REQUIRES_BOT_OPEN; seisSTORED, ceroPENDING, mismaREADY9. La siguiente apertura auténtica sería10. |
| Morena8 |39165: freeze durableABSENT, sin crear intento.39172: mismo resultado de elegibilidad; cuatroSTORED, ceroPENDING, mismaREADY8. La siguiente apertura auténtica sería9. |
| Cancelación observada y writer tardío |39172 reconfirma dosPUBLISHED y393CANCELLED/CMStrash; el inicio de escritura LIBERAL con la solicitud original recibe409sin permiso. |
| Seguimiento administrativo |Cron natural39176,15:41:48–54UTC: INSERT confirmado de fila1839 con stageDELIVERY_CANCELLED_RECONCILED y el hash exacto/request original. Cero alertas seleccionadas; Notificaradministrador no ejecutado. Se conservan incertidumbre1637 y alerta1638 en historial. |
| Limpieza y Motor |Probe inactivo, tres nodos y grafo/ajustes originales exactos (none/30s), versión20b997bc. Motor único60558caracteres coincide exactamente con el prompt31SHA3215…; suscripciones intactas. `cleanup.json`. |

Las operaciones de mantenimiento no contienen un proveedor de escritura CMS. Se conservaron los tres IDs de Simey y el estado TRASH ya observado; no se restauró, eliminó, publicó ni editó ninguna nota. La recuperación editorial de IA/Morena requiere la acción auténtica del editor en el bot, con su vista y confirmación. `RECOVERY_READY_REQUIRES_BOT_OPEN` no afirma que una nota esté publicada ni concede permiso de repetir la revisión vieja.

## Continuación del operador

Desde la cuenta administradora, abrir y terminar un paquete antes de abrir el siguiente:

Servidores IA:
```text
/abrir tg_efdabf64148316df03e230122001e7311843a4ab
```

Comisión Morena:
```text
/abrir tg_c11966b7bf1994c072c1e54999dfbd3579f619fb
```

En cada caso, revisar `/estado` y los elementos existentes; usar `/listo` y confirmar únicamente la vista que devuelva el bot. No reenviar los materiales ni ejecutar iniciar_intento sobre9/8. No usar estos pasos con Simey para reactivar LIBERAL.

El detalle de reversión está en `ROLLBACK.md`: conservar el registro de cancelación, auditoría y fence. No volver a un Guard que ignore esa autoridad.
