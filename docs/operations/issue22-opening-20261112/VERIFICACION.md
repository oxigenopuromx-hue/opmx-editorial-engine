# Apertura Telegram — corrección del issue22

12nov2026. Fuente 57885f5fbe91b99b202d343bc2f2cd562a014745. No se abrió un paquete nuevo de un operador ni se envió una nota o mensaje para la prueba.

## Cambios

Receptor OSi8AcnzLlI0csRu activo561bd7df-473b-4eca-9e92-e0e81f4baabd,52nodos. Sólo cuatro parámetros de nodos existentes: Consultar sesión Telegram conserva HTTP status/cuerpo; Resolver paquete Telegram desempaqueta la respuesta y clasifica la apertura; Resultado piloto Telegram conserva el acuse separado; Registrar resultado recepción Telegram guarda el diagnóstico. Conexiones, credenciales, remitentes, webhook,30s y reintentos no cambian. Grafo publicado releído exactamente igual al preparado.

La tabla EXISTENTE T7kVEMKmX1w2viLz añade storage_diagnostic de tipo string. Contiene sólo operation=OPEN, HTTP status y código de una allowlist. No contiene mensajes de error crudos, headers, URLs con credenciales, textos, originales ni identidad privada. status sigue significando RECEIPT_CONFIRMED/NOT_CONFIRMED y mode conserva PACKAGE_STORAGE. Las otras operaciones no se reinterpretan como apertura.

OPEN/ALREADY_OPEN/OPEN_REPLAY de un paquete abierto conservan su comportamiento. OPEN_REPLAY de READY/CANCELLED ya no anuncia apertura, política nueva ni propietario. Cuota, acceso denegado y resultado incierto se distinguen sin modificar cuotas, liberar sesiones o autorizar reintentos.

## Verificación

25tests del parche pasan; revisión independiente añadió14comprobaciones con los cuerpos reales del resolver y recibo. n8n37956 ejecutó preparación, resolver y recibo reales con74comprobaciones: apertura, replay, erroresHTTP/timeout, acuse perdido, SELECT/CONFIRM/REOPEN/SEAL/CURRENT y literalidad. Fixtures sintéticos; cero red/CMS/Telegram/filas editoriales.

37972 usó un recibo de apertura ya existente cuya identidad se comprobó criptográficamente antes de llamar Guard. La respuesta auténtica fue OPEN_REPLAY/READY para el mismo paquete; el resolver publicado devolvió OPEN_CLOSED_REPLAY sin anunciar política, registrar propietario, reabrir ni enviar. Inventario posterior idéntico: READY12 y los mismos siete materiales. Fue un replay idempotente del recibo almacenado, no un mensaje nuevo atribuido al operador.

No se pudo reconstruir la respuesta técnica del incidente del10nov08:43; no se le atribuye retroactivamente cuota, autorización o timeout. Quedan corregidos el defecto reproducible de replay cerrado y la falta de diagnóstico para futuras aperturas. Las aperturas positivas y comandos compartidos se comprobaron con los contratos reales de Guard en fixtures; no se abrió una sesión real nueva como prueba.

Reversión: publicar receptor b9a2f944-8a03-4fd2-a730-3b93b6c33688. Conservar storage_diagnostic y sus registros como evidencia; el código anterior la ignora. No borrar paquetes ni alterar cuotas para revertir.
