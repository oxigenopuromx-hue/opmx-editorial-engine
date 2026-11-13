# Cierre atómico y diagnóstico de cupo — candidata18

Base de fuente9c934ffa76f0c02717708b7eca8eaebbd732b400, posterior al despliegue21. Trabajada en un worktree aislado, sin cambios productivos, GitHub, CMS, paquetes ni mensajes desde esta implementación.

## Defecto reproducido y corrección

Antes, `/listo` reservaba un control y después hacía otro HTTP para sellar o solicitar vista. Con20elementos, la reserva21 podía quedar STORED aunque el sellado se revirtiera. El siguiente comando tenía otro recibo, encontraba el límite y no podía cerrar. En recuperación ocurre el equivalente al ocupar su último espacio40.

`POST /v1/telegram/packages/close` recibe el mismo cuerpo acreditado que usaba reserve para `/listo`. Bajo los locks y la conexión existentes, guarda el control y sella el paquete ordinario, o crea la vista/solicitud durable de generación de una recuperación. Los resultados no confirmados revierten conjuntamente control, revisión, bytes y outbox. No hay Telegram, Motor, CMS ni llamadas de red dentro de esa transacción.

La nueva llamada no reemplaza los endpoints reserve/seal/preview existentes. El Receiver continúa usando `/listo`; consume READY o la vista ya registrada y conserva las etapas anteriores de entrega y confirmación. La llamada HTTP redundante de vista se reemplaza por un pase local con el mismo ID/nombre/conexiones. Ocho operaciones conservan52nodos y restauran explícitamente el mismo grupo de51miembros.

Si se perdió la respuesta después del commit, un nuevo `/listo` de la misma revisión recupera el resultado durable sin insertar otro control ni otro trabajo. El recibo completo procede del preview/job guardado, no de una reconstrucción del SHA. Se comprueban actor, lease, revisión, últimoSTORED, texto/SHA/bytes y orden del recibo. Un despacho incierto conserva incertidumbre y nunca se reencola por este replay. La entrega normal sigue su propio ledger para evitar repetir una parte incierta.

Límite legado explícito: un control antiguo yaSTORED al límite, cuyo sellado/preview nunca se registró, sólo conserva el SHA de su recibo en items. No se fabrica el recibo completo, no se reemplaza el original y no se aumenta el cupo. Los conteos de capacidad ayudan a identificar si existe actualmente un caso que exige conciliación específica.

## Cuotas y retención

Las denegaciones conservan QUOTA_EXCEEDED y añaden un diagnóstico seguro que distingue elementos ordinarios/recuperación, bytes del paquete, bytes globales y cantidad global de paquetes. Los mensajes del Receiver muestran cifras acotadas y mantienen el fallback para respuestas anteriores. El bloque SEAL maneja la cuota antes de su retorno genérico.

`POST /v1/telegram/packages/capacity` requiere la autenticación existente y cuerpo exactamente `{}`. Sólo devuelve agregados, capacidades y discrepancias desde una SELECT consistente; no incluye identidad de operadores, paquetes, fuentes, blobs o tokens. Devuelve503si no puede observarse con certeza. No repara, borra, cancela ni aumenta límites. Véase la propuesta de retención y la matriz de aceptación.

## Runtime que debe incorporarse al release21 completo

```text
tools/mcp-publisher/guard-server.mjs
tools/telegram/package-store.mjs
tools/telegram/guard-recovery-candidate/deployed-guard/guard-server.mjs
tools/telegram/guard-recovery-candidate/package-store.mjs
tools/telegram/guard-recovery-candidate/correction-confirmation-store.mjs
tools/telegram/guard-recovery-candidate/recovery-wiring.mjs
tools/telegram/guard-recovery-candidate/fence-preview-start.mjs
tools/telegram/guard-recovery-candidate/package-quota-diagnostic.mjs
```

Conservar exactamente bootstrap, package, originales de outbox/recepción y demás módulos del ZIP21 completo. No ensamblar un release solamente desde los archivos rastreados: algunos originales del despliegue se recuperaron de Hostinger. El manifiesto21 no cambia por este parche del Receiver.

## Evidencia de fuente y límites

Las 92 pruebas específicas pasan. Ejecutan el store real con conexiones simuladas transaccionales, conservación exacta de originales y fallos inyectados. Incluyen reproducción previa, rollback de cierre/preview, resultado no confirmado, respuesta perdida, dos cierres simultáneos, actor ajeno, recibo viejo o corrupto, SHA/bytes alterados y cuota. El reader de resultados durables ejecuta la validación real de preview, scope, jobId y recibo. El HTTP prueba 401 antes del servicio, ruta exacta y 503 ante fallo; capacidad rechaza cuerpos no vacíos. El Code de QA ejecuta los cuerpos finales del Receiver: 8 casos y 30 aserciones, sin I/O externo.

La regresión amplia ejecutó 1287 casos: 1280 PASS y siete fallos preexistentes: mirror deployed-guard antiguo sin hooks posteriores, expectativas antiguas de esquema/manifiesto y fixture público ausente `mcp-files-reader-protocol.mjs`. Se comprobaron en un worktree limpio de la base; no deben presentarse como pruebas aprobadas ni confundirse con un fallo nuevo de esta candidata. No se repararon colateralmente esos artefactos históricos.

Este documento acredita implementación candidata, no activación ni capacidad productiva observada. El integrador debe registrar el nuevo ZIP/SHA, versión Receiver, QA aislada actualizada, lectura de capacidad y restauración de la sonda antes de cerrar18.
