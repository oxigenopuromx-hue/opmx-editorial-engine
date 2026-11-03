# Telegram: elección de borrador o publicación

## Operación

En un paquete abierto, el operador escribe un mensaje independiente: `/publicar ambos`, `/publicar opuro`, `/publicar opol`, `/borrador ambos`, `/borrador opuro` o `/borrador opol`; después envía `/listo`. También se admite omitir destino, en cuyo caso es AMBOS. Prevalece la última elección verificada. Sin elección, DRAFT/AMBOS.

El receptor autentica chat y operador y rechaza comandos reenviados. Añade un marcador reservado a comandos directos al guardarlos; rechaza entradas que intenten incluirlo. El Motor exige el marcador y verifica el SHA256 de cada mensaje mediante `tools/telegram/mode-choice.mjs`. Mensajes previos sin marca y contenido de archivos, captions y páginas no autorizan publicar. El marcador distingue una época de recepción y es controlado por el flujo; no es una firma criptográfica ni un secreto de autenticación.

El paquete READY debe pasar integridad, coherencia, validación editorial y de archivos. El Motor llama una vez a `publicar_nota_opmx` con confirmación PUBLICAR para las órdenes explícitas; para borrador llama a `preparar_borrador_opmx`. Usa la clave estable por paquete, revisión y destino; ante estado parcial o incierto no reintenta.

El Publisher tiene aviso de publicación acotado a Telegram, que comunica sólo enlaces verificados y distingue resultados inciertos. El aviso de fuentes es independiente. Su entrega se confirma sólo con SENT. El aviso de bloqueo requiere `informar_bloqueo_telegram_opmx`; su presencia en el catálogo de la automatización y entrega real sigue pendiente de verificación. Una terminación abrupta puede dejar silencio; falta un supervisor independiente.

## Verificación y límites

El 3 de noviembre de 2026 pasaron pruebas locales de elección, integridad, rechazo de reenvíos y falsificación, y prueba sintética en n8n (ejecución 625). El receptor activo es versión 7a80453f-995e-449f-bada-85c8ad99cf5b, el Publisher activo ba488d29-be8d-4fe6-a956-fbfca4f4cf37. La automatización usa el selector del commit 277ac645bb3b86ee4fba3add9a0ec36e7f869c13. No se hizo una publicación real de prueba: falta verificar con el siguiente paquete autorizado de principio a fin, incluidos ejecución del selector, publicación y entrega del aviso.

La vista previa protegida con el mismo frontend de producción está pendiente. No asumir que noindex protege borradores.
