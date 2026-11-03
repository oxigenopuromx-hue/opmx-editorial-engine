# Telegram: elección de borrador o publicación

## Operación

En un paquete abierto, el operador escribe un mensaje independiente: `/publicar ambos`, `/publicar opuro`, `/publicar opol`, `/borrador ambos`, `/borrador opuro` o `/borrador opol`; después envía `/listo`. También se admite omitir destino, en cuyo caso es AMBOS. Prevalece la última elección verificada. Sin elección, DRAFT/AMBOS.

El receptor autentica chat y operador y rechaza comandos reenviados. Añade un marcador reservado a comandos directos al guardarlos; rechaza entradas que intenten incluirlo. El Motor exige el marcador y verifica el SHA256 de cada mensaje mediante `tools/telegram/mode-choice.mjs`. Mensajes previos sin marca y contenido de archivos, captions y páginas no autorizan publicar. El marcador distingue una época de recepción y es controlado por el flujo; no es una firma criptográfica ni un secreto de autenticación.

El paquete READY debe pasar integridad, coherencia, validación editorial y de archivos. El Motor llama una vez a `publicar_nota_opmx` con confirmación PUBLICAR para las órdenes explícitas; para borrador llama a `preparar_borrador_opmx`. Usa la clave estable por paquete, revisión y destino; ante estado parcial o incierto no reintenta.

El Publisher tiene aviso de publicación acotado a Telegram, que comunica enlaces derivados de la ruta editorial validada para destinos confirmados por WordPress y distingue resultados inciertos. La comprobación pública no forma parte del proceso; la entrega de URL no confirma visibilidad en el frontend. El aviso de fuentes es independiente. Su entrega se confirma sólo con SENT. Los avisos de avance y bloqueo usan una extensión del canal de revisión, pues el catálogo de la automatización no expone de forma consistente la herramienta de bloqueo. Hay un supervisor independiente de falta de avance; un aviso aislado fue entregado y confirmado, pero los avisos del recorrido completo aún no están verificados. Véase [seguimiento y avisos](telegram-seguimiento-avisos.md).

## Verificación y límites

El 3 de noviembre de 2026 pasaron pruebas locales de elección, integridad, rechazo de reenvíos y falsificación, y prueba sintética en n8n (ejecución 625). Al comprobar el 3 de noviembre, el receptor activo es versión 17b4e965-0cda-4973-b67d-efe65a7c780e y el Publisher activo 5ac70b0c-56ab-42fb-8fb2-c329ba6caa04. Los avisos de bloqueo y el supervisor usan formato HTML para conservar los identificadores con guion bajo. La automatización usa el selector del commit 277ac645bb3b86ee4fba3add9a0ec36e7f869c13. La primera publicación real se documenta abajo; falta probar con un paquete nuevo el comportamiento posterior al cambio de confirmación por WordPress y entrega de enlaces.

La vista previa protegida con el mismo frontend de producción está pendiente. No asumir que noindex protege borradores.

## Primera comprobación con nota real

El paquete `tg_62753800d09095570fc5e44508e45b6ff06d87ce`, revisión 6, ordenó publicar en AMBOS. El Motor comunicó que WordPress confirmó ambas publicaciones pero que la verificación pública inicial quedó pendiente; se remitió además un aviso de incertidumbre. No se reenvió la operación de publicación.

Una comprobación posterior de sólo lectura (ejecución n8n 759) obtuvo HTTP 200, el título de la nota y URL canónica coincidente en ambos sitios: [OXígeno Puro](https://oxigenopuro.com.mx/gaby-sanchez-jornadas-de-limpieza-puebla/), ID WordPress 9821, y [OXígeno Político](https://oxigenopolitico.com.mx/estados/gaby-sanchez-jornadas-de-limpieza-puebla/), ID 2967. Esta comprobación confirma visibilidad en el momento de la consulta; no demuestra por qué la validación inicial fue pendiente.

La verificación web inmediata y la propuesta de comprobación posterior se retiraron por instrucción del usuario. Al confirmar WordPress ambos destinos, Publisher informa SUCCESS y entrega sus URL sin verificar la visibilidad pública; si sólo se confirma uno o falla la lectura de WordPress, conserva PARTIAL_SUCCESS o UNCERTAIN y no reintenta. La revalidación de caché OPURO se conserva. La ejecución sintética n8n 761 y 12 pruebas locales cubrieron éxito y resultados parciales. No se ejecutó una nueva publicación real durante este cambio.

## Solicitud de ilustración generada

En un paquete nuevo, el operador puede escribir el mensaje independiente `/imagen generar`. El receptor acredita solamente la orden directa, privada y autorizada; rechaza reenvíos. El selector `tools/telegram/image-intent.mjs` exige que el texto tenga el marcador y SHA256 correctos. El contenido de un documento, un pie o una fuente no activa el generador. Esta orden no autoriza publicar: el modo se sigue eligiendo con `/publicar` o `/borrador`.

La automatización intenta usar la herramienta integrada de generación de imágenes de ChatGPT, crea archivos para hero y destacada con el contrato editorial y acredita la obra como ilustración generada con IA. Si la herramienta o el archivo no están disponibles, se debe avisar MEDIA_FAILED y no publicar. La fotografía aportada por el usuario continúa por el flujo de recorte sin regeneración cuando no hay orden de generar.

Se ejecutaron 22 pruebas locales y la prueba sintética de n8n 812; el receptor `64b30bf4-1400-4552-92c4-703f766587f6` y la instrucción de automatización están activos. Falta verificar con un evento real que la herramienta de imagen esté disponible en la ejecución automática, que devuelva un archivo utilizable y que Publisher lo incorpore. No se ha probado la publicación integral de una nota mediante este comando.

El paquete anterior `tg_c512dd2d86d5e1adc995dac357fe2e250f8dcc90` revisión 4 quedó bloqueado antes de publicar; no contiene el comando acreditado nuevo. Se preparó en este chat una ilustración conceptual para ese tema. El paquete antiguo sigue pendiente: no se reemitió el evento ni se creó una publicación en esta modificación.
