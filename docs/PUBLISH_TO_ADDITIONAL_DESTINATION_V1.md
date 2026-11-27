# Publicar un paquete existente en otro medio

Instalado el 26 de noviembre de 2026. Issue funcional: https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/55

## Uso en Telegram

Envía como mensaje privado nuevo y directo:

```text
/publicar HORIZONTE <paquete tg_…>
```

Sustituye el paquete por su identificador completo. También puedes elegir OPURO, OPOL o LIBERAL. El comando con paquete acepta un solo medio concreto. `/publicar AMBOS`, `/publicar TODOS` o `/publicar OPURO` sin paquete mantienen el control ordinario de una nota nueva.

El bot muestra título, medio de origen, modalidad, imágenes y clasificación del destino. Copia y envía el comando `/confirmar_adicional` completo que devuelve para publicar esa propuesta. La huella impide confirmar accidentalmente otra versión.

El bot también proporciona estos comandos con el identificador exacto de la solicitud:

```text
/estado_adicional <solicitud additional_…>
/cancelar_adicional <solicitud additional_…>
```

La cancelación funciona antes del reclamo del ejecutor. Si una respuesta queda incierta, conserva la misma solicitud y consulta su estado: Publisher comprueba el mismo ID del CMS. No abras otro paquete para repetir esa publicación.

## Clasificación

Publisher consulta el catálogo real y el autor configurado de cada CMS. Si la clasificación del original tiene una coincidencia inequívoca, la muestra en la propuesta. Si no, devuelve las opciones disponibles y pide repetir el comando con la selección.

Para OPURO, OPOL y LIBERAL:

```text
/publicar LIBERAL <paquete tg_…> | Economía
```

Para HORIZONTE:

```text
/publicar HORIZONTE <paquete tg_…> | Economía | BCS | La Paz | noticia
/publicar HORIZONTE <paquete tg_…> | Política | México | ninguno | noticia
```

No se infiere una región desconocida. Se aceptan los municipios reales de BCS; México o Mundo no reciben un municipio de BCS. El texto que acompaña a una imagen, una fuente, un reenvío o una respuesta no se interpreta como esta autorización.

## Texto e imágenes

Una publicación ordinaria nueva conserva el MASTER aprobado y los bytes originales de Hero, Destacada e imágenes interiores en Publisher. Los blobs iguales comparten almacenamiento por SHA-256. Se conservan orden, anclajes de párrafo, ALT, pie y crédito; cada medio recibe sus propios archivos, IDs y URLs.

La publicación adicional usa ese contenido y no solicita otra redacción al Motor. Sólo crea el destino elegido; el paquete, solicitud, recibo y posts anteriores conservan su identidad. No genera borradores en los demás medios. Si ya existe una entrega o una nota con el mismo slug en el destino, se detiene y muestra el resultado existente.

Para notas anteriores al archivo, Publisher recupera la versión publicada actual y sus archivos desde el CMS de origen, y guarda esa procedencia como `PUBLISHED_CMS_IMPORT`. No afirma recuperar bytes anteriores a una transformación CDN. Una prueba LITERAL guardada conserva esa modalidad. Las otras importaciones usan `FROZEN_COPY`, un perfil interno que exige el cuerpo publicado exacto y no permite redacción editorial.

Las imágenes Gutenberg conocidas se transfieren con su posición. Galerías, HTML arbitrario y pies ambiguos requieren revisión. Un original modificado después de la captura también se detiene para revisión; no se sobreescribe automáticamente el archivo aprobado.

## Operación

Guard verifica identidad y acceso, manifestaciones SHA-256, confirmación, reserva por destino y slug, reclamos únicos, borrador y lectura independiente antes de permitir publicar. El ejecutor no reintenta automáticamente escrituras inciertas. El resultado y los avisos quedan cercados por la misma solicitud; los enlaces se entregan completos.

El archivo tiene un límite de 1 GiB de blobs únicos, sin borrado automático; hasta 16 interiores, 10 MiB por archivo y 45 MiB por captura. Los límites del transporte editorial ordinario siguen vigentes.

No hay un Motor nuevo ni otro consumidor de eventos. El mismo Motor permanece habilitado y conserva su prompt. La observación de runtime incluye seis escritores, entre ellos el ejecutor adicional. Los flujos nuevos están en el proyecto personal OXÍGENO PURO de n8n, con credenciales existentes y llamadas al ejecutor limitadas al receptor Telegram.

Código: https://github.com/oxigenopuromx-hue/opmx-publisher-guard/pull/25
Corrección del enlace en el intérprete nativo: https://github.com/oxigenopuromx-hue/opmx-publisher-guard/pull/26
Aceptación: [evidencia del release](operations/issue55-additional-publication-20261126/acceptance.md).
