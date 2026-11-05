# OPURO · Exclusión de portada por categoría — candidato de integración

**Estado:** diseño técnico comprobable, NO activado en n8n. **Origen**: WordPress Core 0.4.0 y endpoint REST real, consultado 5 noviembre 2026. ISSUE #13, PR #14.

## Capacidades verificadas

WordPress expone el campo REST `meta.oxpuro_excluded_category_ids` de tipo `array<string>`, patrón `^[0-9]+$` y `default: []`. El control `meta.oxpuro_exclude_home` es **independiente**.

Las portadas devuelven tres posiciones principales, cuatro destacadas y listado `items`, cuyo archivo se pagina mediante `?page=N`. El flujo n8n Publisher automático activo (ID `4o7K5TmKc7joScqB`, 91 nodos, versión `c29101d9-afaa-45b9-990e-1047ce2a19a9`) escribe Gutenberg, autor, categoría, SEO, medios y otros metadatos, pero todavía NO el campo de exclusión por categoría.

## Reglas de entrada internas, hasta aprobar una ampliación del MASTER

El MASTER canónico 1.4.1 NO contiene este control. Por tanto, el adaptador aislado acepta `excludedCategoryIds` sólo desde una capa de configuración editorial explícita y validada, no lee campos arbitrarios en paquetes Telegram/MASTER y no modifica la salida oficial.

- `undefined`: no hacer cambios en este metadato ni borrar exclusiones antiguas.
- `[]` enviado explícitamente por operador autorizado: limpiar todas las exclusiones.
- `['12','35']`: aceptar sólo cadenas numéricas positivas sin ceros iniciales ni duplicados, presentes en el conjunto de categorías elegibles que **el CMS confirmó para la nota**, incluyendo categorías ascendentes de las subcategorías asignadas.
- No aceptar IDs obtenidos por coincidencia parcial de nombres o por inferencia; no convertir silenciosamente números ni hacer búsquedas que cambien categorías.
- `oxpuro_exclude_home` jamás debe modificarse como consecuencia secundaria.

## Punto de integración candidato

1. Tras resolver la categoría en WordPress, leer IDs elegibles de categorías directas y ancestras con la jerarquía del CMS y la selección explícita autorizada. No usar sólo categorías directas, porque `category_story_eligible()` admite ancestras.
2. Ejecutar `categoryPlacementMeta({excludedCategoryIds, eligibleCategoryIds})` **antes de cualquier escritura**. Si está ausente, devolver `{}` y no incorporar el meta al JSON del POST.
3. Crear / modificar artículo conservando el contrato Gutenberg y el guard actual. Si la selección fue explícita, incluir el meta validado en el body de WordPress.
4. Leer el post en `context=edit`, después de la escritura, y exigir que `verifyCategoryPlacementReadback` devuelva true. Un fallo deja la publicación detenida para conciliación; no reintentar POST de creación bajo otro request_id.
5. Inspeccionar página categoría y archivo público para comprobar posición; no inferir éxito por HTTP 200 del POST.
6. Antes de modificar n8n: exportar versión activa sanitizada, duplicar workflow en ambiente inactivo, realizar pruebas con fixtures y confirmar rollback por ID de versión.

## Matriz mínima de QA

| Caso | Esperado |
|---|---|
| Campo omitido | Ninguna escritura al meta |
| Array vacío explícito | Escritura de `[]` y readback `[]` |
| ID de categoría elegible (directa o ancestro) | Exclusión sólo de la portada de categoría indicada; nota accesible |
| ID ajeno a categorías elegibles (directas o ancestras) | Bloqueo antes de escritura |
| Duplicado, número, negativo o cadena malformada | Bloqueo antes de escritura |
| Readback incompleto o incoherente | Bloqueo y conciliación |
| Paquete anterior sin el nuevo control | Comportamiento previo intacto |
| Cambio de categoría / slug | Revalidación dirigida; conservar histórico y semántica |

## Dependencias y reversión

No modificar el workflow de 91 nodos hasta probar su copia completa. Si falla en staging, apagar el candidato y mantener el publicado exactamente como estaba; no borrar la metadata editorial registrada en WordPress. No usar una versión antigua de `main` como snapshot del n8n activo.

Pendientes: decisión formal de ubicación del campo opcional dentro del MASTER versionado, comprobación de autorización de escritura en staging, integración de workflow y revalidación real con HMAC. No se han creado ni publicado notas de prueba en producción.


## Control de procedencia editorial (candidato, 5 noviembre)

El nuevo campo no debe activarse únicamente por aparecer en un MASTER generado desde una noticia, PDF o texto de Telegram. La versión candidata del generador exige **dos entradas congruentes**:

1. `CATEGORIAS.OPURO.EXCLUIR_DE_PORTADA_IDS` como selección opcional dentro del MASTER.
2. `EDITORIAL_PLACEMENT` fuera del MASTER, en la envoltura de la petición OAuth del motor, como decisión directa del operador. Requiere `{mode:"DIRECT_OPERATOR",target:"OPURO",request_id:"...",confirmed:true,excluded_category_ids:[...]}`, con `request_id` y arreglo idénticos a los de la petición y el MASTER.

La ausencia del campo deja el flujo original intacto. Un campo editorial sin la envoltura separada se **rechaza antes de crear notas**; una envoltura sin campo, también. La normalización no utiliza el contenido documental como permiso. Se añadió prueba regresiva en `build-category-placement-candidate.test.mjs`.

**Advertencia de seguridad:** la coincidencia de campos es un control de procedencia, **no una firma criptográfica independiente**. La capa que construye `EDITORIAL_PLACEMENT` debe atestiguar de manera verificable una orden directa autenticada del operador y no copiar datos de las fuentes. Hasta que ese adaptador/guard confirme identidad, intención y autorización, el uso del control de colocación sigue bloqueado para producción, aunque el código valide.

### Archivo reproducible

GitHub Actions `Category placement candidate — isolated QA` [run #8](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/actions/runs/42001373493) completó SUCCESS para commit `688ce7b7f972fcdf4e80ab10fb7a92dea620ff9f`. El export inactivo de 92 nodos se conserva como artifact `opmx-category-placement-candidate-no-activate` (artifact ID 13402163580, SHA256 ZIP `21c0fd4a43c42fd304c6f5a1f7ac38abea399140839d9970d55fedcbf2bca538`, caduca 12 noviembre 2026). El source de 91 nodos no contiene credenciales; ni código ni workflow contienen secretos. No importar ni publicar sin pruebas y configuración aislada.
