# Issue #15 — diagnóstico y conservación de originales Telegram

Fecha de revisión: 2026-11-13. Esta entrega prepara una corrección incremental del receptor; la activación y su comprobación en n8n se registran por separado. No se ha recuperado, reabierto, completado ni reenviado el paquete histórico durante esta revisión.

## Evidencia del incidente

Paquete `tg_3ef8acf87bfd3515f3665ea919adb8986ff70366`; PDF `ti_d5a7e0d0a5f57f4c6215bf050a8dcbd88e9eaca2`.

Lectura actual mediante `leer_paquete_telegram_opmx`: `PACKAGE_FOUND`, estado `READY`, revisión **19**, **13** elementos, **12 STORED**, **0 PENDING**, **1 DISCARDED**. El descartado es el PDF: `original_bytes: 0`, `sha256: null`. Esta observación no identifica cuándo ni quién descartó el archivo.

La tabla de recepciones conserva estas filas del 2026-11-05; no se han modificado:

| Fila | Tipo | Acuse de Telegram | Bytes | Original guardado |
|---|---|---|---:|---|
| 315 | COMMAND | No confirmado | — | No |
| 316 | FILE / JPEG | Confirmado | 144541 | Sí |
| 317 | TEXT | Confirmado | — | No aplica |
| 318 | DOWNLOAD_NOT_CONFIRMED / PDF | Confirmado | — | No |

La fila 318 tiene `storage_diagnostic: null`: el capturador anterior agrupaba los fallos de descarga, lectura y firma en un único resultado. No hay evidencia suficiente para atribuir la causa histórica a Telegram, timeout, corrupción del archivo o almacenamiento. El acuse de Telegram confirma la entrega del mensaje de respuesta; no confirma la conservación del PDF.

Existe además una publicación manual del contenido bajo otra solicitud. Este parche no autoriza otra publicación ni convierte el PDF descartado en una nueva reserva.

## Comprobación del PDF conservado fuera del receptor

Se encontró el original ya conservado en el espacio de trabajo y se verificó sin copiarlo al repositorio:

| Propiedad | Resultado |
|---|---|
| Tamaño | **2528657 bytes** |
| SHA-256 | `812415164fd172cb4814514a5f670b6416130cdd535a07e033eddb52d9f45220` |
| Páginas | **15** |
| Encabezado | `%PDF-1.3` |
| Catálogo | PDF 1.4 |
| Cifrado | No |
| Lectura | pypdf `strict=True`, extracción de las 15 páginas sin advertencias |
| Integridad del transporte candidato | Firma admitida y conversión base64 que conserva exactamente los bytes |

Esto comprueba el archivo conservado actualmente. No demuestra qué bytes descargó el receptor el 2026-11-05. La comprobación de firma en el receptor sigue siendo una comprobación del transporte, no una validación estructural completa del PDF ni una revisión editorial.

## Cambio propuesto

Base: receptor `OSi8AcnzLlI0csRu`, versión activa `561bd7df-473b-4eca-9e92-e0e81f4baabd`, **52 nodos**, con las correcciones anteriores de apertura del issue #22. El builder modifica sólo cinco conjuntos de parámetros existentes:

1. `Descargar archivo Telegram`: hace explícito `download: true`. Ese valor ya era el predeterminado de n8n; su ausencia explícita no demuestra la causa del incidente.
2. `Comprobar bytes Telegram`: separa fallo de transporte, timeout estructurado, binario ausente, varios binarios, lectura fallida, descarga vacía, exceso de tamaño, diferencia del tamaño declarado y firma incorrecta. Un error de transporte invalida cualquier binario residual. No se llama a `/complete` si esas comprobaciones fallan.
3. `Guardar original Telegram`: conserva endpoint, credencial, cuerpo, timeout, política de errores y ausencia de reintentos; añade `fullResponse` y `neverError` para observar el estado HTTP sin perder la respuesta.
4. `Confirmar original Telegram`: sólo confirma el original ante HTTP 200 sin error de transporte y la respuesta precisa `STORED` o el replay idempotente del mismo elemento. Timeout o acuse perdido continúan siendo inciertos; la respuesta pide revisar `/estado` antes de reenviar.
5. `Resultado piloto Telegram`: conserva el diagnóstico de apertura del issue #22 y registra los nuevos diagnósticos de archivo en el campo existente `storage_diagnostic`.

No añade nodos, conexiones, columnas, comandos, credenciales, reintentos ni suscripciones. No altera Guard, Motor, Publisher ni CMS.

El flujo de reservas se conserva: `RESERVATION_REPLAY/PENDING` utiliza el mismo `itemId` y puede volver a comprobar sus bytes; `RESERVATION_REPLAY/STORED` responde que el mensaje ya está guardado y omite descarga y almacenamiento. El backend sólo acepta `STORED_REPLAY` si el SHA coincide con el original guardado. No se crea un duplicado ni se transforma un resultado incierto en autorización para reintentar.

## Diagnóstico acotado

El JSON usa exclusivamente seis campos: `operation`, `httpStatus`, `code`, `mimeType`, `declaredBytes`, `receivedBytes`. Operaciones, códigos y MIME tienen listas cerradas; las cantidades y el estado HTTP están acotados. No se serializan mensajes de excepción, cabeceras, URLs, tokens, identificadores de Telegram, texto ni bytes de las fuentes. El lector del recibo rechaza claves adicionales y JSON inesperado.

| Operación | Códigos principales |
|---|---|
| DOWNLOAD | `DOWNLOAD_VERIFIED`, `DOWNLOAD_FETCH_UNCONFIRMED`, `DOWNLOAD_TIMEOUT`, `DOWNLOAD_BINARY_MISSING`, `DOWNLOAD_BINARY_AMBIGUOUS`, `DOWNLOAD_BINARY_UNREADABLE`, `DOWNLOAD_EMPTY`, `DOWNLOAD_SIZE_LIMIT`, `DOWNLOAD_DECLARED_SIZE_MISMATCH`, `DOWNLOAD_SIGNATURE_MISMATCH`, `DOWNLOAD_CONTEXT_INVALID` |
| STORE | `STORE_CONFIRMED`, `STORE_REPLAY_CONFIRMED`, `STORE_TIMEOUT`, `STORE_AUTH_DENIED`, `STORE_INVALID_REQUEST`, `STORE_HTTP_UNCONFIRMED`, `STORE_CONFLICT`, `STORE_RESERVATION_NOT_FOUND`, `STORE_RESPONSE_UNCONFIRMED` |

`RECEIPT_CONFIRMED` y `original_stored` siguen siendo hechos independientes. Un acuse perdido del mensaje no borra un almacenamiento ya confirmado; una respuesta entregada correctamente no convierte un PDF fallido en un original guardado.

## Fuentes y comprobación

Archivos de implementación:

- `tools/telegram/guard-recovery-candidate/receiver/telegram-file-observation.mjs`
- `tools/telegram/guard-recovery-candidate/receiver/build-telegram-file-diagnostic-operations.mjs`
- `tools/telegram/guard-recovery-candidate/receiver/build-telegram-file-code-qa.mjs`
- `tools/telegram/guard-recovery-candidate/receiver/telegram-file-observation.test.mjs`

Validación local: **18/18 tests PASS**. El Code QA generado incorpora el código exacto de los tres nodos de lógica propuestos y el confirmador actual de reservas; **45 aserciones PASS en VM**, con entradas sintéticas, sin I/O externo. Comprueba reserva y replay, las clases de descarga fallida, conservación de bytes, confirmación precisa, timeout de guardado, separación del acuse de Telegram y compatibilidad del diagnóstico de apertura. Una segunda revisión independiente ejecutó el código generado con el confirmador real y el PDF original, sin hallazgos bloqueantes.

El QA no llama a Telegram, `/complete`, Publisher ni Motor y no modifica ningún paquete. Para registrar una prueba de n8n se debe ejecutar únicamente este Code QA en el flujo aislado, no enviar el paquete histórico ni ejecutar el receptor activo como prueba.

Referencias de contrato: código del backend de este repositorio para completar y reproducir originales; código oficial de n8n Telegram File/Get (`download` predeterminado `true`): https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/Telegram/Telegram.node.ts .
