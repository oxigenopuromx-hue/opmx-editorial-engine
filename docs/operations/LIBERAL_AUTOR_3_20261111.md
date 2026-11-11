# El Liberal — autor editorial 3 — 11nov2026

Estado: ACTIVADO Y COMPROBADO.

## Comportamiento
Publisher autentica con elm_publisher, ID2, y envía author=3 (Redacción El Liberal MX) al crear notas nuevas. La asignación ocurre en el POST inicial; no requiere publicar como2 y transferir después. El readback existente compara el autor devuelto con canonical.author_liberal.id y rechaza discrepancias. OPURO y OPOL conservan sus configuraciones.

## Permiso aprobado
El usuario autorizó expresamente edit_others_posts para el usuario2. Se aplicó sólo esa capacidad mediante administración de WordPress, conservando el rol author. La lectura autenticada34209 confirmó ID2, roles=[author], edit_others_posts=true y ausencia de manage_options/edit_users. No se cambió contraseña, credencial ni rol a editor/administrador. El código de mantenimiento se retiró inmediatamente y el plugin editorial quedó restaurado a su contenido original de6243 caracteres. No se modificó la base mediante phpMyAdmin.

## Prueba real
- Ejecución34210: POST autenticado con la credencial existente del usuario2 devolvió201, ID377, author=3, status=draft, slug=qa-publisher-autor3-20261111-confirmacion.
- Lectura independiente34211:200, mismo ID/slug/estado y author=3.
- La interfaz WordPress mostró Cambiar autor: Redacción El Liberal MX y estado Borrador.
- El administrador movió exclusivamente377 a papelera; WordPress confirmó1 entrada movida. No se publicó la prueba ni se modificaron notas históricas.

## Versiones activas
| Flujo | Versión activa | Huella |
| --- | --- | --- |
| Shared4o7K5TmKc7joScqB | c7610e14-994b-45bd-8748-bdef90e0fc78 | 623efab2bcf508878ec71e5f370b3ea24c3b6571dd1b777ae913f2e54009ded7 |
| FormMt7ts2EGPbyaTC2o | bf4cc77c-6853-4303-a25b-2f58dc057d8e | b3e09e66d95ef214accc079df6fd552509f21a3afc1a3d200f5d84250ce70e82 |

Cada versión cambia exclusivamente author_liberal.id y su etiqueta de origen en el normalizador. Los otros nodos y conexiones coinciden con sus versiones anteriores. Las operaciones exactas están en LIBERAL_AUTOR_3_RELEASE_20261111.json.

Guard activo: opmx-guard-liberal-author3.zip, SHA2566fd89065fd675f0836847a6bbe1daf9a045e8d7c3ce5fe4859d859420a32e5f1. Sólo se actualizaron las dos entradas del manifiesto de versiones auditadas; se conservó el resto del paquete desplegado. Hostinger mostró Se ha completado / Actual.

Observación independiente34236: RUNTIME_OBSERVED, versionsMatch=true y noActiveN8nWriters=true para los cinco escritores. Se preservan MCP, lectores, UPDATE, Motor y suscripción existentes.

## Validación y limpieza
Ocho ejecuciones de los normalizadores activos, con LIBERAL/OPURO/OPOL/TODOS, confirman que sólo cambia el autor Liberal. Los16 casos de contrato de versiones pasaron y las auditorías de los dos grafos pasaron. No se sustituyó esta evidencia por una publicación pública de prueba.

Diagnóstico7IDUF9PeHQ5v331Z restaurado al GET original de tres nodos, inactivo, sin retención manual ni de resultados. Se conservaron los borradores de edición previos de los flujos productivos; se publicaron las versiones candidatas inmutables verificadas.

Este cambio resuelve la autoría futura de El Liberal. No implica cerrar los criterios generales pendientes del issue18.
