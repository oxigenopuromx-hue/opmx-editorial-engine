# Contrato de bloques Gutenberg y render editorial OPMX v1.0

Estado: **PILOTO VERIFICADO — migración formal de Publisher pendiente**
Actualizado: 2026-10-24
Referencia visual verificada: borrador OPURO `post_id=2790` (“Claude Duet”).

## Propósito

Definir la frontera entre el contenido editorial producido por OPMX, el Publisher n8n, WordPress y los frontends de Oxígeno Puro MX (OPURO) y Oxígeno Político MX (OPOL).

La meta es que una nota se almacene en WordPress como bloques Gutenberg semánticos, UTF-8 y editables; el frontend resuelve la presentación. No se debe conservar ni volver a publicar el HTML monolítico de las plantillas históricas.

## Estado contractual

`contracts/SALIDA_EDITORIAL_OPMX_v2.2.json` sigue vigente y declara `content_format: "clean_html"`. Este documento describe la evolución objetivo **`gutenberg_blocks_v1`**. No se cambia el contrato ni el workflow Publisher hasta que se implemente su adaptador, pruebas y versión formal.

Mientras tanto:
- El flujo vigente no se modifica.
- Este documento es la especificación de la próxima versión del Publisher.
- El piloto migrado sólo es una referencia de estructura y render, no autorización para activar publicaciones automáticas nuevas.

## Invariantes

1. Todo texto se guarda y transmite como UTF-8/utf8mb4: `á`, `ñ`, `¿`, `—` y comillas tipográficas son caracteres Unicode reales; no se serializan masivamente como entidades HTML.
2. El campo WordPress `content` recibe **markup serializado de bloques Gutenberg**, no HTML renderizado ni un bloque `core/html` que englobe toda la nota.
3. Título, bajada, autor, fecha, tiempo de lectura, categorías, tags, botones, header, footer y la imagen destacada no se duplican dentro del cuerpo.
4. Imagen destacada, categorías y etiquetas se envían/gestionan como campos y taxonomías propias de WordPress.
5. Las clases `opmx-*` son semánticas y estables; el frontend las transforma visualmente. No contienen estilos inline.
6. Una nota debe seguir siendo legible en un tema que no conozca esas clases: los bloques base mantienen su semántica nativa.

## Mapa de bloques

| Módulo editorial | Serialización Gutenberg | Clase requerida | Render OPURO |
|---|---|---|---|
| Entradilla | `core/paragraph` | `opmx-editorial__lede` | Capitular y mayor jerarquía |
| “En breve” | `core/group` → `core/heading` + `core/list` | `opmx-module opmx-module--brief` | Regla horizontal, etiqueta y lista |
| Cuerpo | `core/paragraph`, `core/heading`, `core/list`, `core/quote` | ninguna salvo necesidad editorial | Tipografía, medida y acento de títulos |
| Cierre editorial | `core/group` → etiqueta opcional + `core/heading` + párrafos | `opmx-module opmx-module--closure` | Recuadro de cierre |
| Fuentes | `core/group` → `core/heading` + `core/list ordered` | `opmx-module opmx-module--sources` | Separador y listado editorial |
| Etiqueta de módulo | `core/paragraph` | `opmx-module__eyebrow` | Microetiqueta en mayúsculas |
| Imagen interior | `core/image` | ninguna salvo alineación | Imagen y pie de foto nativos |
| Cita | `core/quote` | ninguna | Estilo de cita del frontend |

### Ejemplo mínimo

```html
<!-- wp:group {"className":"opmx-module opmx-module--brief"} -->
<div class="wp-block-group opmx-module opmx-module--brief">
  <!-- wp:heading {"level":2} -->
  <h2>En breve</h2>
  <!-- /wp:heading -->

  <!-- wp:list -->
  <ul><li>Primer punto verificable.</li></ul>
  <!-- /wp:list -->
</div>
<!-- /wp:group -->
```

WordPress muestra ese contenido como bloques editables. La clase se encuentra en el editor en **Bloque → Avanzado → Clases CSS adicionales**.

## Regla de la entradilla y capitular

El piloto actual aplica la capitular visual al primer párrafo visible del cuerpo mediante CSS. Para producción, el Publisher debe emitir explícitamente el primer párrafo con `opmx-editorial__lede`.

Esto evita ambigüedad si una nota comienza con una imagen, embed, cita o un módulo. El frontend podrá usar la clase como selector principal y mantener el selector de primer párrafo sólo como compatibilidad con notas migradas.

## Exclusiones obligatorias del cuerpo

El Publisher y cualquier migrador deben remover, y nunca recrear dentro de `content`:

- masthead, logo, navegación y ticker;
- H1/título y bajada duplicados;
- autor, fecha, tiempo de lectura y botones de compartir;
- hero/featured image duplicada;
- footer, legales, newsletter y recomendados;
- etiquetas, categorías o metadatos visuales;
- marcadores de plantilla como `MASTHEAD`, `FOOTER` o `CIERRE EDITORIAL`.

## Requisitos para Publisher vNext

Antes de escribir el post, el adaptador Gutenberg deberá:

1. Recibir la salida editorial estructurada.
2. Generar bloques válidos de una whitelist: `core/paragraph`, `core/heading`, `core/group`, `core/list`, `core/image`, `core/quote`, `core/embed` y `core/separator`.
3. Serializar comentarios `<!-- wp:* -->` balanceados y atributos JSON válidos.
4. Asignar las clases semánticas del mapa anterior.
5. Enviar el resultado en `content` al endpoint WordPress; no usar `content.rendered`.
6. Asignar imagen destacada, categorías, etiquetas y SEO como datos separados.
7. Leer de vuelta el post con `context=edit` y validar: bloques presentes, UTF-8 válido, sin chrome legado, taxonomías correctas y featured media única.
8. Dejar el post como `draft` en el piloto hasta una aprobación editorial explícita.

La validación debe fallar si encuentra un HTML global encapsulado en `core/html`, marcadores de plantilla prohibidos, caracteres mojibake comunes (`Ã`, `Â`, `â`), comentarios de bloque desbalanceados o una imagen de portada dentro del cuerpo cuando ya exista `featured_media`.

## Compatibilidad OPURO y OPOL

### OPURO

El frontend OPURO implementa la piel editorial: serif, portada enmarcada, capitular, módulos de “En breve”, cierre, fuentes y chips de etiquetas. El CSS está limitado a la página/artículo y a las clases `opmx-*`; el contenido permanece portable.

### OPOL

WordPress conservará los mismos bloques y clases sin pérdida. Si el frontend o tema OPOL no conoce una clase `opmx-*`:

- El contenido seguirá apareciendo como un grupo, encabezado y lista Gutenberg válidos.
- No aparecerá la composición visual OPURO (capitular, recuadro, reglas, etc.).
- No debe romperse la nota ni convertirse en HTML clásico.

Para paridad visual se debe incorporar una hoja de estilos OPOL compatible o un tema editorial OPOL explícitamente aprobado. No se deben copiar estilos inline dentro de cada nota para forzar esa paridad.

## Pruebas de aceptación

Una implementación está lista para piloto sólo si:

- WordPress abre cada elemento como bloque Gutenberg, no como HTML personalizado.
- El cuerpo no contiene chrome de plantilla ni metadatos duplicados.
- La primera entradilla tiene `opmx-editorial__lede`.
- Los módulos “En breve”, cierre y fuentes conservan sus clases tras guardar y leer por REST.
- OPURO renderiza la piel editorial.
- OPOL renderiza un fallback semántico legible, con o sin la piel compartida.
- La respuesta REST y el frontend muestran UTF-8 correcto.
- Una edición manual pequeña en Gutenberg no destruye el resto de los bloques.
