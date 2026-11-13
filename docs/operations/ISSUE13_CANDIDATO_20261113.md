# Issue13 — compatibilidad de portada por categoría OPURO

Estado: fuente preparada; no se modificó producción desde este subtrabajo. El despliegue coordinado corresponde a la instancia principal después del18. Se leyó el índice compartido vigente y se consultaron preferencias n8n: ninguna guardada.

## Corte final D045: aprobado para release, no afirma despliegue

Este corte sustituye el diseño inicial descrito abajo cuando se refiere a autoridad o a un ZIP de tres archivos. La configuración no queda autorizada por un MASTER. `/opciones portada OPURO 30,61`, `ninguna` (`[]`) y `conservar` (retirar la orden sin tocar metadata) se acreditan por identidad y sesión del receptor y se guardan en una tabla operativa separada, sin convertirlas en fuentes. Guard liga orden, ciclo, revisión, actor y request_id completos. El lector expone una proyección estructurada fuera de las fuentes para el Motor; los gates Shared/MCP consultan Guard incluso con campo omitido. Un control activo omitido, una lista distinta o una autoridad fabricada bloquean antes de aceptar/escribir. UPDATE revalida también los subdestinos de TODOS antes del claim. La ausencia sin historial conserva el flujo histórico.

La integración final aplica doce deltas explícitos sobre los84 archivos del release18, preservando75 bytes a byte y agregando tres dependencias. Los cinco pins están ligados a versiones reales guardadas y la copia local21 conserva prepare/normalize y sus hashes exactos. Los drafts ajenos se preservan. El apéndice Motor está en `ISSUE13_MOTOR_APPEND_20261113.txt`; conserva la suscripción y los pins de chooseMotorPolicy.

QA final nativo:230/230 pruebas dirigidas de autoridad, integración HTTP, comandos, gates, inventario, metadata, UPDATE, preflight21, frontend y cierre atómico18. Revisión independiente del ZIP:87archivos,288imports relativos resueltos,86fuentes JS con sintaxis válida y cinco pins exactos. Startup CJS síncrono:19rutas sin autenticación401 y las mismas19 con DB no disponible503, sin I/O externo. REST38092 comprobó sólo un borrador desechable y lo envió a papelera. Público38192 pasó sus lecturas. No se publicó ni editó una nota real para probar este cambio.

El arnés que intentó ejecutar el store Node dentro de Code n8n no es una prueba aceptada: ese sandbox oculta los prototipos nativos. Se mantuvo intacta la validación de producción y el store se comprobó en Node nativo. Los Code que sí corren en n8n se prueban por separado con sus fuentes exactas, sin shims. El límite de observación de HMAC se documenta en `ISSUE13_HMAC_LIMITE_20261113.md`; no se afirma una invalidación200 que no fue observada.

## Causa y contrato

El Shared publicado4263fea4-90a4-406d-a234-da7397d456bf no transporta `oxpuro_excluded_category_ids` en la creación ni lo comprueba en readback. El MASTER1.4.2 no define un campo de entrada equivalente. El formulario tiene otro normalizador y los cuatro verificadores de publicación en Form/MCP omiten esta metadata en su snapshot. El UPDATE existente no comprueba que metadatos omitidos se preserven después de una escritura.

Se propone `contracts/OPURO_CATEGORY_HOME_v1.0.json`, extensión **opcional** de EDITORIAL1.4.2 y LITERAL1.0. El manifiesto resuelve la extensión para ambos perfiles conservando sus rutas/versiones y todos los required existentes. PUBLICACION admite propiedades adicionales en ambos contratos base; los normalizadores reales Shared/Form y la copia estática21 se ejercitaron con la extensión. No se modifica la familia maestra1.4.2 ni la igualdad textual LITERAL.

Campo: `PUBLICACION.OPURO.EXCLUIR_PORTADA_CATEGORIAS_IDS`. Ausencia omite la clave REST y conserva comportamiento/huella anteriores. `[]` explícito vacía el array. `['30']` declara una sustitución completa. Rechaza números, ceros, signo, blancos, decimales, ceros iniciales, duplicados, IDs no seguros y destinos sin OPURO. Los IDs deben pertenecer a las categorías finales asignadas a la nota. CREATE sólo asigna una categoría OPURO: no se infieren antecesores ni se amplía la taxonomía para satisfacer la configuración. `oxpuro_exclude_home` permanece independiente.

## Implementación preparada

- Helpers puros `tools/editorial/opuro-category-home.mjs`: sintaxis, declaración opcional, pertenencia y readback; no autentican ni escriben.
- Shared: normalizador conserva la declaración en canonical/fingerprint; tres nodos opcionales IF/GET/Code comprueban categoría antes de reservar/subir medios; resolver posterior vuelve a comprobar pertenencia; body REST incluye la clave sólo si está declarada; readback exige array exacto de cadenas y pertenencia.
- Form/MCP: cuatro copias de `editorialSnapshot` conservan/comprueban tanto exclusiones por categoría como la bandera de portada general al pasar draft→publish. El normalizador de Form comparte la validación opcional.
- MCP21: refresco incremental del Code **existente**, con prepare/normalizer y pin nuevo exactos. Exige propietario Shared fijo, fuentes locales y orden prepare→normalizer, ambas copias anteriores exactas, pin anterior workflow/version/dosSHA, prepare sin cambios y normalizador nuevo exactamente igual a la transformación prevista. No admite otro workflow ni código nuevo de red.
- UPDATE Guard: antes de consumir claim valida IDs explícitos o exclusiones preservadas cuando se cambian categorías; rechaza que queden huérfanas y nunca las limpia automáticamente. Una edición que omite categorías+exclusiones conserva metadata existente sin imponer una nueva revisión de contenido antiguo. Después de escribir comprueba que la metadata omitida y la bandera global sobrevivan. Un readback incierto no permite repetir.

Builders: `receiver/build-category-home-operations.mjs`, con `categoryHomeBase`, `buildCategoryHomeSharedOperations`, `buildCategoryHomePublicationOperations` y `buildCategoryHomeMcpStaticOperations`. Los inputs deben ser grafos **publicados** y su versionId activo, nunca el draft ajeno. Releer después del18 y producir un baseline nuevo si corresponde. La versión Shared nueva debe ser la real e inmutable antes de generar el pin MCP; no desplegar el marcador usado por pruebas.

Guard debe incluir el archivo nuevo `tools/editorial/opuro-category-home.mjs` además de `update-executor.mjs`. No basta cambiar el manifiesto de versiones del escritor. Conservar los cambios18/21/24, autor3, LITERAL, suscripción y el único Motor.

## QA comprobada

123 pruebas dirigidas PASS en `issue13-targeted-final.log`: helpers, siete combinaciones Shared/Form sin campo, LITERAL con campo independiente, lectura/pertenencia, body REST omitido/[]/IDs, snapshots, refresh21 y defensas de deriva, UPDATE antes de claim y preservación, runners QA y fuente frontend. Ninguna prueba Node escribe CMS o Telegram.

Ensayo real ejecutado exclusivamente por la instancia principal: n8n38092, siete comprobaciones PASS. Fixture OPURO10533, slug `qa13-226004193e90`, categoría30 Política confirmada por GET. OPTIONS acredita array de cadenas; default[], escritura['30'], actualización de extracto/otra metadata sin exclusiones conserva['30'], [] explícito vacía y bandera globaltrue se mantiene. Limpieza a papelera, cero publicaciones/notas reales modificadas. Evidencia técnica local: `task13-real-qa-evidence.json`. El probe quedó restaurado a tres nodos, inactivo/sin retención, versión9f1787c2-0a92-4fda-8d2a-05383e77c386.

El runner REST y el builder de19nodos están en `tools/editorial/opuro-category-home-rest-qa.mjs` y `receiver/build-category-home-rest-qa-operations.mjs`. Reutilizan la credencial existente; no reintentan escrituras inciertas ni adivinan IDs. Toda mutación comprueba slug/ID/título/draft; limpieza `DELETE ?force=false`, nunca borrado permanente.

### Compatibilidad frontend de la fuente realmente desplegada

Vercel GET de `oxigenopuro.com.mx`: deployment `dpl_DB3zKHasZ5QzkjcnoeBf6azEAsz5`, production READY, commit `bf94246d2f823056c3644e4d951507ad06d45783`, rama `feat/identidad-hidalgo-20261107`. Main del frontend está atrasado y no se usó como sustituto de producción.

Se retuvieron archivos de esa referencia inmutable en `receiver/fixtures/frontend-category-home-bf94246.mjs`, comprobados byte a byte contra sus SHA Git. Ocho pruebas ejecutan funciones TypeScript reales de getCategoryHome/fromWordPress/storyUrl/archivePage/cacheTags/paginación en VM, con transporte inyectado y sin modificar su lógica. Verifican siete posiciones recibidas del CMS, permanencia de la entrada en el listado inferior, página2, URL por slug, querypage y caché por categoría60s.

Fuentes exactas: client952adbe46228a8d43fe1ca47189e05aec3bc7cb1; content0f3ebc87832498a0053e799e23a34c65bffde1ab; CategoryLandingf65d3d71c100a7bb3b3b11da9a4b935ea830831a; Core editorial65e79e4f7795d79c045906fec57a62fc06bc51b8; Core API739ece956b17e087062e4572c0f638dfaa3160dd; plugin revalidación76918c88c99329bd0d6090c2588e10629adc8c7a.

Core sólo filtra exclusiones en las siete posiciones; la consulta inferior, búsqueda y acceso por slug permanecen independientes. CategoryLanding muestra las posiciones sólo en page1 y devuelve404 para página>1 sin items. Client consume `/categories/{slug}/home?page=N`, tag `oxpuro:category:{slug}`, TTL60s. El plugin escucha la misma clave de metadata para notificar revalidación.

No se ejecutó PHP/WordPress local ni React/DOM: esos runtimes no están instalados. Las comprobaciones PHP/JSX en esta batería son inspección de fuente, no ejecución de los hooks ni render real. La lectura pública desde web retrieval devolvió inaccesible; se preparó el builder de siete GET AUTHNONE `receiver/build-category-home-public-qa-operations.mjs` para que la instancia principal obtenga HTTP/IDs desde el probe. Sólo devuelve resumen y no headers/HTML. Esta observación pendiente no se marca como realizada aquí.

Actualización QA38098: ambos endpoints de categoría devolvieron200,3hero/4featured/20items sin repeticiones,164entradas/nuevepáginas. La búsqueda fija Tecámac no encontró el slug elegido y `stories/slug/samuel-hernandez-observaciones-asf-tecamac` devolvió404. Las rutas sí coinciden con el client.ts real; ese404 no se interpretó como una variante de URL ni como prueba de que el post no exista en WordPress. No se alteró la nota para conseguir un PASS.

Los tres GET del frontend devolvieron200, pero el primer formatter buscaba HTML en body. Inspección acotada de38098 confirmó que HTTPtext retorna data: Portada categoría contiene HTML real de141668caracteres, H1Política y hero-grid. Se corrigió exclusivamente el QA: usa data para respuestas text, conserva body para JSON y selecciona una nota válida desde items/hero de la propia categoría recibida, comprobando ID/slug/título antes de consultar búsqueda/bySlug/ruta individual. Búsqueda usa el título devuelto y la URL pública deriva del slug real. El builder ahora añade siete GET y dos Code; sus tres pruebas pasan. La elección nueva acredita compatibilidad general de rutas, no resuelve ni oculta la disponibilidad específica del slugSamuel.

### Caché y límites

No se acreditó un200 firmado WordPress→Vercel. El plugin sólo encola cambios de metadatos de posts públicos, por lo que el ensayo draft10533 no podía generarlo. Runtime logs de Vercel del deploy actual, ventana13nov01:43:52–02:13:52UTC, queryrevalidate: sin registros. La ventana24h fue rechazada por retención; no se interpretó como fallo del webhook. No se leyeron valores de secretos. `hmacInvalidationObserved=false`: riesgo externo previo listado en13/PRfrontend17, distinto de la compatibilidad de metadata. El cliente productivo conserva TTL60s; no se promete invalidación inmediata ni se publica fixture para intentar acreditarla.

## Regresiones previas de la batería amplia

El glob general ejecutó1272 casos:1264PASS/8FAIL. Las ocho fallas se reprodujeron idénticas en el baselineedb20e7 sin este parche; no se cambiaron para maquillar el resultado:

- category-validation.test.mjs:6 exige prompt4.9, manifest contiene4.10.
- audit-historical-seal.test.mjs:7 requiere OPMX_AUDIT_PACKAGE_STORE no configurado.
- final-publication-http.test.mjs:5, literal-http.test.mjs:5 y unwritten-freeze-http.test.mjs:4 esperan200 con hooks ausentes en sus fixtures:404.
- motor-runtime-services.test.mjs:3 y recovery-runtime-services.test.mjs:5 esperan dos/cuatro schemas, baseline crea tres/cinco.
- receiver/build-publisher-submission-operations.test.mjs importa fixtures/mcp-files-reader-protocol.mjs inexistente.

Logs locales issue13-tests.log e issue13-baseline-tests.log. El total amplio corresponde al corte anterior a añadir las pruebas finales, no al total de123 dirigidas.

## Activación y reversión

1. Releer los grafos publicados y preservar drafts ajenos; producir operaciones sobre Shared/Form/MCP reales. Confirmar que el18 no cambió las anclas, o rebasar.
2. Preparar Shared y capturar su versionId; generar la copia estática21 exacta y los snapshots Form/MCP; actualizar el manifiesto Guard coordinadamente con los cinco escritores previstos.
3. Ensamblar Guard desde la fuente vigente después del18 incluyendo el helper nuevo, ejecutar pruebas de arranque/denegación y comparar delta completo.
4. La instancia principal activa coordinadamente y observa runtime/versiones; conserva autor3/LITERAL/async24 y el Motor. Actualiza este candidato, índice compartido e issue con hashes/versiones efectivos. El status de la extensión pasa a ACTIVE sólo entonces.
5. Reversión: restaurar conjuntamente parámetros/versiones anteriores Shared/Form/MCP y Guard compatible, preservando metadatos/recibos. No borrar decisiones existentes ni publicar notas para comprobar.
