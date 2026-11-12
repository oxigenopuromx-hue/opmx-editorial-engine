Seguimiento posterior vigente: [Tecámac23 y persistencia](RECURRENCIA_TECAMAC23.md). Las versiones y evidencia inferiores conservan el corte inicial de WEG.

# Issue30 — alerta incierta después de publicación confirmada

## Resultado

WEG quedó conciliada en seguimiento como `PUBLICATION_RECONCILED` (fila1670), conservando la revisión8, la solicitud original y las publicaciones existentes OPURO10513, OPOL3524 y LIBERAL397. No se volvió a publicar, editar, abrir ni cancelar el paquete. Se preservaron las filas históricas DRAFT_UNCERTAIN y ALERT_ADMIN_1668.

El monitor administrativo existente está activo en versión `2d3e18a9-ff68-4f5c-9fdc-ce6a694b1cd6`. Antes de enviar una alerta incierta consulta el resultado final del Guard. Sólo omite la alerta si el recibo durable PUBLISH de la misma solicitud/revisión, la identidad de todos los destinos y la lectura actual de sus WordPress confirman la publicación. Un borrador, parcial, error, recibo ausente, correlación ambigua o escritor activo conserva la alerta. Los demás tipos de bloqueo no se suprimen.

## Incidente y causa comprobada

Paquete `tg_d50b246064f104560c345b74c6056cf58e0195a9`, revisión8. Solicitud TODOS `tg_e7d344fcea129cb6fa71c4af57443300c759e4b3266abb227c38a11ed269961e`, slug `weg-inversion-250-millones-planta-hidalgo`.

PROGRESS_SUBMIT se registró el12nov2026 a16:30:37.527Z; DRAFT_UNCERTAIN a16:31:51.698Z. La ejecución escritora Shared36968 aún seguía activa y terminó exitosamente a16:31:59.808Z, con recibo durable DRAFT registrado: ocho segundos después del aviso de incertidumbre. El orden temporal es compatible con agotamiento de espera de la herramienta mientras el escritor seguía trabajando. No se atribuye un timeout exacto o su capa sin logs MCP retenidos.

El monitor de administrador consultaba únicamente la última etapa de seguimiento. No comprobaba el recibo final ni los CMS, y por eso emitió la alerta sobre el registro anterior. El aviso de publicación tiene otro criterio: los resultados confirmados de WordPress. Ambos caminos podían producir los dos mensajes mostrados por el usuario.

El problema de clasificación de rechazos previos a escritura (#21) es distinto. La duración general de herramientas y las interrupciones siguen relacionadas con #24; esta corrección no cambia tiempos de espera del Motor ni su protocolo de escritura.

## Comprobaciones reales

- Guard36995: RECONCILIATION_VERIFIED, los tres destinos PUBLISHED con los IDs originales. Transacción de diagnóstico con ROLLBACK; no daba autorización para reintentar.
- Guard37003: HTTP200 FINAL_PUBLICATION_CONFIRMED, fase PUBLISH, recibo RECORDED y hash `9d9f13dbca0c4d3dd4dcf3052d372ede8bc6fe700855df4e8519053f3079d3fe`. Los tres destinos coinciden con ledger y CMS en estado publish; escritores inactivos y versiones/huellas válidas.
- Caso real aplicado al filtro puro: el DRAFT_UNCERTAIN original y REQUEST_TODOS correlacionados quedaron resueltos por esa prueba final fresca.
- Ensayo aislado n8n37011: copia de las filas del caso, retirando sólo en la fixture el acuse ALERT_ADMIN para simular una alerta aún pendiente. Recorrió preparación, rama condicional, HTTP Guard real, asociación por item y renderizador. Resultado qaSuppressed=true, FINAL_PUBLICATION_CONFIRMED/PUBLISH/TODOS y los tres IDs correctos. No tenía nodos Telegram ni escrituras de tabla/CMS.
- Registro específico PUBLICATION_RECONCILED1670 insertado una vez y releído. No se falsificó PROCESS_COMPLETE ni se cambió el intento a COMPLETED: el acuse del Motor es un estado independiente.
- Primera ejecución programada después de activar la corrección:37017,17:06:48Z, SUCCESS. Terminó en preparación sin candidatos y sin ejecutar el nodo de notificación.

Las comprobaciones autoritativas fueron lecturas autenticadas de WordPress. La herramienta web no pudo abrir los tres enlaces públicos; no se afirma una comprobación adicional de visibilidad del frontend.

## Implementación y límites

Guard añade POST `/v1/telegram/publications/observe-final`, autenticado mediante el secreto existente y con entrada exacta packageId/revision. No admite destinos, IDs, URL, recibos ni afirmaciones positivas del cliente. Dentro de una transacción bloquea quota/package/attempt/fence, verifica el manifiesto y paginación completa sin escritores activos, usa el proveedor real readCompletedWriterReceipt, comprueba solicitud/clase/claim/ledger y lee los CMS. Hace únicamente SELECT y ROLLBACK. No selecciona tokens ni crea acuses, sesiones, eventos o permisos de escritura. Un error de rollback degrada la respuesta a no confirmada.

El monitor existente mantiene horario, administrador, remitente y tabla. Se añadieron cinco nodos de observación y se sustituyó su selector final: once nodos en total, un solo lote de salida y una sola rama por ejecución. Los candidatos inciertos se correlacionan con la fila REQUEST del mismo paquete/revisión. HTTP tiene timeout30s, sin retry, redirecciones desactivadas y asociación por item; sólo HTTP200 del paquete/revisión esperado puede aportar una prueba. El máximo de veinte candidatos y la deduplicación anteriores se conservan. En un lote largo, una prueba que envejezca más de120s no suprime la alerta; la frescura nunca sustituye el acuse, la identidad o la comprobación de escritores.

La configuración privada del administrador no se copió al repositorio: el builder recibe el grafo existente. El código y las pruebas están en commits `fdbe48cf8679840d6fcc2f1d8930b96a1323137e` y `6a57020777fd3c5a8482e043a7e260ecf0e38c31` de feat/telegram-reopen-recovery. El release y los acuses seguros están en release.json y evidence.json.

130 pruebas pasan:73 del observador con el proveedor real de recibos,40 del filtro,16 del builder y1 HTTP. Cubren fase incorrecta, recibo ausente/corrupto, identidad o hash divergentes, parcial, escritor activo, paginación incompleta, respuesta503 con cuerpo engañoso, timeout, respuestas intercambiadas, varios candidatos, preservación de otros bloqueos, deduplicación y saltos reales del texto Telegram. El ZIP ensamblado pasó arranque y fallo cerrado ante MySQL no disponible.

## Despliegue y limpieza

Hostinger confirmó Se ha completado / Actual para `opmx-guard-final-publication-observer.zip`, despliegue12nov2026 10:59:11, hora del panel. SHA256 `ecd2f908e6e19616097ebcf5aee891aa64e36b3305675ffab4c32146bb55fdc0`. Deriva de la extracción del release Waldo anterior: sólo cambia tres módulos de wiring y añade un módulo de lectura. Conserva autor3, recuperación, manifiesto de escritores y suscripciones existentes.

El diagnóstico7IDUF9PeHQ5v331Z se restauró a tres nodos, GET original, sólo credencial n8nApi, inactivo y sin retención manual/success/error; versión b12cfe6f-ea62-48a8-8d70-f4b0579c1dde. Conserva un límite de30s para este diagnóstico inactivo, añadido por el ensayo; no afecta al Motor ni al monitor. El probe MySQL de lectura existente se intentó una vez y fue rechazado; no se modificaron acceso, IP ni credenciales. Se restauraron sus dos nodos y ajustes originales.

No se envió una corrección adicional por Telegram, no se borró el aviso histórico y no se publicaron notas de prueba. #28 permanece diferido y #18 conserva sus pendientes generales.

## Reversión

El monitor puede volver a su versión anterior f9d2c08d-a31a-4d95-ac7f-9b2f37b981b9. La anotación histórica PUBLICATION_RECONCILED se conserva. El Guard puede volver al ZIP Waldo compatible anterior; entonces el endpoint de observación no estará disponible y cualquier monitor nuevo mantendrá la alerta por falta de prueba. No resetear barreras, solicitudes o intentos para revertir esta lectura.
