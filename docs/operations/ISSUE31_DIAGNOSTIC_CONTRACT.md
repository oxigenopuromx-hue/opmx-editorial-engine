# Contrato interno de diagnóstico Telegram — issue31

Este cambio describe causas observadas y acciones concretas; no concede permisos de publicación, recuperación ni reintento. Mantiene un único Motor y el transporte público existente `informar_revision_telegram_opmx(package_id, revision, outcome)`.

## API pura y codificación compatible

El catálogo está en `tools/telegram/blocker-diagnostic.mjs`. Sus IDs numéricos son estables: no renumerarlos ni reutilizarlos. Los nuevos códigos se agregan con otro ID, entre1y255. Los campos y mensajes proceden de un catálogo fijo; no se aceptan destinatarios, textos, enlaces ni instrucciones libres.

`encodeBlockerDiagnosticRevision({revision,code,itemOrdinal=0})` produce:

```
2**40 + revision * 16384 + itemOrdinal * 256 + catalogId
```

`revision` es UInt32positivo. `itemOrdinal` es0(sin referencia)o1..40 dentro del inventario completo, sin filtrar ni reordenar. Todos los valores son enteros seguros de JavaScript. Se usan división/módulo aritméticos, no operadores bitwise32. El namespace está separado de todos los valores legacy `1000000 + revision*32 + slot`: los32slots conservan su comportamiento, incluidos los reservados que eran inválidos.

La llamada conserva `outcome:SOURCES_VERIFIED`; ese valor es el transporte existente, no una afirmación nueva sobre fuentes. El MCP reconoce el namespace nuevo antes del alias legacy y deriva la revisión real y un `blockerDiagnostic:{version:1,code,itemOrdinal}`. Una codificación inválida se rechaza; nunca se redondea, recorta ni transforma silenciosamente en otro motivo.

## Alcance y datos comprobados

La ruta continúa limitada a paquetes **READY**, con misma identidad, paquete y revisión exacta. Los códigos relacionados con vista previa son reservas descriptivas: no habilitan reportar una revisión OPEN mediante esta ruta ni sustituyen la entrega/diagnóstico de vista vigente.

Antes de enviar, `Preparar aviso de bloqueo` comprueba el manifest y, para ordinales positivos, el inventario completo. Admite el alias RAW `itemId` y el alias MCP `item_id` sólo si son IDs válidos y coinciden cuando ambos están presentes. Rechaza duplicados, posiciones inexistentes o material noSTORED; las causas de imagen apuntan a FILE. El admin puede representar el ordinal ya persistido sin inventar un ID de archivo.

El resultado editorial va en `blocker_diagnostic`; el campo previo `diagnostic` se conserva para el acuse/error del transporte Telegram. Sólo una preparación válida produce un marcador de alcance fuera del body. El formatter emite un diagnóstico persistible únicamente si ese marcador coincide con paquete, revisión, motivo, código, ordinal e identidad del reporte. Un manifest inválido o una revisión vieja produce `FAILURE_NOT_SENT` sin diagnóstico persistible.

Un acuse perdido o error de entrega después de preparación válida conserva `FAILURE_UNCERTAIN`, su diagnóstico Telegram y `retryPermitted:false`; la causa editorial validada se registra para que el administrador pueda verla. Esto no afirma entrega ni reintenta el mensaje. Legacy y progreso conservan su filtro de persistencia anterior.

## Registro y monitor

La misma columna `stage` guarda `DIAG|BASE_REASON|CODE|ordinal`. No se reutiliza `request_id` como JSON. El monitor valida este carrier, normaliza a la razón base antes de las reglas de conciliación y conserva el ID original de fila para deduplicar/registrar el acuse. Las protecciones de incertidumbre/publicación del issue30 siguen utilizando la etapa base, el request original y la evidencia real del Guard.

Los mensajes muestran causa, dato afectado y cómo continuar. MEDIA_FAILED legacy no se convierte en falta de crédito: informa que esa revisión no registró una causa específica. Una fotografía ordinaria no se bloquea globalmente por no tener crédito; `IMAGE_CREDIT_REQUIRED` sólo representa un requisito obligatorio comprobado. `IMAGE_ORIGIN_UNCLEAR` pide aclarar fotografía/composición/IA sin asumir que es IA. Si IA ya está acreditada y sólo falta su identificación estándar, es reparación del Motor y no otra confirmación al operador.

Las acciones humanas empiezan por `/abrir <paquete>`, corrigen ese mismo paquete y usan `/listo` para pedir/revisar la vista antes de confirmar. No crean paquetes nuevos ni publican automáticamente. Para reemplazos concretos con itemID validado se ofrece excluir únicamente esa copia mediante `/descartar`, preservando historial. Incertidumbre de Publisher pide `/estado` y conciliación, nunca repetir a ciegas. El mero motivo de bloqueo no demuestra que nunca haya habido escrituras; las afirmaciones de rechazo antes de escribir requieren respuesta explícita `writesStarted:false`.

## Implementación y QA

El builder modifica cinco parámetros Code del MCP155: protocolo, preparación, formatter de resultado, fallback no enviado y registro. No modifica nodos, conexiones, grupos, credenciales, los gates13, la copia21 ni destinos/autores. El monitor se despliega con lectura compatible antes de que MCP emita los nuevos carriers; el pin del MCP en Guard debe actualizarse con versión/huella reales.

Las pruebas ejecutan cuerpos Code reales y una fixture saneada, comparan los32slots legacy contra el comportamiento original y cubren la fronteraUInt32, rechazos, ordinal RAW, coherencia/integridad, ACKincierto y fallback stale. `buildBlockerDiagnosticCodeQa` embebe los cinco cuerpos como funciones ordinarias: sin eval, require, cambios de prototipo, HTTP, DB, CMS ni Telegram.

Los IDs41..46 son variantes explícitas de categoría inválida y permiso rechazado por OPURO/OPOL/LIBERAL. Sólo deben seleccionarse si ese sitio consta en el resultado observado; los códigos genéricos22/39 se conservan cuando no se confirmó qué destino falló. No se infiere el sitio por el orden de TODOS.
