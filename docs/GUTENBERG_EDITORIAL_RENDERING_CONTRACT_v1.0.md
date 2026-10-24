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


## Decisión de arquitectura: un cuerpo canónico para OPURO y OPOL

La unidad común será **`content_gutenberg_v1`**: un único documento Gutenberg serializado por nota, consumido por ambos CMS/frontends.

“Único” significa una sola representación editorial canónica, **no** un único bloque `core/html` ni un bloque gigante. El documento usa varios bloques nativos para que el editor conserve edición granular, accesibilidad y portabilidad.

```
Motor Editorial → blueprint editorial estructurado
                → serializador determinista
                → content_gutenberg_v1
                → WordPress
                ↙              ↘
      tema OPURO            tema OPOL
```

- OPURO y OPOL reciben el mismo `content_gutenberg_v1`.
- Cada plataforma aplica su propio CSS a los mismos bloques y clases `opmx-*`.
- Nunca se bifurca el texto, las fuentes ni la estructura de módulos por marca.
- Las diferencias de marca viven en el frontend/tema; no se introducen con HTML alternativo dentro del post.

### Responsabilidad del Motor Editorial

El Motor Editorial no debe redactar header, footer, metadatos visuales ni HTML de plantilla. Para cada nota entregará un **blueprint editorial** con:

- `lede`: primer párrafo de apertura;
- `brief`: lista opcional de puntos verificables;
- `sections`: encabezados y párrafos en orden;
- `images` y embeds internos cuando existan;
- `closure`: módulo editorial opcional;
- `sources`: lista ordenada de fuentes;
- `taxonomies` y `featured_media` como datos separados.

El adaptador Gutenberg del Publisher convierte ese blueprint a `content_gutenberg_v1`. Esta separación evita que un modelo de lenguaje tenga que emitir comentarios Gutenberg a mano y permite validar la salida de forma determinista.

### Insumos necesarios para convertir notas históricas

Para cada nota se requiere, en orden de preferencia:

1. **Snapshot o HTML editorial original** de la nota. Es la fuente para conservar jerarquía, módulos, citas, fuentes y enlaces.
2. **Versión de plantilla identificable**. La plantilla maestra v5 es el perfil principal; variantes históricas se clasifican antes de convertirlas.
3. **Metadatos WordPress existentes**: título, excerpt/bajada, autor, fecha, categorías, etiquetas, SEO y estado.
4. **Featured media e imágenes interiores** disponibles o un registro explícito de ausencia. La portada se mantiene fuera del cuerpo; las imágenes interiores se convierten a `core/image`.
5. **Regla de excepción** si una sección no puede preservarse sin inventar contenido: se conserva como párrafos/encabezados semánticos, se registra la advertencia y nunca se rellena con texto supuesto.

No se requiere intervención manual del usuario por cada nota si existen los snapshots, media y metadatos. La revisión humana se concentra en los casos de plantilla no reconocida, medios ausentes, HTML dañado o módulos ambiguos.

### Pipeline de conversión histórica

1. Detectar plantilla y localizar el contenedor editorial útil.
2. Eliminar chrome heredado: masthead, hero duplicado, meta, share, tags, footer y marcadores.
3. Extraer el cuerpo en un blueprint semántico.
4. Marcar explícitamente el primer párrafo como `opmx-editorial__lede`.
5. Convertir módulos identificados a grupos `opmx-module`.
6. Serializar `content_gutenberg_v1` en UTF-8.
7. Guardar snapshot inmutable antes de modificar.
8. Escribir como borrador, leer de vuelta con `context=edit` y validar bloques, clases, media, enlaces y codificación.
9. Renderizar en las dos pieles, OPURO y OPOL, antes de publicar.

### Criterio para una sola salida Publisher

El Publisher vNext deberá aceptar o construir sólo `content_gutenberg_v1` en la frontera WordPress. `clean_html` seguirá siendo un formato heredado durante la transición, pero no será la salida objetivo.

La migración formal requiere:
- ampliar el contrato editorial con el blueprint y `content_gutenberg_v1`;
- crear el serializador/validador determinista;
- incorporar pruebas con notas de plantilla v5 y variantes históricas;
- añadir estilos de módulos al frontend OPOL;
- ejecutar un piloto de borradores y aprobarlo antes de activar publicación automática.
