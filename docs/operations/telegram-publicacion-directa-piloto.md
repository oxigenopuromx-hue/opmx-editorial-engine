# Telegram: elección de borrador o publicación

## Operación

En un paquete abierto, el operador escribe un mensaje independiente: `/publicar ambos`, `/publicar opuro`, `/publicar opol`, `/borrador ambos`, `/borrador opuro` o `/borrador opol`; después envía `/listo`. También se admite omitir destino, en cuyo caso es AMBOS. Prevalece la última elección verificada. Sin elección, DRAFT/AMBOS.

El receptor autentica chat y operador y rechaza comandos reenviados. Añade un marcador reservado a comandos directos al guardarlos; rechaza entradas que intenten incluirlo. El Motor exige el marcador y verifica el SHA256 de cada mensaje mediante `tools/telegram/mode-choice.mjs`. Mensajes previos sin marca y contenido de archivos, captions y páginas no autorizan publicar. El marcador distingue una época de recepción y es controlado por el flujo; no es una firma criptográfica ni un secreto de autenticación.

El paquete READY debe pasar integridad, coherencia, validación editorial y de archivos. El Motor llama una vez a `publicar_nota_opmx` con confirmación PUBLICAR para las órdenes explícitas; para borrador llama a `preparar_borrador_opmx`. Usa la clave estable por paquete, revisión y destino; ante estado parcial o incierto no reintenta.

El Publisher tiene aviso de publicación acotado a Telegram, que comunica sólo enlaces verificados y distingue resultados inciertos. El aviso de fuentes es independiente. Su entrega se confirma sólo con SENT. Los avisos de avance y bloqueo usan una extensión del canal de revisión, pues el catálogo de la automatización no expone de forma consistente la herramienta de bloqueo. Hay un supervisor independiente de falta de avance; la entrega real de avisos nuevos sigue sin comprobarse. Véase [seguimiento y avisos](telegram-seguimiento-avisos.md).

## Verificación y límites

El 3 de noviembre de 2026 pasaron pruebas locales de elección, integridad, rechazo de reenvíos y falsificación, y prueba sintética en n8n (ejecución 625). Al comprobar el 3 de noviembre, el receptor activo es versión 17b4e965-0cda-4973-b67d-efe65a7c780e y el Publisher activo 80e0672a-90d2-444f-816f-ec813aef1ee2. La automatización usa el selector del commit 277ac645bb3b86ee4fba3add9a0ec36e7f869c13. No se hizo una publicación real de prueba: falta verificar con el siguiente paquete autorizado de principio a fin, incluidos ejecución del selector, publicación y entrega del aviso.

La vista previa protegida con el mismo frontend de producción está pendiente. No asumir que noindex protege borradores.
