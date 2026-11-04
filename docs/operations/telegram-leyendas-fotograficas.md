# Leyendas de imágenes en el flujo de Telegram

Actualizado el 3 de noviembre de 2026 en las instrucciones de la automatización de recepción del Motor Editorial.

- Conservar el crédito y la leyenda proporcionados por el usuario.
- Si no se proporcionan, dejar vacío el pie visible y no inventar autoría ni publicar aclaraciones sobre datos faltantes.
- Mantener un texto alternativo descriptivo y veraz como metadato de accesibilidad, sin convertirlo automáticamente en pie visible.
- Identificar las ilustraciones generadas con IA con el crédito y pie visible «Ilustración generada con IA».
- Si la imagen puede inducir a error sobre un hecho esencial sin una aclaración verificable, pedir la aclaración o informar el bloqueo de la imagen.

El cambio está guardado en las instrucciones de la automatización y aplica a ejecuciones posteriores. La confirmación de guardado no sustituye una prueba de publicación completa. No modifica notas ya publicadas.

## Revisión de notas publicadas

El 3 de noviembre de 2026 se revisaron las notas publicadas desde el 1 de noviembre: 44 en OPURO y 43 en OPOL, junto con los metadatos recientes de medios. Se eliminaron el pie y la descripción con aclaraciones sobre información faltante de los medios OPURO 9856 y 9852; se conservaron sus textos alternativos. La lectura posterior confirmó los campos vacíos. Se preservaron las aclaraciones necesarias para distinguir imágenes de archivo o composiciones. Las imágenes de OPOL examinadas no tenían pies registrados. El flujo de auditoría quedó inactivo y con nodos de sólo lectura.

## Confirmación de procedencia

El paquete tg_d9081b0d1a54fa962d333d65d731f65c310cef11, revisión 10, se detuvo antes de llamar a Publisher al no poder verificar de manera independiente el contexto de las fotos. El operador confirmó en el chat que son de la jornada de lectura y provienen de la cuenta de X de Claudia Sheinbaum. Se actualizó la instrucción del Motor para conservar las atribuciones del operador y no exigir una segunda comprobación por defecto cuando no existan indicios concretos de error. La confirmación queda atribuida al operador, no constituye verificación independiente.

El paquete permanece detenido: el endpoint de emisión utiliza el mismo eventId y un INSERT IGNORE sobre entregas existentes, por lo que no se debe afirmar que volver a emitir garantiza reactivación. No se confirmó una nueva ejecución ni publicación. Resolver reanudación idempotente antes de darlo por completado.

## Cierre de la nota de la jornada de lectura

El operador solicitó retomar el paquete revision 10. Se verificaron las huellas de sus fuentes, se preparó la nota y se validaron los archivos. Publisher confirmó publicación en OPURO (post 9890) y OPOL (post 3064) con request_id estable tg_851e7ee12f8b829a9d32db326c3799cdaf2427b8b7e956f36004e3c2906edc36; el aviso de Telegram fue SENT. Visibilidad pública y revalidación de caché no se confirmaron. El registro de supervisión original conserva MEDIA_FAILED de la ejecución previa y no debe confundirse con el resultado posterior de Publisher.
