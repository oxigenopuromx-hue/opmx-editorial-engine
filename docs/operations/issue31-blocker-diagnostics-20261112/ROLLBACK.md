# Reversión coordinada de diagnósticos31

El baseline es posterior a13/18/21/24/30. No ejecutar este procedimiento sobre cambios concurrentes sin releer versiones, huellas y borradores. Las versiones guardadas no son necesariamente las activas y los drafts ajenos nunca deben publicarse como rollback de producción.

## Baseline reproducible

| Componente | Baseline anterior a31 |
|---|---|
| Guard |[opmx-guard-category-home13.zip](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/blob/main/docs/operations/issue13-category-home-20261113/opmx-guard-category-home13.zip),212025bytes/87archivos, SHA256 `456eaaa3fb3dfc5a6a7079f20f39de81df564a322549b27b9136a10890b06f35`. |
| MCP `bnzVMNkZuGO1GQCZ` |`d4d3a75e-aec9-42ce-9439-d2ea4a931e8f`,155nodos/6grupos; hash `6a7d3438a735c0c645a086013589373c6f08192e69cfc5e956e5f0da39c96d53`. |
| Administrador `NFOBzPfHmvRjVFOA` |Baseline histórico `efa564a8-3f87-4936-ba1a-2b1a33a0879f`,16nodos; hash `9789879292297cc2de72f3bfda88c8f95b4cee8f6088dc184efd361e5b336bd7`. Su reversión requiere la condición de visibilidad indicada abajo. |
| Motor |Mismo ID `6ae9095256948191b33f1e023fbfbf8b`; prompt previo54666caracteres, SHA256 `a59f79e5ba63ddaebdb91b4aa9f1088638e95be2d2a72069e7243f1d40b34bb7`. |

Shared `bef4649d-38eb-436a-9a13-728750da6b8f`, Form `5e0e1875-2996-4b8c-99aa-e4d07f7d8822`, Reader `1eca0334-b3af-45d9-ac80-341e99a09faa`, UPDATE `d04fb5c2-ba36-48f9-9cd4-2958ab1f273e` y Receiver `09d373b0-9d71-4cf1-99bd-c830f2275e7c` no cambian por esta entrega y deben conservarse, salvo una decisión separada y documentada.

## Orden de reversión

1. Detener la entrada a nuevas ejecuciones durante la transición y comprobar writers running/waiting/new. Esperar o conciliar los que existan; no convertir un intento incierto en uno nuevo.
2. Respaldar las versiones activas y los drafts actuales. Comprobar que correspondan a `release.json` y al readback final de esta entrega. Si hay cambios posteriores, preparar un rebase en vez de sobrescribirlos.
3. Restaurar de manera coordinada el Guard13 y MCPd4d3. Sus cinco pins deben corresponder a versiones y huellas reales; no reanudar a mitad del cambio. Si se guarda una versión nueva al restaurar código, regenerar el pin con ese ID real, no suponer que equivale por tener el mismo número de nodos.
4. Restaurar únicamente el prompt anterior del mismo Motor, preservando suscripción/eventos. Se puede recuperar el respaldo exacto [motor-after.txt de13](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/blob/main/docs/operations/issue13-category-home-20261113/motor-after.txt), con54666caracteres y SHAa59f79…b34bb7. No reconstruirlo de memoria ni efectuar reemplazos globales. El plan31 mantiene el texto anterior como sufijo exacto; antes de retirar el prefijo, comprobar longitud60558 y SHA256 `3215baec271d589c859fbe11e29e41fd378db15235e78b88eb06e6ed4c7eea83`. Si difiere, conservar las ediciones posteriores mediante revisión del diff. Omitir triggers al actualizar.
5. Mantener el monitor31 compatible con filas legacy y `DIAG|...` mientras existan diagnósticos de esta generación. El monitor antiguoefa no entiende esos carriers: revertirlo sin más podría ocultar bloqueos nuevos. Sólo volver aefa si se comprobó de forma explícita la visibilidad/conciliación de esas filas pendientes y se preserva una vía de consulta para la evidencia histórica. No borrarlas, falsear sus etapas ni marcarlas atendidas para facilitar el rollback.
6. Restaurar los drafts respaldados si publicar/restaurar una versión los cambia. Comprobar autenticación, lectura de paquete, capacidad y coincidencia de los cinco pins con writers inactivos; después restablecer el despacho. No publicar una nota ni reenviar un aviso incierto como prueba.

La tabla de seguimiento conserva las filas `DIAG` como evidencia. No se requiere migración inversa, DROP, limpieza de materiales, liberación de cuota ni modificaciones de WordPress. Tampoco se reabre o procesa el paquete del incidente original. El rollback no elimina la colocación13, el cierre18, la literalidad ni los controles de publicación existentes.
