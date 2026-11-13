# Issue #15 — verificación del diagnóstico de originales Telegram

Fecha: 2026-11-13. Resultado de la fuente y del QA aislado: **PASS**. La activación del receptor productivo sigue pendiente de registrar en este documento.

## Validación de la fuente

Comando ejecutado desde la raíz del repositorio:

```sh
node --test tools/telegram/guard-recovery-candidate/receiver/telegram-file-observation.test.mjs
```

Resultado: **18 tests, 18 PASS, 0 FAIL**. Se comprobaron descarga y lectura del binario, límites y tamaño declarado, firmas admitidas, conservación exacta de bytes, confirmación y replay de almacenamiento, resultados HTTP, acuse perdido, sanitización del diagnóstico y compatibilidad del recibo con el issue #22.

El builder acepta la base real de **52 nodos** y prepara **cinco cambios de parámetros**, sin modificar conexiones, credenciales, columnas, políticas de reintento ni suscripciones. Una revisión independiente ejecutó el código generado con el confirmador real y no encontró fallos bloqueantes.

## QA aislado en n8n

Ejecución **38024**: **PASS, 45 aserciones**. El flujo de prueba fue restaurado después de la ejecución.

El Code QA incorpora el código exacto propuesto de `Comprobar bytes Telegram`, `Confirmar original Telegram` y `Resultado piloto Telegram`, además del confirmador actual de reservas. Usa exclusivamente datos sintéticos y helpers de lectura simulados; no ejecuta Telegram, HTTP, Publisher ni Motor.

| Comprobación | Resultado |
|---|---|
| Reserva inicial y replay PENDING | Conservan el mismo paquete y elemento |
| Replay STORED | Omite descarga y almacenamiento |
| Bytes originales | Base64 conserva exactamente el binario recibido |
| Binario ausente, ambiguo o ilegible | Diagnósticos distintos, sin envío a `/complete` |
| Descarga vacía, tamaño excesivo, tamaño declarado distinto y firma incorrecta | Se detienen antes del almacenamiento |
| Fallo de transporte y timeout | No aceptan binarios residuales ni revelan excepciones |
| Guardado | Requiere respuesta HTTP y elemento precisos |
| Timeout del guardado | Sigue incierto; no declara que el original esté ausente |
| Acuse de Telegram | Permanece separado de `original_stored` |
| Diagnóstico del recibo | Rechaza campos inesperados y conserva la apertura del issue #22 |
| Efectos externos | Ninguno; no modifica ni recupera paquetes |

El mismo Code QA pasó antes **45 aserciones en VM local**. Huellas de los artefactos privados revisados, que no se incorporan al repositorio:

| Artefacto | SHA-256 |
|---|---|
| Cinco operaciones incrementales | `fd615ea188e931c731d089667cccae68c8c3b7822ef3a49b5c62b6abb68bc320` |
| Code QA aislado | `c1aa6508548d1c19158fd89b742bba2cedb1fdfb559fc29a8ac5b883acd76567` |

Esta prueba verifica el código de lógica en el ejecutor n8n. No representa una nueva descarga real del PDF histórico ni una publicación editorial.

## Incidente histórico y estado actual

La relectura del inventario, posterior al QA, mantiene el paquete `tg_3ef8acf87bfd3515f3665ea919adb8986ff70366` en **READY, revisión 19**, con **13 elementos: 12 STORED, 1 DISCARDED, 0 PENDING**. El PDF `ti_d5a7e0d0a5f57f4c6215bf050a8dcbd88e9eaca2` permanece **DISCARDED**, `original_bytes: 0`, `sha256: null`.

No se reabrió el paquete, no se recuperó el PDF, no se completó una reserva, no se descartó material adicional y no se volvió a publicar la nota. La publicación manual ya existente no se modifica.

El PDF conservado fuera del receptor se verificó por separado: **2528657 bytes**, **15 páginas**, SHA-256 `812415164fd172cb4814514a5f670b6416130cdd535a07e033eddb52d9f45220`, sin cifrado y con lectura pypdf `strict=True` sin advertencias. Esto acredita el original disponible, no los bytes de la descarga histórica. La fila 318 sigue siendo `DOWNLOAD_NOT_CONFIRMED` sin diagnóstico histórico suficiente para determinar la causa concreta.

## Registro de activación pendiente

| Dato | Valor |
|---|---|
| Receptor | `OSi8AcnzLlI0csRu` |
| Base activa usada para preparar el parche | `561bd7df-473b-4eca-9e92-e0e81f4baabd` |
| Commit de fuente desplegada | **PENDIENTE — completar después de activar** |
| Versión activa resultante | **PENDIENTE — completar después de activar** |
| Fecha y hora de activación UTC | **PENDIENTE — completar después de activar** |
| Verificación de lectura posterior de los cinco nodos | **PENDIENTE — completar después de activar** |
| Conteo de nodos y preservación de conexiones/credenciales | **PENDIENTE — completar después de activar** |

No debe presentarse el QA aislado como evidencia de despliegue productivo. El inventario histórico y su PDF descartado no requieren una nueva recuperación para validar la activación de este parche.

## Archivos propios del commit #15

1. `tools/telegram/guard-recovery-candidate/receiver/telegram-file-observation.mjs`
2. `tools/telegram/guard-recovery-candidate/receiver/build-telegram-file-diagnostic-operations.mjs`
3. `tools/telegram/guard-recovery-candidate/receiver/build-telegram-file-code-qa.mjs`
4. `tools/telegram/guard-recovery-candidate/receiver/telegram-file-observation.test.mjs`
5. `docs/operations/issue15-pdf-20261113/IMPLEMENTACION_CANDIDATA.md`
6. `docs/operations/issue15-pdf-20261113/VERIFICACION.md`

No incluir snapshots privados del receptor, operaciones con referencias de credenciales, archivos del PDF original ni fixtures privados de ejecución.
