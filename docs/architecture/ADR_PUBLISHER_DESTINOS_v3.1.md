# Publisher integrado — OPURO, OPOL y LIBERAL v3.1

Fecha: 2026-11-05. Despliegue: ACTIVO en los cuatro workflows; versiones en el registro de release. Estado: DEFINIDO por instrucción expresa de OPMx. Esta decisión sustituye el receptor WordPress separado propuesto para El Liberal MX.

## Base verificada

La referencia vigente es OXígeno Puro: repositorio `oxigeno-puro-com-mx`, rama de producción `feat/portadas-categoria-cache`, commit `8acd8bff524e329dadf14e645559d0f99c3a5eeb`. Se contrastaron README, WORDPRESS.md, cliente WordPress, renderer Gutenberg y registro de campos/API del módulo Core. `main` no representa su producción actual.

El Publisher escribe mediante `/wp-json/wp/v2/posts`, `media`, `categories` y `tags`, con Gutenberg serializado, Rank Math, Hero separado y lectura autenticada posterior. Las rutas `oxpuro/v1` son lectura del frontend; no sustituyen la escritura REST nativa. El Liberal usa el módulo de campos ya instalado y REST nativa; no requiere instalar el plugin receptor descartado.

También se leyeron el handoff, instrucciones de proyecto, contrato Gutenberg enriquecido, contrato de rendering, estado operativo del Publisher/Telegram, workflows activos y código real instalado del guard. El runtime activo incluía cambios fuera de `main` y diferencias respecto al PR #9: se preservaron los cambios de remitente, notificaciones y almacenamiento multiusuario de Telegram.

## Contrato de selección

| Entrada | Destinos |
| --- | --- |
| OPURO | OXígeno Puro |
| OPOL | OXígeno Político |
| LIBERAL | El Liberal MX |
| AMBOS | OPURO y OPOL, permanentemente |
| TODOS | Todos los destinos registrados; actualmente OPURO, OPOL y LIBERAL |
| OPURO,LIBERAL | OPURO y LIBERAL |
| OPOL,LIBERAL | OPOL y LIBERAL |

Se normalizan espacios y mayúsculas, se eliminan duplicados y se aplica orden estable de registro. Una etiqueta desconocida o un elemento vacío entre comas rechaza toda la solicitud antes de escribir. No se acepta parcialmente la porción válida. `AMBOS,LIBERAL` equivale a TODOS; `OPOL,OPURO` equivale a AMBOS.

`tools/mcp-publisher/destinations.mjs` centraliza aliases, registro y nombres de resultados. Un futuro sitio exige registrar su CMS, credencial, campos, autor y rama nativa, ampliar la admisión del guard y sus pruebas; nunca reinterpretar AMBOS ni deducir dominios de texto enviado por el Motor.

## Implementación

Se modifican los workflows existentes, conservando IDs y rutas: automático `4o7K5TmKc7joScqB`, MCP `bnzVMNkZuGO1GQCZ`, formulario `Mt7ts2EGPbyaTC2o` y conciliación `C4hk6fQQomueYC8f`. No se activa el workflow receptor separado de Liberal. El formulario ahora llama al mismo hijo protegido; sus ramas antiguas desconectadas se retiran, con snapshot de rollback.

El hijo sólo acepta PUBLICAR=false. Consulta duplicados de todos los destinos seleccionados, verifica categoría LIBERAL antes de reservar y reserva el conjunto en una transacción antes de medios o entradas. Cada destino tiene avance durable de medios y entrada. Un timeout o resultado incierto nunca permite reenviar automáticamente.

La publicación lee todos los borradores seleccionados, exige vínculo request_id/slug/ID confirmado por guard, verifica Gutenberg, SEO, Hero, autor, categorías y destacada, y después cambia el estado por REST nativa. Un GET independiente confirma cada publicación. Los resultados de destinos anteriores se conservan al procesar LIBERAL. Un CMS confirmado y la visibilidad pública del frontend son estados distintos.

LIBERAL usa `cms.elliberal.mx`, su credencial existente restringida a ese dominio y autor técnico 2; nunca autor 3 heredado de OPURO. Campos: `liberalmx_hero_media_id`, `liberalmx_editorial.subtitle/photo_credit`, featured_media y tres campos Rank Math. Categorías y etiquetas se resuelven en su propio CMS. Se suben los bytes originales como adjuntos propios, sin reutilizar IDs de OPURO/OPOL.

El MASTER agrega `CATEGORIAS.LIBERAL.PRINCIPAL`, con fallback a SEO.CATEGORIA. Comparte `GUTENBERG_ENRIQUECIDO_FINAL`, Hero OPURO y destacada OPURO como artefactos originales de entrada; los nombres de esos tokens históricos no implican reutilización de IDs. Sólo los sitios seleccionados exigen sus categorías y artefactos. AUTOR_ID continúa prohibido en MASTER.

Limitación explícita: el transporte actual sólo aporta archivos Hero/destacada. Si el cuerpo enriquecido trae core/image con un ID de otro CMS, LIBERAL rechaza antes de cualquier escritura. El soporte de imágenes interiores requiere transporte y verificación de cada adjunto nativo por destino; no se copian silenciosamente IDs ajenos. Párrafos, encabezados, listas/list-item y citas siguen el contrato enriquecido.

## Compatibilidad y seguridad

La forma canónica y su huella permanecen idénticas para OPURO, OPOL y AMBOS. Se mantienen las claves de reserva `opmx:v1:DESTINO:slug` y la protección de concurrencia. Las tablas existentes admiten LIBERAL sin migración destructiva. El guard sólo añade LIBERAL y su par Hero/destacada; despliegue con el mismo package.json, configuración y módulos Telegram descargados de la aplicación instalada.

No se guardan secretos. Los snapshots del repositorio se sanitizan; las credenciales se asignan desde n8n. La conexión ChatGPT debe redescubrir tools/list para retirar el enum antiguo de su esquema cacheado: el servidor anuncia destino como string validado, con listas por comas y post_id_liberal. El formulario y el servidor n8n no dependen de que un cliente mantenga ese enum viejo.

## Validación al despliegue v3.0

- 112 pruebas Node: compatibilidad previa, parser, conjuntos, preflight, reservas, medios, publication readback, rechazos y conservación de resultados.
- Configuraciones de nodos validadas por n8n; grupos y conexiones recompuestos sin warnings al cierre.
- Guard actualizado en Hostinger: `opmx-guard-destinos-20261105.zip`, despliegue completado, SHA-256 `b3667a9d62ad93d780406d2c0e10079e3a0d0dce61323a3044c112dbbf7d902d`. Se conserva despliegue anterior para rollback.
- Ejecución manual real 5712: SUCCESS / DRAFT, sólo LIBERAL; entrada 9, Hero 7 y destacada 8. Verificados Gutenberg, categoría, etiquetas, autor, créditos y Rank Math mediante readback. Fixture privado, sin publicación pública.
- Reenvío 5713: detenido por slug existente antes de reserva/escrituras; no duplicó nota ni medios.
- MCP 5717: tools/list anuncia LIBERAL, TODOS, listas por comas y post_id_liberal; conserva herramientas Telegram.
- MCP 5718: ID ajeno/inexistente rechazado en preflight conjunto, `publicationWritesStarted=false`; no se ejecutó Publicar LIBERAL.

No se publica una nota ficticia para comprobar el último cambio de estado en producción. En esa etapa, las pruebas de publicación positiva usaron respuestas simuladas y preservación editorial exacta; la validación pública posterior se documenta a continuación.

## Rollback

Restaurar los cuatro versionId previos registrados en `docs/operations/PUBLISHER_DESTINOS_RELEASE_20261105.json` y reactivar versiones anteriores. Para el guard, restaurar el despliegue Hostinger inmediatamente anterior, sin cambiar secretos ni DB y sin borrar reservas o adjuntos inciertos. No reenviar paquetes ambiguos.

- Prueba contra versión publicada 5719: el reenvío también se detuvo antes de reserva/escrituras.
- Formulario simulado 5721: datos de entrada fijados, hijo protegido real, duplicado capturado y salida Form alcanzada (espera de visita propia de ejecución manual). No se presenta como prueba visual de envío real.

## Actualización v3.1 — piloto real de El Liberal MX

Fecha: 2026-11-05. DEFINIDO por OPMx: importar cinco notas recientes de OXígeno Puro por Política, Seguridad, Economía, Estados, Internacional, Cultura y Deportes y abrir El Liberal como piloto público. Se mantienen el contrato de destinos, los cuatro workflows existentes y sus versiones activas; no se instala el receptor descartado ni se altera Telegram.

El lote usa un importador temporal que descarga los archivos originales y llama al hijo protegido existente con CREAR_EN=LIBERAL y PUBLICAR=false. Tras la creación y guard binding, verifica borrador, conserva fechas, categorías locales, firma, SEO y créditos, y publica por REST nativa con comprobación independiente posterior. Identidades request_id estables elm_pilot_opuro_ID_20261105; una escritura ambigua nunca dispara un reintento automático.

Resultados observados: primera publicación real 6106, fuente OPURO 10063 a Liberal 13. El lote 6110 confirmó 33 publicaciones y dos fallos de conexión anteriores a cualquier escritura; se inspeccionaron las ejecuciones 6153 y 6155 antes de recuperar exclusivamente esas dos fuentes en 6276. Auditoría independiente 6288: 35 notas publicadas, cinco por cada sección solicitada, Opinión cero, SHA256 de todos los cuerpos Gutenberg coincidente con el contenido preparado, fechas originales, firma de origen y adjuntos Hero/destacada propios. Dos notas históricas adaptaron sólo nombres de clases opmx-editorial__* a editorial-*; dos fuentes sin Hero explícito usaron su destacada original como fuente del Hero propio.

La auditoría anónima 6519 confirmó HTTP 200 y HTTPS válido en portada, artículo, ocho secciones, robots y sitemaps de elliberal.mx, sin noindex. Sitemap normal: 35 artículos y 43 URLs totales; News Sitemap: 20 notas de las últimas 48 horas. www redirige 308 al dominio raíz. Se distingue el readback del CMS de esta comprobación adicional del frontend.

Los importadores qVfs5nVIWJXzOQFR y 0NQMGTxDYZOZyLFh quedaron despublicados; el permiso temporal de llamada fue retirado. El Publisher vuelve a admitir únicamente sus llamadores normales bnzVMNkZuGO1GQCZ y Mt7ts2EGPbyaTC2o. Los jobs de inventario y auditoría quedan manuales, inactivos y de sólo lectura en el proyecto personal OXÍGENO PURO, raíz.

Esta evidencia sustituye el estado anterior de validación pública pendiente para LIBERAL. No se publicó la nota ficticia. Tampoco se afirma una nueva prueba real simultánea en los tres CMS: los alias, combinaciones y compatibilidad siguen respaldados por las 112 pruebas y la validación previa del contrato; el piloto real de esta operación seleccionó sólo LIBERAL.

La limitación de imágenes interiores permanece: ninguna de las 35 piezas seleccionadas tenía core/image interior; por ello no se omitieron imágenes ni se importaron IDs ajenos. El cliente de ChatGPT puede seguir necesitando redescubrir tools/list para abandonar su enum antiguo; el backend y el importador no dependieron de ese enum.

Código del Publisher: commit 48bf07a9e8ac8cad57fba241569c40c5dc19a77d, rama feat/publisher-liberal-v3; CI 42061182423 con 112 pruebas aprobadas. Versiones, guard y rollback originales permanecen en PUBLISHER_DESTINOS_RELEASE_20261105.json. El nuevo registro PUBLISHER_PILOTO_VALIDACION_REAL_20261105.json fija las versiones activas y el cierre de los permisos temporales. No restaurar paquetes antiguos ni borrar reservas ante una publicación incierta.

Los detalles de las 35 correspondencias, importadores sanitizados, auditorías, DNS y despliegue están en el repositorio el-liberal-mx, documentación PILOTO_PUBLICO_EL_LIBERAL_MX_v1.1 y n8n/pilot-import/. El respaldo íntegro de fuentes está en Drive EL_LIBERAL_MX/09_QA_LANZAMIENTO, archivo 1EEFS3VJfTgqCvkOL6Vi0brf12htxdH5z. No contiene secretos.
