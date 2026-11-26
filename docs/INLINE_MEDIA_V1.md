# Imágenes interiores de Publisher — issue #62

Este contrato se instala de forma coordinada con el transporte MCP y el escritor compartido. Los archivos en una rama de desarrollo no acreditan una capacidad instalada. No depender de GitHub Actions.

## Selección de roles

Una sola imagen conserva su papel de Hero original; la destacada se prepara a 1200×630 con el encuadre y conversión JPEG existentes. Para varias imágenes, el caption `Hero` identifica la principal; `Thumbnail` y `Destacada` identifican la miniatura. Se admite la etiqueta como primera línea, con mayúsculas/minúsculas indistintas y dos puntos opcionales. El texto restante se conserva como referencia del archivo.

Sin etiqueta de destacada, una única imagen de 1200×630 diferente de la Hero se reconoce como destacada. Varias candidatas requieren aclaración; ninguna candidata permite derivarla de la Hero. Las fotos restantes son interiores y pueden llegar sin caption o con etiquetas opcionales. Una etiqueta opcional no se transforma automáticamente en un pie visible ni en una orden.

## Entrega

El Motor verifica todos los originales, inspecciona las fotos, ejecuta `selectImageRoles` y muestra las asignaciones. Conserva el procesamiento actual de Hero/destacada. Redacta o serializa primero el cuerpo textual aprobado. En LITERAL usa los helpers y la comprobación original vigentes; no introduce rótulos INSERTAR IMAGEN en los párrafos.

Después llama `prepareInlineMediaMaster(master, images)` con cada interior como `{id:'img01', itemId:'ti_...', bytes:BufferOriginalVerificado, afterParagraph:2, alt:'Descripción verificable', caption:'', credit:''}`. Los IDs de paquete deben ser los reales, jamás ejemplos o identificadores inventados. En entrega manual sin paquete `itemId` se omite. El helper añade `IMAGENES.INTERIORES` y `MEDIA_ARCHIVOS` con el manifiesto y los bytes reales. El MASTER se guarda como JSON y se entrega mediante el campo de archivo nativo existente; no cambia el destino ni la solicitud.

`afterParagraph:0` inserta antes del primer párrafo; N positivo inserta después del párrafo de nivel superior N. Los párrafos de una lista o cita no son anclajes. Se permiten varias fotos en el mismo anclaje, conservando el orden de la lista. El anclaje debe existir en ambas variantes Gutenberg. ALT es descriptivo; crédito y pie sólo llevan datos autorizados.

Hasta 16 interiores, 10 MiB por archivo y 25 MiB en total, sujetos además al límite del paquete Telegram. Sin interiores se omiten los dos campos nuevos y se conserva la ruta anterior.

## Escritura y verificación

MCP verifica firma, tamaño y SHA256 antes de continuar; el escritor vuelve a comprobarlo antes de reservar o subir archivos. El Guard usa los mismos reclamos durables existentes con roles `interior_01` a `interior_16`. Las URLs e IDs se obtienen de cada CMS y se comprueban, nunca se copian del origen.

Cada original se comprueba por SHA256 antes de escribir. Cada interior se sube por HTTPS autenticado con Content-MD5, que WordPress contrasta antes de aceptarlo, y después se registra y se lee con metadata nativa. Se exige el mismo ID, ruta, MIME, ALT, crédito y pie del adjunto; cuando no hay escalado, también el tamaño original. Si WordPress generó una variante escalada, se comprueba la referencia al original nativo y se utiliza esa URL original. La copia pública de la CDN puede tener otros bytes; no se usa su hash como sustituto de la identidad del archivo recibido por WordPress. El escritor construye core/image en la posición exacta y exige que el readback coincida con el contenido completo previsto, incluidos ALT, crédito y pie. La prueba LITERAL del texto de origen permanece intacta.

Una respuesta incierta conserva solicitud, reclamos, IDs y ejecución. No hay reintentos automáticos de subida ni nueva creación de nota. El #55 añadirá posteriormente la copia de estos adjuntos a otro destino; no se anuncia aquí como función activa.
