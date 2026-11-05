# OPURO · Exclusión de portada por categoría — candidato de integración

**Estado:** diseño técnico comprobable, NO activado en n8n. **Origen**: WordPress Core 0.4.0 y endpoint REST real, consultado 5 noviembre 2026. ISSUE #13, PR #14.

## Capacidades verificadas

WordPress expone el campo REST `meta.oxpuro_excluded_category_ids` de tipo `array<string>`, patrón `^[0-9]+$` y `default: []`. El control `meta.oxpuro_exclude_home` es **independiente**.

Las portadas devuelven tres posiciones principales, cuatro destacadas y listado `items`, cuyo archivo se pagina mediante `?page=N`. El flujo n8n Publisher automático activo (ID `4o7K5TmKc7joScqB`, 91 nodos, versión `c29101d9-afaa-45b9-990e-1047ce2a19a9`) escribe Gutenberg, autor, categoría, SEO, medios y otros metadatos, pero todavía NO el campo de exclusión por categoría.

## Reglas de entrada internas, hasta aprobar una ampliación del MASTER

El MASTER canónico 1.4.1 NO contiene este control. Por tanto, el adaptador aislado acepta `excludedCategoryIds` sólo desde una capa de configuración editorial explícita y validada, no lee campos arbitrarios en paquetes Telegram/MASTER y no modifica la salida oficial.

- `undefined`: no hacer cambios en este metadato ni borrar exclusiones antiguas.
- `[]` enviado explícitamente por operador autorizado: limpiar todas las exclusiones.
- `['12','35']`: aceptar sólo cadenas numéricas positivas sin ceros iniciales ni duplicados, presentes en el conjunto de categorías que **el CMS confirmó asignadas al post**.
- No aceptar IDs obtenidos por coincidencia parcial de nombres o por inferencia; no convertir silenciosamente números ni hacer búsquedas que cambien categorías.
- `oxpuro_exclude_home` jamás debe modificarse como consecuencia secundaria.

## Punto de integración candidato

1. Tras resolver la categoría en WordPress, leer IDs asignados y la selección explícita autorizada.
2. Ejecutar `categoryPlacementMeta({excludedCategoryIds, assignedCategoryIds})` **antes de cualquier escritura**. Si está ausente, devolver `{}` y no incorporar el meta al JSON del POST.
3. Crear / modificar artículo conservando el contrato Gutenberg y el guard actual. Si la selección fue explícita, incluir el meta validado en el body de WordPress.
4. Leer el post en `context=edit`, después de la escritura, y exigir que `verifyCategoryPlacementReadback` devuelva true. Un fallo deja la publicación detenida para conciliación; no reintentar POST de creación bajo otro request_id.
5. Inspeccionar página categoría y archivo público para comprobar posición; no inferir éxito por HTTP 200 del POST.
6. Antes de modificar n8n: exportar versión activa sanitizada, duplicar workflow en ambiente inactivo, realizar pruebas con fixtures y confirmar rollback por ID de versión.

## Matriz mínima de QA

| Caso | Esperado |
|---|---|
| Campo omitido | Ninguna escritura al meta |
| Array vacío explícito | Escritura de `[]` y readback `[]` |
| ID de categoría asignada | Exclusión sólo de su portada principal; nota accesible |
| ID ajeno a categorías asignadas | Bloqueo antes de escritura |
| Duplicado, número, negativo o cadena malformada | Bloqueo antes de escritura |
| Readback incompleto o incoherente | Bloqueo y conciliación |
| Paquete anterior sin el nuevo control | Comportamiento previo intacto |
| Cambio de categoría / slug | Revalidación dirigida; conservar histórico y semántica |

## Dependencias y reversión

No modificar el workflow de 91 nodos hasta probar su copia completa. Si falla en staging, apagar el candidato y mantener el publicado exactamente como estaba; no borrar la metadata editorial registrada en WordPress. No usar una versión antigua de `main` como snapshot del n8n activo.

Pendientes: decisión formal de ubicación del campo opcional dentro del MASTER versionado, comprobación de autorización de escritura en staging, integración de workflow y revalidación real con HMAC. No se han creado ni publicado notas de prueba en producción.
