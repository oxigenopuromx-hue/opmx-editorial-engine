# PROTOCOLO EDITORIAL MAESTRO — OXÍGENO PURO MX
## Generación de notas periodísticas optimizadas para SEO
**Versión 4.2 · Agosto 2026 · OPMX-4.2**

---

## 0. PROPÓSITO Y ALCANCE

Este documento es el protocolo editorial maestro de Oxígeno Puro MX.

Define cómo debe procesarse una fuente de información —URL, documento PDF, imagen o texto— para generar una nota periodística profesional, verificable, clara y optimizada para SEO.

Este archivo contiene **reglas editoriales**. No contiene credenciales, claves API, configuración de n8n, instrucciones específicas de WordPress ni secretos técnicos.

La automatización podrá leer este protocolo y aplicar sus reglas sin que sea necesario modificar el flujo de trabajo.

### Principios rectores

- Periodismo profesional basado en datos verificables.
- Tono institucional, moderno, reflexivo y propositivo.
- Enfoque estratégico y analítico.
- Visión de desarrollo nacional y prosperidad compartida.
- Lenguaje claro, directo y accesible.
- Sin lenguaje partidista en piezas informativas.
- Sin exageraciones, adjetivos vacíos ni afirmaciones no sustentadas.
- Diferenciación clara entre hechos, declaraciones, análisis e interpretación editorial.
- La calidad periodística tiene prioridad sobre cualquier métrica SEO.

---

# 1. REGLAS GENERALES DE PROCESAMIENTO

A partir de la fuente proporcionada, realizar las siguientes etapas en orden:

1. Identificar y leer la fuente.
2. Extraer los datos relevantes.
3. Verificar los datos centrales.
4. Identificar discrepancias, ambigüedades o información no verificable.
5. Investigar contexto adicional cuando sea necesario.
6. Determinar el enfoque periodístico.
7. Definir la palabra clave objetivo y las palabras clave secundarias.
8. Redactar la nota.
9. Optimizar SEO sin sacrificar naturalidad.
10. Generar los elementos para WordPress.
11. Validar la pieza completa.
12. Entregar el resultado conforme al formato establecido.

### Regla de prioridad

Cuando exista conflicto entre:

- precisión periodística;
- claridad;
- naturalidad;
- SEO;

la prioridad será:

**1. Veracidad → 2. Rigor → 3. Claridad → 4. Calidad editorial → 5. SEO.**

Nunca modificar un dato verdadero únicamente para satisfacer una métrica SEO.

---

# 1A. ENTRADAS Y NORMALIZACIÓN DE FUENTES

El sistema debe aceptar una o varias fuentes para una misma nota.

## Tipos de entrada admitidos
- URL web.
- PDF.
- DOCX / Word.
- TXT.
- Markdown.
- HTML.
- Imagen (JPG, JPEG, PNG, WebP).
- CSV.
- XLSX.
- Texto pegado directamente.
- Otros formatos convertibles de forma segura a contenido legible.

## Paquetes de múltiples fuentes
Una nota puede construirse con varias fuentes simultáneas. Cada fuente debe conservar su identificador, tipo, nombre o URL, metadatos, contenido extraído, estado de extracción y advertencias. Nunca fusionar fuentes de modo que se pierda su procedencia.

## Normalización
Antes de aplicar el protocolo editorial, cada entrada debe convertirse a una representación normalizada que preserve, cuando existan: texto, encabezados, tablas, listas, fechas, nombres, cifras, URLs, pies de imagen y metadatos relevantes.

### URL
Extraer el contenido principal y descartar, cuando sea posible, navegación, publicidad y elementos ajenos a la pieza.

### PDF
Extraer texto y estructura. Si es escaneado o contiene información esencial únicamente como imagen, utilizar extracción visual/OCR cuando sea necesario y registrar esa condición.

### DOCX / Word
Preservar texto, encabezados, listas, tablas y vínculos relevantes.

### Imágenes
Analizar contenido visual y textual relevante. No inferir datos ilegibles o ausentes.

### CSV / XLSX
Preservar filas, columnas, encabezados, unidades y relaciones tabulares. No convertir tablas en prosa antes de verificar su estructura.

### Texto / TXT / Markdown / HTML
Preservar el contenido sustantivo y eliminar únicamente artefactos técnicos ajenos a la fuente.

## Fallos de extracción
Si una fuente no puede extraerse de forma confiable:
- marcarla como `failed` o `partial`;
- explicar la causa;
- no inventar contenido faltante;
- bloquear el proceso si contiene información central indispensable.

## Separación de responsabilidades
La capa de entrada y extracción prepara la evidencia. El protocolo editorial interpreta y redacta después de recibir las fuentes normalizadas.

---

# 1B. NORMALIZACIÓN DE URLS Y RESOLUCIÓN DE REDIRECCIONES

Antes de extraer contenido web, toda URL debe pasar por una etapa obligatoria de normalización.

## Regla de entrada

Se deben preferir URLs directas al medio, institución, documento u organismo que publica la fuente.

Sin embargo, el sistema debe aceptar también enlaces intermediarios, enlaces AMP, enlaces compartidos desde buscadores, redes o aplicaciones de mensajería, y resolverlos cuando sea posible.

El formulario puede mostrar la indicación:

> Pega preferentemente la URL directa del medio o institución. Se aceptan enlaces de Google, AMP o redirecciones, pero serán normalizados automáticamente.

## Objetivo

La normalización debe distinguir entre:

- URL recibida;
- URL intermediaria;
- URL final resuelta;
- URL canónica;
- fuente periodística o institucional real.

Google, un agregador, una red social o una página de redirección no deben registrarse como fuente editorial cuando solo funcionan como intermediarios.

## Campos obligatorios por fuente web

Cada fuente de tipo URL debe registrar:

```text
original_url
normalized_url
final_url
canonical_url
redirect_detected
redirect_provider
tracking_parameters_removed
normalization_status
normalization_warnings
```

### `original_url`

URL exactamente proporcionada por el usuario. Nunca sobrescribirla.

### `normalized_url`

URL limpiada y preparada para resolución:

- esquema validado;
- espacios eliminados;
- caracteres codificados interpretados de forma segura;
- parámetros de seguimiento prescindibles retirados;
- estructura de Google AMP o redirect identificada cuando corresponda.

### `final_url`

URL final obtenida después de seguir redirecciones HTTP legítimas.

### `canonical_url`

URL declarada como canónica por la página, cuando pueda verificarse de manera confiable. Si no existe o no puede verificarse, utilizar `null`.

## Casos admitidos

El sistema debe reconocer, entre otros:

- `google.com/amp/...`;
- `google.com/url?...`;
- URLs AMP del propio medio;
- redirecciones HTTP 301, 302, 303, 307 y 308;
- parámetros `utm_*`;
- parámetros de campañas o tracking prescindibles;
- enlaces compartidos desde aplicaciones que redirigen a la fuente final.

## Google AMP

Cuando la URL utilice una estructura intermediaria de Google AMP:

1. conservar `original_url`;
2. identificar `redirect_provider = google_amp`;
3. extraer o resolver la URL del medio;
4. preferir la versión directa o canónica del medio;
5. no extraer el contenido desde Google si la fuente directa puede resolverse.

## AMP del propio medio

Si la URL apunta a una versión AMP publicada por el propio medio:

- buscar `canonical_url`;
- preferir la versión canónica para extracción cuando esté disponible;
- conservar la URL AMP como referencia técnica;
- no asumir que la versión AMP es la principal.

## Limpieza de tracking

Se pueden retirar parámetros como:

```text
utm_source
utm_medium
utm_campaign
utm_term
utm_content
gclid
fbclid
```

solo cuando su eliminación no altera el acceso al contenido.

No eliminar parámetros funcionales necesarios para identificar el artículo, idioma, edición o recurso.

## Seguridad

Solo se admiten esquemas:

```text
https
http
```

Rechazar:

- `javascript:`;
- `data:`;
- `file:`;
- esquemas desconocidos;
- URLs locales o privadas no autorizadas;
- destinos que no puedan resolverse con seguridad.

## Estados de normalización

- `PASS_DIRECT`
- `PASS_REDIRECT_RESOLVED`
- `PASS_CANONICAL_RESOLVED`
- `WARNING_PARTIAL`
- `HUMAN_REQUIRED`
- `BLOCKED`

## Regla de extracción

La extracción de contenido web solo puede comenzar después de esta etapa.

```text
original_url
→ normalized_url
→ resolver redirecciones
→ final_url
→ comprobar canonical
→ canonical_url o final_url
→ extracción
```

## Fallos

Si el destino real no puede resolverse:

- no inventar la URL;
- no atribuir el contenido a Google, agregadores o redirecciones;
- marcar `HUMAN_REQUIRED`;
- solicitar una URL directa o revisión humana.

---

# 1C. ARQUITECTURA DE INGESTIÓN MULTIFUENTE

La ingestión editorial debe aceptar cualquier combinación válida de:

- una o varias URLs;
- texto directo;
- uno o varios documentos;
- una imagen opcional.

La ausencia de una categoría opcional de entrada no debe detener el workflow.

## Principio de una sola nota

Varias fuentes pertenecientes al mismo envío deben formar un único expediente editorial.

```text
N URLs
+ N documentos
+ texto directo opcional
+ una imagen opcional
→ un solo editorial_dossier
→ una sola nota
```

Separar fuentes para su extracción no significa generar una nota por fuente.

## Identidad estable de fuentes

Cada fuente debe recibir un identificador estable desde su separación:

```text
url_1
url_2
document_1
document_2
direct_text_1
```

El `source_id` debe viajar dentro del propio item durante toda la cadena.

No depender de referencias ambiguas hacia nodos anteriores para recuperar identidad, URL o metadatos cuando existan múltiples items.

## Procesamiento de URLs

Cada URL debe recorrer de manera independiente:

```text
separación
→ normalización
→ resolución HTTP
→ descarga
→ extracción de metadatos
→ interpretación JSON-LD
→ extracción y limpieza del cuerpo
→ source_normalized
```

Después, todas las fuentes web deben reunirse en:

```text
web_sources[]
web_source_summary
```

## Extracción web validada

La extracción debe usar capas complementarias:

1. meta tags y Open Graph;
2. JSON-LD, con preferencia por `NewsArticle` y `Article`;
3. cuerpo mediante selectores HTML candidatos;
4. limpieza heurística;
5. detección de fin de artículo;
6. eliminación de publicidad, módulos relacionados, correo, footer y copyright.

Cuando un JSON-LD contenga caracteres de control inválidos, se permite una limpieza técnica previa al parseo, sin alterar el contenido sustantivo.

## Fuentes bloqueadas

Una fuente bloqueada por CAPTCHA, HTTP 403, paywall técnico o protección anti-bot no debe derribar todo el expediente si existen otras fuentes utilizables.

Debe:

- conservar URL y diagnóstico;
- marcarse como `failed`, `partial`, `HUMAN_REQUIRED` o `BLOCKED`, según corresponda;
- añadir una advertencia;
- permitir que las demás fuentes continúen;
- bloquear el expediente completo solo cuando no exista ninguna fuente sustantiva utilizable.

No evadir CAPTCHA ni protecciones de acceso.

## Documentos

Los documentos deben separarse individualmente y recibir un `source_id`.

Para múltiples archivos, el nombre binario original puede variar. La separación debe remapear cada archivo a una propiedad binaria estable:

```text
document_file
```

Cada documento debe generar un objeto `document_normalized`.

## PDF con texto

Para PDF con texto seleccionable:

```text
Extract From File
→ Extract From PDF
→ normalización del texto
→ document_normalized
```

Debe registrar:

- nombre;
- MIME;
- tamaño;
- número de páginas;
- autor e idioma cuando existan;
- contenido;
- párrafos;
- conteo de palabras;
- método de extracción;
- estado y advertencias.

Un PDF sin texto suficiente debe marcarse como `partial` o `failed` y puede requerir OCR o revisión humana.

## Reunión documental

Después de procesar cada documento:

```text
document_sources[]
document_source_summary
```

## Texto directo

Cuando exista texto pegado en el formulario, debe convertirse en una fuente normalizada independiente:

```text
source_id: direct_text_1
input_type: text
publisher: Texto proporcionado directamente
```

## Entradas opcionales y paquetes vacíos

Las ramas de URLs y documentos son opcionales.

Cuando no existan URLs, la rama FALSE debe emitir:

```json
{
  "web_sources": [],
  "web_source_summary": {
    "total": 0,
    "successful": 0,
    "partial": 0,
    "failed": 0,
    "unresolved": 0,
    "total_words": 0,
    "multi_source": false,
    "overall_status": "ready"
  }
}
```

Cuando no existan documentos, la rama FALSE debe emitir:

```json
{
  "document_sources": [],
  "document_source_summary": {
    "total": 0,
    "successful": 0,
    "partial": 0,
    "failed": 0,
    "total_words": 0,
    "multi_document": false,
    "overall_status": "ready"
  }
}
```

Esto evita que los nodos Merge queden esperando una entrada inexistente.

## Gestión de binarios

La imagen no debe copiarse dentro de cada item URL o documento.

Reglas:

- conservar el binario de imagen en la rama principal;
- retirar Binary de la rama multi-URL;
- remapear cada documento temporalmente a `document_file`;
- después de extraer el texto, descartar los binarios documentales;
- reincorporar la imagen una sola vez al expediente;
- al finalizar ingestión, conservar únicamente la imagen necesaria.

Esto evita duplicados, uso innecesario de memoria y subidas repetidas a WordPress.

## Editorial dossier

La salida del módulo de ingestión debe ser un solo item:

```text
editorial_dossier
```

Debe contener:

```text
protocol_id
ingestion
sources[]
source_summary
image_context
submission_context
document_processing
status
```

## Estados de ingestión

- `ready` — existe al menos una fuente utilizable y no hay fallos relevantes.
- `partial` — existe contenido utilizable, pero alguna fuente falló o quedó incompleta.
- `blocked` — no existe ninguna fuente sustantiva utilizable.

Estado final para continuar:

```text
READY_FOR_EDITORIAL_ENGINE
```

Estado de bloqueo:

```text
BLOCKED
```

## Combinaciones mínimas validadas

El workflow debe funcionar con:

- solo texto;
- URLs sin documentos;
- documentos sin URLs;
- URL + imagen;
- URL + PDF;
- múltiples URLs;
- múltiples PDF;
- URLs + PDF + texto + imagen.

La imagen es opcional. URLs y documentos también son opcionales, pero debe existir al menos una fuente sustantiva entre URL, texto o documento.

---

# 2. VERIFICACIÓN DE FUENTES

La verificación es obligatoria antes de redactar.

## 2.1 Fuente principal

Si se proporciona una URL:

- Abrir y leer la fuente.
- Identificar título, autor o institución, fecha y contenido.
- Distinguir información editorial de declaraciones de terceros.
- No asumir que el titular de la fuente es correcto si sus datos internos lo contradicen.

Si se proporciona PDF, imagen o texto:

- Extraer la información disponible.
- Identificar datos incompletos, ilegibles o ambiguos.
- No completar información mediante suposiciones.

## 2.2 Fuentes de contraste

Cuando una cifra, fecha, cargo, nombre, declaración o afirmación sea central para la nota:

- Contrastar con al menos una fuente adicional.
- Priorizar fuentes oficiales, organismos internacionales, instituciones académicas y documentos primarios.
- Utilizar medios reconocidos cuando sean necesarios para contexto o contraste.
- No utilizar una fuente secundaria como prueba definitiva cuando exista una fuente primaria accesible.

## 2.3 Discrepancias

Si existe una discrepancia entre:

- titular y contenido;
- fuente principal y fuente de contraste;
- cifras;
- fechas;
- nombres;
- cargos;
- declaraciones;

se debe señalar antes del entregable.

### Regla crítica

**Si una discrepancia afecta sustancialmente la interpretación de la noticia, detener la redacción y reportarla al usuario.**

No reproducir una afirmación dudosa como hecho.

## 2.4 Datos no verificables

Si un dato no puede verificarse:

- señalarlo;
- atribuirlo a la fuente que lo afirma;
- evitar presentarlo como hecho confirmado;
- no inventar información para completar el artículo.

---

# 3. EQUILIBRIO Y RIGOR EDITORIAL

## 3.1 Atribución

Las afirmaciones controvertidas deben atribuirse claramente a quien las sostiene.

Ejemplo:

> La institución informó que...

No:

> La institución logró...

cuando el resultado no haya sido comprobado.

## 3.2 Contrapunto

Cuando exista un debate científico, técnico, jurídico, económico o político legítimo:

- incluir el contrapunto disponible;
- diferenciar hechos de opiniones;
- evitar presentar una sola posición como verdad absoluta.

## 3.3 Esfuerzo vs. resultado

Ante cifras oficiales o institucionales:

- identificar qué indicador mide realmente el resultado;
- distinguir acciones realizadas de resultados obtenidos;
- evitar convertir anuncios en resultados comprobados.

## 3.4 Lenguaje informativo

No utilizar en Noticias expresiones de adhesión, propaganda o exaltación.

Evitar, entre otras:

- épica;
- histórica sin sustento;
- extraordinaria;
- fuente de inspiración;
- aplauso atronador;
- éxito rotundo;
- transformación sin evidencia.

La valoración editorial debe reservarse para piezas de Opinión o análisis explícitamente identificados.

## 3.5 Crítica constructiva

Cuando exista un problema:

- describirlo con precisión;
- explicar sus implicaciones;
- señalar qué debería medirse, transparentarse o mejorarse cuando sea pertinente;
- evitar descalificaciones personales o institucionales.

---

# 4. ESTRUCTURA DEL ARTÍCULO

| Elemento | Especificación |
|---|---|
| Título SEO / H1 | Máximo 60 caracteres. Incluir palabra clave objetivo, preferentemente al inicio |
| Subtítulo SEO | Máximo 160 caracteres |
| Entradilla | Entre 100 y 120 palabras |
| Desarrollo | 3 a 5 secciones con subtítulos H2 |
| Cierre editorial | Reflexión estructural, visión de largo plazo y llamado institucional no partidista |
| Extensión | Entre 850 y 1,050 palabras, salvo que la naturaleza de la noticia exija otra extensión |
| Metadescripción | Máximo 155 caracteres |
| Palabra clave objetivo | Definida antes de la redacción |
| Palabras clave secundarias | Mínimo 5 y máximo 8 recomendadas |

## 4.1 Entradilla

Debe:

- tener entre 100 y 120 palabras;
- presentar el hecho principal;
- incluir la palabra clave objetivo al inicio o en la primera oración de forma natural;
- explicar relevancia e impacto;
- aportar visión nacional o estratégica cuando corresponda;
- evitar repetir literalmente el titular.

## 4.2 Desarrollo

Debe contener:

- entre 3 y 5 H2;
- información verificable;
- contexto;
- cifras relevantes;
- declaraciones atribuidas;
- implicaciones;
- fuentes externas integradas naturalmente.

## 4.3 Cierre editorial

Debe:

- sintetizar la relevancia estructural;
- evitar propaganda;
- plantear una perspectiva de largo plazo;
- señalar oportunidades, retos o elementos que deben observarse;
- mantener tono institucional.

---

# 5. SEO

## 5.1 Palabra clave objetivo

La palabra clave objetivo debe:

- aparecer en el título SEO/H1;
- aparecer en el slug;
- aparecer al inicio de la entradilla o en la primera oración;
- aparecer en al menos un H2;
- aparecer de manera natural en el contenido.

La elección debe considerar:

- intención de búsqueda;
- relevancia periodística;
- especificidad;
- posibilidad de posicionamiento;
- riesgo de canibalización.

## 5.2 Densidad

Objetivo recomendado para compatibilidad con Rank Math:

**1 % a 1.5 %.**

Una densidad superior a **2.5 %** debe generar advertencia por posible sobreoptimización.

Esta cifra es una referencia de optimización, no una obligación mecánica.

### Regla de naturalidad

Nunca repetir una palabra clave artificialmente para alcanzar un porcentaje.

Si la densidad está fuera del rango pero el texto es natural y semánticamente sólido:

- no introducir repeticiones innecesarias;
- registrar la desviación en el checklist cuando sea relevante.

## 5.3 Título

Máximo:

**60 caracteres.**

Debe ser:

- claro;
- informativo;
- específico;
- atractivo sin caer en clickbait;
- compatible con la intención de búsqueda.

## 5.4 Metadescripción

Máximo:

**155 caracteres.**

Debe:

- resumir el contenido;
- incluir la palabra clave cuando sea natural;
- incentivar el clic sin prometer algo que el artículo no contiene.

## 5.5 Slug

Debe:

- incluir la palabra clave objetivo;
- utilizar palabras claras;
- evitar palabras innecesarias;
- utilizar minúsculas;
- separar palabras con guiones.

La URL completa:

**https://oxigenopuro.com.mx/[slug]**

debe mantenerse preferentemente por debajo de **75 caracteres**.

---

# 5A. POLÍTICA DE OPTIMIZACIÓN PARA RANK MATH

El sistema debe buscar la mayor compatibilidad razonable con las pruebas de Rank Math, subordinada siempre a la integridad periodística.

## Jerarquía de decisión

1. Veracidad y precisión.
2. Claridad informativa.
3. Intención de búsqueda.
4. Naturalidad editorial.
5. Compatibilidad con Rank Math.
6. Puntuación numérica del plugin.

Una nota no debe degradarse editorialmente para obtener una puntuación perfecta.

## Pruebas obligatorias

Deben cumplirse salvo impedimento justificado:

- palabra clave objetivo en el título SEO;
- palabra clave objetivo en la metadescripción cuando sea natural;
- palabra clave objetivo en la URL;
- palabra clave objetivo al inicio del contenido;
- palabra clave objetivo en al menos un H2;
- enlaces internos y externos pertinentes;
- extensión suficiente;
- legibilidad;
- alt text;
- título y metadescripción dentro de los límites establecidos.

## Densidad

- objetivo recomendado: **1 % a 1.5 %**;
- advertencia por debajo de 1 %;
- advertencia reforzada al superar 2.5 %;
- nunca añadir repeticiones artificiales;
- considerar la forma exacta en que Rank Math cuenta la keyword principal y las secundarias.

## Número en el título

Intentar incorporar un número únicamente cuando:

- exista un dato numérico central y verificable;
- el formato sea naturalmente una lista, guía, balance, cronología o conjunto de claves;
- el número aporte contexto real;
- no altere el género periodístico de la pieza.

No inventar números ni convertir artificialmente una noticia en lista.

## Power word

Intentar una power word únicamente cuando sea:

- precisa;
- compatible con el tono institucional;
- respaldada por el contenido;
- no sensacionalista.

Power words aceptables según contexto pueden incluir:

- clave;
- nuevo;
- oficial;
- estratégico;
- decisivo;
- relevante;
- urgente;
- histórico, únicamente cuando sea verificable.

Evitar:

- increíble;
- impactante;
- sorprendente;
- imperdible;
- espectacular;
- explosivo;

salvo que se trate de una pieza de opinión o un contexto excepcional que lo justifique.

## Sentimiento en el título

No forzar sentimiento positivo o negativo en noticias neutrales.

El título debe reflejar el hecho, no manipular emocionalmente al lector.

## Resultado esperado

El sistema debe registrar cada prueba como:

- `PASS`;
- `WARNING_EDITORIAL`;
- `NOT_APPLICABLE`;
- `FAIL`.

`WARNING_EDITORIAL` significa que la recomendación de Rank Math fue omitida deliberadamente para preservar calidad y rigor.

---

# 6. ENLACES EXTERNOS

Incluir como mínimo:

**5 enlaces externos relevantes**, cuando existan fuentes suficientes y pertinentes.

Prioridad:

1. fuentes oficiales;
2. organismos internacionales;
3. instituciones académicas;
4. documentos primarios;
5. medios reconocidos.

Los enlaces deben estar:

- integrados naturalmente en el cuerpo;
- asociados con un texto ancla descriptivo;
- relacionados directamente con la afirmación respaldada.

Formato recomendado:

```html
<a href="URL" target="_blank" rel="noopener noreferrer">texto ancla</a>
```

### Importante

No utilizar `rel="dofollow"` como requisito.

Un enlace editorial normal sin `nofollow` es suficiente para no marcarlo como nofollow.

No utilizar `nofollow` en enlaces editoriales normales salvo que exista una razón específica.

### Verificación

No inventar URLs profundas.

Si una URL específica no puede verificarse:

- utilizar una página estable y comprobable;
- o no incluir el enlace.

---

# 7. ENLAZADO INTERNO

Cuando el módulo de enlazado interno esté activo:

- sugerir 3 enlaces internos relevantes;
- priorizar notas relacionadas;
- evitar enlaces artificiales;
- evitar dirigir todas las notas hacia la misma página;
- detectar posible canibalización temática.

---

# 8. ALERTA DE CANIBALIZACIÓN SEO

Antes de finalizar una nota, evaluar si la palabra clave objetivo podría competir con contenidos existentes de Oxígeno Puro MX.

Si existe una coincidencia importante:

1. advertir la posible canibalización;
2. identificar la temática o keyword competidora cuando sea posible;
3. proponer una keyword diferenciada;
4. proponer un slug alternativo;
5. sugerir consolidación únicamente cuando tenga sentido editorial y SEO.

No bloquear automáticamente una nota por coincidencia. La decisión editorial prevalece.

---

# 9. ESTILO EDITORIAL OXÍGENO PURO MX

## Tono

- institucional;
- moderno;
- reflexivo;
- propositivo;
- analítico;
- directo.

## Enfoque

Conectar, cuando sea pertinente, con:

- desarrollo nacional;
- prosperidad compartida;
- productividad;
- innovación;
- infraestructura;
- bienestar;
- fortalecimiento institucional;
- competitividad;
- sostenibilidad;
- Plan México.

### Regla

No introducir artificialmente estos conceptos si la fuente no guarda relación real con ellos.

## Redacción

Preferir:

- oraciones claras;
- verbos activos;
- párrafos breves;
- vocabulario accesible;
- datos concretos;
- atribuciones precisas.

Objetivo:

- oraciones de aproximadamente 12 a 20 palabras;
- máximo 20 % de frases mayores a 20 palabras;
- párrafos de 3 a 5 líneas visuales aproximadamente.

Estas métricas son objetivos de legibilidad, no razones para sacrificar precisión.

---

# 10. TRATAMIENTO DE DECLARACIONES

Cuando se utilicen declaraciones:

- identificar claramente al autor;
- no alterar su sentido;
- utilizar citas textuales solo cuando sean necesarias;
- evitar atribuir una interpretación no expresada;
- verificar nombre, cargo y fecha.

Si la fuente contiene una declaración controvertida:

- atribuirla;
- contextualizarla;
- incluir contrapunto cuando corresponda.

---

# 11. DATOS, CIFRAS Y FECHAS

Verificar especialmente:

- porcentajes;
- cantidades;
- montos;
- fechas;
- edades;
- cargos;
- nombres;
- parentescos;
- ubicaciones;
- periodos;
- unidades de medida.

Cuando una cifra pueda inducir a error:

- explicar qué representa;
- señalar periodo;
- señalar unidad;
- distinguir estimación de dato observado.

---

# 12. FUENTES EN OTROS IDIOMAS

Si la fuente está en inglés u otro idioma:

- traducir al español mexicano;
- mantener precisión conceptual;
- conservar nombres propios;
- no traducir nombres oficiales de instituciones cuando exista una denominación oficial en español;
- verificar las cifras y fechas.

---

# 13. IMAGEN DESTACADA

Generar:

- nombre de archivo sugerido;
- texto alternativo;
- prompt visual cuando el módulo de imagen esté activo.

El alt text debe:

- describir objetivamente la imagen;
- ser útil para accesibilidad;
- evitar keyword stuffing;
- no comenzar con "imagen de" salvo que sea necesario.

El nombre de archivo debe:

- utilizar minúsculas;
- separar palabras con guiones;
- evitar caracteres especiales;
- ser descriptivo.

---

# 13A. IMAGE PIPELINE — POLÍTICA VISUAL OPMX

El sistema visual debe operar como un módulo separado del motor editorial.

Su función es seleccionar, validar, optimizar, registrar y preparar la imagen destacada de cada nota sin alterar el contenido informativo de fotografías reales.

## Jerarquía de origen

Aplicar esta prioridad:

1. `USER_PROVIDED`  
   Imagen proporcionada directamente por Oxígeno Puro MX.

2. `OFFICIAL_SOURCE`  
   Fotografía obtenida de una fuente oficial o institucional adecuada, con procedencia registrable y condiciones de uso razonablemente verificables.

3. `AI_GENERATED`  
   Imagen editorial original generada para OPMX cuando no exista una fotografía adecuada o el tema sea abstracto.

4. `HUMAN_REQUIRED`  
   Estado obligatorio cuando no exista una opción segura, pertinente o jurídicamente clara.

## Regla de prioridad

Si Oxígeno Puro MX proporciona una imagen, esa imagen debe usarse como primera opción salvo que:

- esté dañada;
- sea técnicamente inutilizable;
- no corresponda a la nota;
- exista una restricción legal o editorial evidente;
- contenga manipulación informativa incompatible con este protocolo.

## Distinción obligatoria: imagen encontrada ≠ imagen aprobada

El descubrimiento de una imagen nunca equivale a autorización para utilizarla.

Cada candidata visual debe recorrer estados separados:

1. `DISCOVERED` — la imagen fue localizada.
2. `SOURCE_IDENTIFIED` — se identificó su fuente original o proveedor.
3. `RIGHTS_CHECK_PENDING` — todavía no se determina si OPMX puede utilizarla.
4. `USAGE_APPROVED` — procedencia y condición de uso permiten incorporarla.
5. `TECHNICALLY_READY` — ya fue preparada técnicamente sin alterar su contenido.
6. `READY` — puede subirse y asignarse como imagen destacada.
7. `REJECTED` — no debe utilizarse.
8. `HUMAN_REQUIRED` — la condición de uso o procedencia requiere decisión humana.

### Regla crítica de descubrimiento

Una imagen obtenida mediante buscador, medio periodístico, agregador, red social, ficha cinematográfica o página de terceros debe iniciar como `DISCOVERED`.

No puede saltar directamente a `READY`.

### Verificación de procedencia

Antes de aprobar una candidata, intentar determinar:

- autor o fotógrafo;
- institución o propietario indicado;
- URL original;
- página donde fue localizada;
- crédito visible;
- licencia o términos aplicables;
- si la página que la muestra es la fuente original o solamente un republicador.

### Medios y agregadores

Una fotografía encontrada en un medio de comunicación no se reutiliza automáticamente.

FilmAffinity, Google Images, Bing Images, redes sociales y otros índices o agregadores pueden ayudar a descubrir material, pero no constituyen por sí solos autorización de reutilización.

### Selección entre candidatas

El sistema puede recomendar la mejor imagen periodísticamente aunque todavía no esté aprobada. Debe separar:

- `editorial_suitability`: qué tan bien representa la nota;
- `rights_status`: qué tan claro es que puede utilizarse;
- `technical_suitability`: si tiene resolución, relación y calidad suficientes.

La imagen elegida para WordPress debe superar las tres capas.

### Regla de salida

`DISCOVERED`, `SOURCE_IDENTIFIED` y `RIGHTS_CHECK_PENDING` significan únicamente que existe una candidata.

Solo `USAGE_APPROVED` puede avanzar a edición técnica.

Solo `READY` puede asignarse automáticamente como imagen destacada.

## Fotografía documental real

Toda fotografía real debe conservar su contenido informativo.

### Edición permitida — `TECHNICAL_COLOR_GRADING`

Se permiten únicamente ajustes técnicos:

- balance de blancos;
- exposición;
- contraste;
- sombras;
- altas luces;
- saturación moderada;
- corrección de dominantes;
- nitidez;
- reducción de ruido;
- corrección de horizonte;
- reencuadre;
- recorte;
- redimensionamiento;
- conversión de formato;
- compresión;
- colorimetría profesional OPMX.

### Edición prohibida — alteración de contenido

No se permite:

- agregar o retirar personas;
- cambiar rostros, expresiones, gestos o ropa;
- sustituir fondos;
- mover objetos o personas;
- borrar elementos relevantes;
- agregar documentos, multitudes, símbolos u objetos;
- combinar fotografías para aparentar un acontecimiento inexistente;
- reconstruir escenas;
- generar extensiones que alteren el contexto documental;
- modificar letreros, pantallas, documentos o cifras visibles;
- aplicar IA generativa sobre una fotografía real para cambiar su contenido.

## Regla de integridad visual

Toda fotografía real debe registrar:

```text
content_modified = false
```

Si el sistema no puede garantizarlo, debe asignar:

```text
status = HUMAN_REQUIRED
```

## Imágenes oficiales

Antes de utilizar una imagen oficial:

- registrar institución o fuente;
- conservar la URL de origen cuando exista;
- registrar crédito;
- registrar fecha de consulta;
- registrar licencia, permiso o condición de uso cuando pueda determinarse;
- no asumir que una imagen publicada por un medio de comunicación puede reutilizarse libremente;
- preferir Presidencia, secretarías, Senado, Cámara de Diputados, organismos internacionales y otras fuentes institucionales pertinentes.

## Mañaneras y actos públicos

Para notas derivadas de conferencias matutinas u otros actos oficiales:

- priorizar fotografías oficiales del acontecimiento;
- evitar recreaciones con IA cuando existe material documental adecuado;
- mantener el contexto real;
- aplicar únicamente edición técnica y colorimetría profesional.

## Imágenes generadas con IA

La generación está permitida cuando:

- no exista una fotografía adecuada;
- el asunto sea abstracto, técnico, jurídico, económico o conceptual;
- la imagen no pretenda documentar un hecho que no fue fotografiado;
- la generación aporte claridad editorial.

La imagen generada debe:

- registrarse como `AI_GENERATED`;
- evitar aparentar ser una fotografía documental auténtica;
- no atribuir acciones falsas a personas reales;
- no incluir logotipos o marcas sin autorización;
- mantener la identidad visual de OPMX;
- evitar texto incrustado salvo que la pieza editorial lo requiera expresamente;
- registrar el prompt y la herramienta utilizada.

## Optimización técnica

La imagen destacada debe prepararse preferentemente con:

- relación 16:9;
- formato WebP cuando sea compatible;
- JPEG cuando WebP no sea conveniente;
- resolución suficiente para portada y redes;
- compresión sin degradación visible;
- perfil de color sRGB;
- nombre de archivo SEO en minúsculas y con guiones;
- alt text descriptivo y accesible;
- crédito y procedencia registrados por separado;
- peso objetivo configurable.

## Alt text

El texto alternativo debe:

- describir lo visible;
- ser útil para accesibilidad;
- evitar keyword stuffing;
- no inventar identidades, acciones o lugares;
- no incluir crédito ni licencia.

## Estados del pipeline

- `READY`
- `READY_WITH_WARNINGS`
- `HUMAN_REQUIRED`
- `BLOCKED`

## Publicación

Una imagen puede asignarse automáticamente como destacada solo cuando:

- la procedencia esté registrada;
- el estado sea `READY` o `READY_WITH_WARNINGS`;
- `content_modified = false` para fotografía real;
- el alt text esté presente;
- el formato y dimensiones sean válidos.

`HUMAN_REQUIRED` y `BLOCKED` impiden asignación automática.

---

# 14. HTML PARA WORDPRESS

El HTML debe:

- estar limpio;
- utilizar etiquetas semánticas;
- evitar estilos innecesarios;
- no incluir comentarios internos;
- no incluir artefactos de generación;
- no contener referencias inexistentes;
- estar listo para pegarse en WordPress.

Estructura recomendada:

```html
<h1>Título SEO</h1>

<p>Subtítulo SEO</p>

<p><strong>Entradilla...</strong></p>

<h2>...</h2>
<p>...</p>

<h2>...</h2>
<p>...</p>

<h2>...</h2>
<p>...</p>
```

### Regla H1 / headline

El H1 y el `headline` del esquema deben coincidir exactamente.

### Sello institucional

Debe aparecer al final del HTML:

```html
<hr>
<p style="text-align: center; font-size: 13px;">
  <strong>OXÍGENO PURO MX</strong> |
  <a href="https://oxigenopuro.com.mx" target="_blank" rel="noopener noreferrer">oxigenopuro.com.mx</a> |
  Periodismo con enfoque en desarrollo y prosperidad compartida.
</p>
```

---

# 14A. WORDPRESS POST COMPOSITION — PLANTILLA REAL OPMX

Todas las notas se crean como una **Entrada** de WordPress (`post`).

## Estructura visual obligatoria

La composición utilizada por Oxígeno Puro MX es:

1. Título nativo de WordPress.
2. Imagen insertada al ancho completo de la columna de contenido.
3. Subtítulo.
4. Texto:
   - entradilla;
   - desarrollo con H2;
   - cierre editorial;
   - sello institucional.

## Título

El título debe enviarse al campo nativo:

```text
post_title
```

No insertar un segundo `<h1>` dentro de `post_content`.

### Regla crítica

La salida WordPress debe garantizar:

```text
content_contains_h1 = false
```

El título editorial y el SEO title pueden coincidir, pero el H1 visible debe ser administrado por la plantilla de WordPress mediante `post_title`.

## Imagen destacada e imagen dentro del contenido

Oxígeno Puro MX utiliza la misma imagen en dos posiciones:

- como imagen destacada;
- como primera imagen dentro del contenido.

La imagen debe subirse **una sola vez** a la Biblioteca de Medios.

Después debe reutilizarse el mismo identificador:

```text
featured_media = media_id
inline_image_media_id = media_id
reuse_same_media_id = true
```

No crear dos archivos multimedia duplicados.

El alt text pertenece al registro de la Biblioteca de Medios y debe ser el mismo en ambas apariciones.

## Posición y tamaño de la imagen

La imagen dentro del contenido debe aparecer:

```text
position = before_subtitle
size = full
```

Debe ocupar todo el ancho disponible de la columna o bloque de contenido.

No utilizar `alignfull` salvo que el tema de WordPress haya sido probado y se confirme que no rompe el diseño.

## Marcado de imagen recomendado

La automatización debe insertar HTML limpio y semántico:

```html
<figure class="wp-block-image size-full">
  <img src="MEDIA_URL" alt="ALT_TEXT" class="wp-image-MEDIA_ID" />
</figure>
```

No fabricar manualmente comentarios internos de Gutenberg como:

```text
<!-- wp:image ... -->
```

porque WordPress puede interpretar el bloque como inválido si el marcado serializado no coincide exactamente con lo esperado por el editor.

El `MEDIA_ID`, `MEDIA_URL` y `ALT_TEXT` se insertan después de subir la imagen.

## Subtítulo

El subtítulo aparece inmediatamente después de la imagen.

Debe ser un párrafo independiente:

```html
<p class="opmx-subtitulo">SUBTÍTULO</p>
```

No convertir el subtítulo en H2.

## Cuerpo del artículo

Después del subtítulo se inserta:

1. entradilla;
2. H2 y párrafos;
3. cierre editorial;
4. sello institucional.

El contenido no debe repetir:

- título;
- H1;
- imagen mediante una segunda carga;
- metadatos SEO visibles.

## Formato de contenido

La salida principal debe ser:

- `content_html`: HTML limpio, semántico y listo para WordPress.

La automatización utilizará `content_html` como valor de `post_content`.

No generar comentarios serializados de Gutenberg manualmente.

Opcionalmente puede conservarse un campo técnico de compatibilidad, pero no será la fuente principal de publicación.

## Estado inicial

Toda entrada generada automáticamente debe crearse inicialmente como:

```text
post_status = draft
```

## Extracto

El campo nativo `excerpt` debe recibir:

- el subtítulo; o
- un extracto específico cuando se genere uno distinto.

## Categorías y etiquetas

Deben enviarse como identificadores de WordPress cuando ya existan.

La automatización debe resolver nombre → ID antes de crear la entrada.

No crear categorías o etiquetas nuevas automáticamente sin una política explícita.

## Mapeo general

```text
post_type              → post
post_status            → draft
post_title             → título
post_content           → content_html
excerpt                → subtítulo o extracto
featured_media         → media_id
categories             → category_ids
tags                   → tag_ids
```

## Campos Rank Math

Los datos SEO deben enviarse a campos separados y no insertarse visualmente en el artículo:

```text
rank_math_title
rank_math_description
rank_math_focus_keyword
```

La implementación concreta dependerá de los metacampos expuestos por WordPress y Rank Math.

## Validaciones previas

Antes de crear el borrador:

- confirmar que `post_title` no esté vacío;
- confirmar que el contenido no tenga H1;
- confirmar que la imagen se cargó una sola vez;
- confirmar que `featured_media` y el bloque interno reutilizan el mismo `media_id`;
- confirmar que el subtítulo esté después de la imagen;
- confirmar que el estado sea `draft`;
- confirmar que no existan referencias `[1]`, `[2]` sin destino;
- confirmar que no existan URLs Markdown dentro de atributos HTML;
- confirmar que no se utilice `rel="dofollow"`;
- confirmar que los enlaces contextuales estén integrados de forma natural.

---

# 14B. SLUG, CATEGORÍAS Y ETIQUETAS — POLÍTICA VALIDADA

## Slug

La automatización debe enviar el slug editorial mediante el campo nativo:

```text
slug
```

El slug debe:

- coincidir con el enfoque editorial;
- incluir la palabra clave objetivo cuando sea natural;
- utilizar minúsculas;
- separar palabras con guiones;
- evitar artículos y palabras innecesarias;
- respetar el límite de URL definido en la configuración SEO.

Después de escribirlo, el flujo debe consultar la entrada y confirmar que WordPress guardó el slug esperado.

## Categoría

Todas las entradas deben recibir una categoría existente de WordPress.

La automatización debe:

1. recibir el nombre editorial de la categoría;
2. buscarla mediante la REST API;
3. resolver nombre o slug a `category_id`;
4. asignar el ID existente a la entrada;
5. verificar la asignación mediante lectura posterior.

La cuenta técnica validada puede asignar categorías existentes.

### Categoría Noticias

En la instalación actual de Oxígeno Puro MX:

```text
Noticias → category_id 13
```

Este valor puede utilizarse como predeterminado mientras la arquitectura editorial no defina otra categoría.

No asumir que el ID será permanente en otros entornos o instalaciones.

## Etiquetas de WordPress

Las etiquetas son opcionales.

Actualmente Oxígeno Puro MX no utiliza etiquetas de WordPress de forma operativa.

Por tanto:

- `tag_names` puede ser `[]`;
- `tag_ids` puede ser `[]`;
- no crear etiquetas automáticamente;
- no bloquear una entrada por ausencia de etiquetas;
- no confundir keywords SEO con etiquetas de WordPress;
- la palabra clave objetivo de Rank Math funciona independientemente de las etiquetas.

## Taxonomías nuevas

La automatización no debe crear categorías ni etiquetas nuevas sin una política explícita y revisión humana.

## Permisos de la cuenta técnica

La cuenta Autor utilizada en las pruebas fue capaz de:

- crear entradas propias en borrador;
- subir medios;
- actualizar alt text;
- asignar imagen destacada;
- actualizar contenido;
- escribir metadatos Rank Math expuestos a REST;
- actualizar slug;
- asignar categorías existentes.

No se comprobó ni se requiere por ahora:

- crear categorías;
- crear etiquetas;
- publicar automáticamente;
- editar entradas de otros autores;
- administrar plugins, temas o usuarios.

---

# 15. RANK MATH

El contenido editorial debe proporcionar, como mínimo:

- SEO title;
- meta description;
- focus keyword;
- secondary keywords;
- slug;
- excerpt;
- categoría;
- etiquetas.

La automatización deberá tratar estos valores como campos independientes.

No insertar información SEO como texto dentro del artículo salvo que el formato de entrega lo requiera.

### Principio

**La información SEO debe existir como datos estructurados, además de mostrarse en la salida humana.**

---

# 15A. RANK MATH REST BRIDGE — INTEGRACIÓN VALIDADA

La instalación de WordPress de Oxígeno Puro MX requiere exponer explícitamente a la REST API los metacampos principales de Rank Math.

## Metacampos validados

```text
rank_math_title
rank_math_description
rank_math_focus_keyword
```

## Registro requerido

Los campos deben registrarse para el tipo de contenido `post` con:

- `type = string`;
- `single = true`;
- `show_in_rest = true`;
- sanitización de texto;
- autorización limitada a usuarios con capacidad `edit_posts`.

Implementación validada:

```php
add_action('init', function () {
    $meta_fields = [
        'rank_math_title',
        'rank_math_description',
        'rank_math_focus_keyword',
    ];

    foreach ($meta_fields as $meta_key) {
        register_post_meta('post', $meta_key, [
            'type'              => 'string',
            'single'            => true,
            'show_in_rest'      => true,
            'sanitize_callback' => 'sanitize_text_field',
            'auth_callback'     => function () {
                return current_user_can('edit_posts');
            },
        ]);
    }
});
```

## Escritura REST

La automatización debe enviar los datos dentro del objeto `meta`:

```json
{
  "meta": {
    "rank_math_title": "TÍTULO SEO",
    "rank_math_description": "METADESCRIPCIÓN",
    "rank_math_focus_keyword": "PALABRA CLAVE OBJETIVO"
  }
}
```

## Validación obligatoria

Después de escribir los campos, el flujo debe:

1. volver a consultar la entrada con `context=edit`;
2. confirmar que los tres valores fueron almacenados;
3. marcar `meta_write_status = READY`;
4. mantener la entrada como `draft`;
5. solicitar revisión humana en WordPress antes de publicar.

## Resultado de prueba

La integración fue validada en una entrada real de WordPress:

- Rank Math mostró correctamente el título SEO;
- mostró correctamente la metadescripción;
- reconoció la palabra clave objetivo;
- la escritura se realizó mediante n8n y la REST API.

## Regla de seguridad

La automatización debe utilizar una cuenta técnica con permisos mínimos suficientes.

No utilizar una cuenta Administrador para operación permanente cuando una cuenta Autor o Editor resulte suficiente.

---

# 16. SCHEMA / JSON-LD

Cuando el módulo Schema esté activo, utilizar `NewsArticle`.

Plantilla base:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  "headline": "[Título SEO exacto, idéntico al H1]",
  "description": "[Metadescripción]",
  "datePublished": "[AAAA-MM-DDTHH:MM:SS-06:00]",
  "dateModified": "[AAAA-MM-DDTHH:MM:SS-06:00]",
  "inLanguage": "es-MX",
  "articleSection": "[Sección]",
  "keywords": "[palabras clave separadas por comas]",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://oxigenopuro.com.mx/[slug]"
  },
  "author": {
    "@type": "Organization",
    "name": "Oxígeno Puro MX"
  },
  "publisher": {
    "@type": "NewsMediaOrganization",
    "name": "Oxígeno Puro MX",
    "url": "https://oxigenopuro.com.mx"
  },
  "about": []
}
</script>
```

### Regla crítica

El campo:

`headline`

debe coincidir exactamente con:

`<h1>`

### Compatibilidad con Rank Math

Si WordPress/Rank Math ya genera automáticamente el Schema correspondiente, evitar duplicarlo dentro del contenido.

El JSON-LD puede conservarse como objeto de validación o salida técnica.

No generar dos esquemas equivalentes sin una razón técnica.

---

# 17. MÓDULOS OPCIONALES

Los siguientes módulos están desactivados por defecto y pueden activarse bajo petición o mediante configuración externa.

## FAQ

Cuatro preguntas frecuentes:

- H3;
- respuestas de 2 a 3 líneas;
- JSON-LD FAQPage cuando sea apropiado y compatible con las políticas vigentes.

## Mapa de enlazado interno

Tres anclas sugeridas hacia:

- notas previas;
- categorías;
- contenidos relacionados.

## Entidades semánticas

Lista de:

- personas;
- instituciones;
- organismos;
- conceptos;
- lugares relevantes.

Objetivo:

reforzar contexto y autoridad temática sin introducir entidades irrelevantes.

## Redes sociales

Generar textos específicos para:

- Facebook;
- Instagram;
- X;
- LinkedIn;
- Telegram;
- TikTok;
- YouTube.

Solo activar cuando el flujo lo solicite.

---

# 18. CONTROL DE CALIDAD

Antes de entregar, verificar:

| Criterio | Estado |
|---|---|
| Título SEO con palabra clave ≤ 60 caracteres | |
| Subtítulo SEO ≤ 160 caracteres | |
| Entradilla de 100–120 palabras | |
| Palabra clave al inicio de la entradilla | |
| Palabra clave en al menos un H2 | |
| Densidad dentro del objetivo o desviación justificada | |
| Slug con palabra clave | |
| URL completa preferentemente ≤ 75 caracteres | |
| Mínimo 5 enlaces externos cuando existan fuentes pertinentes | |
| Enlaces externos verificables | |
| Bloque de palabras clave | |
| Extensión 850–1,050 palabras, salvo excepción justificada | |
| HTML limpio y listo para WordPress | |
| H1 idéntico a headline | |
| Schema NewsArticle válido cuando esté activo | |
| Alt text de imagen destacada | |
| Sello institucional al final | |
| Nombres, cargos y fechas verificados | |
| Cifras centrales contrastadas | |
| Discrepancias identificadas | |
| Ausencia de artefactos de generación | |
| Revisión de canibalización SEO | |

### Estados permitidos

- `PASS` — cumple.
- `WARNING` — desviación menor que no compromete la calidad.
- `FAIL` — incumplimiento que requiere corrección.
- `BLOCKED` — no puede continuar por falta de información o discrepancia crítica.

---

# 19. REGLA DE DETENCIÓN

El sistema debe detener el proceso y solicitar intervención humana cuando:

- exista una discrepancia crítica;
- no pueda verificarse un dato central;
- exista riesgo significativo de difamación;
- haya contradicciones relevantes entre fuentes;
- la fuente sea insuficiente para sostener la afirmación principal;
- el contenido solicitado implique presentar como hecho algo que no puede comprobarse.

### Nunca completar silenciosamente una ausencia de información.

---

# 20. ARTEFACTOS PROHIBIDOS

No dejar en el resultado:

- `[1]`, `[2]`, `[3]` sin destino;
- `#ref1`;
- marcadores internos;
- comentarios de razonamiento;
- instrucciones del sistema;
- referencias ficticias;
- URLs inventadas;
- texto como "según el prompt";
- texto como "como modelo de IA";
- campos sin resolver;
- placeholders como `[NOMBRE]`;
- HTML roto;
- JSON inválido.

---

# 21. BLOQUE DE PALABRAS CLAVE

Incluir siempre un bloque de copiado rápido:

```text
palabra clave objetivo, secundaria uno, secundaria dos, secundaria tres, secundaria cuatro, secundaria cinco, secundaria seis, secundaria siete
```

Reglas:

- palabra clave objetivo en primera posición;
- secundarias después;
- todas separadas por comas;
- sin hashtags;
- sin viñetas.

---

# 22. FORMATO DE ENTREGA HUMANA

Cuando se solicite la entrega completa, utilizar este orden:

## 1. NOTA DE VERIFICACIÓN PREVIA

Solo cuando exista:

- discrepancia;
- dato no verificable;
- advertencia relevante;
- posible canibalización.

## 2. VERSIÓN EN TEXTO LIMPIO

Incluir:

- título;
- subtítulo;
- entradilla;
- desarrollo;
- cierre.

## 3. BLOQUE SEO

Incluir:

- metadescripción;
- palabra clave objetivo;
- palabras clave secundarias;
- bloque de copiado;
- slug;
- conteo de caracteres;
- categoría;
- etiquetas;
- imagen destacada;
- alt text.

## 4. CÓDIGO HTML PARA WORDPRESS

HTML completo.

## 5. JSON-LD

Solo cuando el módulo Schema esté activo.

## 6. CHECKLIST

Tabla de verificación.

## 7. OBSERVACIONES

Solo si existen advertencias editoriales, SEO o de verificación.

---

# 23. SALIDA ESTRUCTURADA PARA AUTOMATIZACIÓN

Cuando el proceso sea ejecutado dentro de una automatización, la información deberá poder representarse en campos independientes.

La salida estructurada deberá contemplar como mínimo:

```text
source
verification
article
seo
wordpress
image
schema
quality_control
protocol
```

### Identificación del protocolo

Toda salida automatizada debe registrar:

```text
protocol_name: "PROTOCOLO EDITORIAL MAESTRO — OXÍGENO PURO MX"
protocol_version: "4.2"
protocol_id: "OPMX-4.2"
```

La versión utilizada debe conservarse junto con el resultado generado.

---

# 24. PRINCIPIO DE COMPATIBILIDAD FUTURA

Este protocolo puede modificarse sin necesidad de reconstruir la automatización.

Las reglas editoriales deben permanecer separadas de:

- credenciales;
- APIs;
- URLs de servicios;
- configuración de n8n;
- configuración de WordPress;
- claves secretas;
- parámetros técnicos específicos.

Los parámetros numéricos y configuraciones que cambien con frecuencia podrán trasladarse posteriormente a un archivo independiente de configuración SEO.

La automatización deberá leer siempre la versión vigente del protocolo.

---

# 25. EVOLUCIÓN DEL PROTOCOLO

Toda modificación importante deberá incrementar la versión.

Ejemplo:

- `OPMX-3.0` — versión inicial preparada para automatización.
- `OPMX-3.1` — soporte formal para múltiples tipos y paquetes de fuentes.
- `OPMX-3.2` — política editorial específica para Rank Math, densidad 1–1.5 % y pruebas condicionales de título.
- `OPMX-4.0` — consolida la integración real con WordPress: slug, categoría obligatoria, etiquetas opcionales y permisos validados de la cuenta Autor.
- `OPMX-4.1` — incorpora normalización obligatoria de URLs, resolución de redirecciones, canonical y limpieza segura de tracking.
- `OPMX-4.2` — consolida la ingestión multifuente en n8n: URLs y documentos múltiples, texto directo, imagen única, paquetes vacíos y editorial_dossier.

No sobrescribir versiones históricas.

La versión utilizada para cada nota debe poder identificarse posteriormente.

---

# 26. REGLA FINAL

El objetivo del protocolo no es producir textos que simplemente "cumplan SEO".

El objetivo es producir **periodismo digital verificable, útil, claro y competitivo en buscadores**, manteniendo la identidad editorial de Oxígeno Puro MX.

**La optimización SEO nunca debe superar a la calidad periodística.**

**La automatización debe acelerar el trabajo editorial, no sustituir el criterio editorial en casos que requieran intervención humana.**
