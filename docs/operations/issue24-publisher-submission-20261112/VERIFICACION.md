# Entrega Publisher — despliegue del 12nov2026

Fuente inmutable: 57885f5fbe91b99b202d343bc2f2cd562a014745, rama feat/telegram-reopen-recovery. Se conservan el mismo Motor, suscripción READY/preview, destinos, validaciones LITERAL, autor3 de El Liberal y escritores existentes. No se creó ni publicó ninguna nota para probar este cambio.

## Resultado

La ruta CREATE de Telegram registra una aceptación durable y responde PUBLISH_SUBMITTED o DRAFT_SUBMITTED antes del trabajo largo. Sólo la primera aceptación continúa el mismo escritor; un replay no ejecuta otra creación. La lectura existente leer_paquete_telegram_opmx devuelve el resultado histórico ligado a paquete, revisión, request, fase y hashes. El Motor valida el recibo con el helper fijado al commit, espera como máximo180segundos/12consultas y finaliza el intento una sola vez cuando se acredita la fase final completa. El DRAFT intermedio no acredita PUBLISH. AvisoTelegram, resultado editorial y disponibilidad pública permanecen separados.

La compatibilidad EDITORIAL histórica sólo toma la ruta síncrona anterior ante una decisión explícita y autenticada SUBMISSION_SYNC_REQUIRED; un timeout o ausencia de binding no autorizan ese fallback.

## Versiones activas

- MCP bnzVMNkZuGO1GQCZ: 1b3bb5c6-e871-4d43-a9c1-21f7ef11cacb,151nodos; huella 0513f7987a7f82fa47c380e3df93547a7b1674a95720d08a03bda0beade39a38.74operaciones añaden14nodos y modifican la respuesta/lectura existentes. Se agruparon las etapas nuevas; grafo activo releído idéntico al preparado.
- Guard: opmx-guard-publisher-submission24.zip, SHA256 ee200f0986c682f109737b24192e961af54e9b51fd26f65fdcb1fec45aba3c96,195002bytes. Hostinger lo mostró completado/Actual a12nov18:03:54CDMX. Añade aceptación/resultado, lectura autorizada del manifest, comprobación de fase y pin MCP. Inventario completo de archivos modificados en EVIDENCIA.json.
- Motor6ae9095256948191b33f1e023fbfbf8b: sólo prompt, SHA256 ed1b77c7ce68d367288c66a63280be1b1fec42dc79aece45ac0f565f7e5e3eed; anterior 91c3e9878c348ee13bbc24604c82ee0b33ffcf1b21d9fc326bd7d2cf46d60df6.49859caracteres. Relectura exacta; habilitado, título, calendario y entornos conservados. No se creó otra automatización ni consumidor.
- Se preservó el draft ajeno de112nodos del MCP: restaurado como719ed751-2e44-418f-bbe9-90e9965084d1 después de publicar. No activarlo suponiendo que coincide con los151nodos productivos.
- Nueva tabla técnica opmx_tg_publisher_submissions_v1: identidad de solicitud, fase esperada, huella, ejecución y acuses; sin originales, fuentes, contraseñas ni tokens. No es una cola nueva ni concede permiso de escribir.

## Verificación

675pruebas Node pasan en tools/editorial/*.test.mjs y los tests de Guard/receptor. Arranque y ensamblaje del ZIP pasan; entradas vacías de begin/report no abren escritura.

n8n37960 ejecuta cuerpos reales de aceptación, resultado y manifest con15comprobaciones sintéticas y cero I/O.37961 recibió el ACK del webhook aislado en848ms;37962 continuó3segundos, ignoró la segunda respuesta y llegó al último nodo. No hubo CMS, Telegram ni tablas editoriales. El webhook efímero se desactivó y eliminó al restaurar el diagnóstico original.

37979 ejecutó el nodo Crypto real y Conservar huella con payload sintético: SHA256 correcto y JSON/binarios base64 preservados.37972 comprobó servicios productivos: RUNTIME_OBSERVED con los cinco pins correctos y sin escritores activos; FINAL_PUBLICATION_CONFIRMED histórico de Waldo en tres CMS; rechazo409 de begin/report sin autorización; replay cerrado tratado sin reabrirlo. No se reutilizó esa prueba para fabricar una aceptación o cierre del Motor.

Probe7IDUF9PeHQ5v331Z final1beadd45-e5e0-44f3-bd37-b017f5020c11: inactivo, tres nodos y grafo original idéntico, sin retención,30s. No quedan endpoints, credenciales de prueba añadidas ni programación QA activa.

## Límite pendiente del issue24

La hija37855 tardó71.186s mientras el Motor recibió error antes de que terminara. El cambio elimina esa dependencia de una respuesta HTTP larga; no identifica qué capa concreta cortó aquella conexión. Tampoco demuestra la causa de los cuatro incidentes del10nov detenidos ANTES de enviar a Publisher. Sus notas se recuperaron, pero las trazas originales del Motor no están disponibles; los progresos por sí solos no explican la interrupción. El24 permanece abierto por esa investigación histórica. No presentar este despliegue como prueba de que aquellos cuatro tuvieron la misma causa.

## Reversión

Restaurar conjuntamente MCP c0de03ed-e7a7-4255-a9c8-9ca76404424e y Guard opmx-guard-publication-status23.zip SHA256028b71d5c5c35060e8fd92f80b0736d0a7d4b5c4b8ba8ca02acf1853de1d518c. Eliminar únicamente el bloque añadido ISSUE24 del prompt del mismo Motor si se revierte la política; comprobar su hash anterior. Conservar tabla de aceptaciones, recibos y estados históricos; no reintentar publicaciones ni activar un draft ajeno como reversión. El receptor22 tiene reversión independiente documentada en su informe.
