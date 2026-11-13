# Rollback coordinado del issue13

Este procedimiento revierte únicamente el despliegue13 al baseline **posterior al18 y al21**. No ejecutar sobre trabajo concurrente sin releer versiones activas, borradores y hashes. Los borradores ajenos de Shared/Form/MCP no son las versiones de producción que deben activarse.

## Orden y protección de datos

1. Detener la entrada a nuevas ejecuciones y comprobar que no haya writers running/waiting/new. Esperar o conciliar los que existan; no terminar un intento incierto para volver a enviarlo.
2. Inventariar órdenes13 pendientes. El baseline18 no conoce la nueva autoridad de colocación: no debe procesar un paquete con una orden activa de exclusión como si esa orden no existiera. Mantener esos paquetes fuera del despacho o retirar la orden mediante `conservar` por su operador antes de revertir el receptor. No borrar filas ni alterar notas para facilitar el rollback.
3. Respaldar los snapshots activos y los drafts actuales antes de sustituirlos. Si no coinciden con `release.json`/`readback.json`, preparar un rebase; no sobrescribir cambios posteriores.
4. Restaurar los componentes de la tabla siguiente como una unidad durante la pausa. La combinación transitoria de Guard y writers de distintas generaciones puede bloquear por pins; no reabrir el despacho a mitad del cambio.
5. Restaurar los borradores previamente respaldados si el mecanismo de publicación los cambia. No activar el draft original por accidente.
6. Comprobar hashes/versiones, autenticación y estado sin escritores; comprobar lectura de un paquete sin opción y el diagnóstico de capacidad. Restablecer el despacho sólo cuando Guard y sus cinco pins coincidan. No publicar una nota como prueba ni reintentar un resultado incierto.

## Baseline que debe restaurarse

| Componente | Baseline anterior a13 |
|---|---|
| Guard |`opmx-guard-atomic-close18.zip`,201671 bytes/84 archivos, SHA256 `e76550d99baa33d0b4839487d13040422f4f6805d7018238a3d5949a5b6d79aa`. Conserva el cierre atómico18 y el manifiesto writer21. |
| Shared `4o7K5TmKc7joScqB` |`4263fea4-90a4-406d-a234-da7397d456bf`,146 nodos; hash `825040c5b4e7773177c0bd2030c4a40515d189caec2514374c509c6ee15eb538`. |
| Form `Mt7ts2EGPbyaTC2o` |`d6bbb33a-ab6e-4f90-a88c-921623426444`,58 nodos; hash `be3dd5546e9445c1a4216dba52537ee020205d0e2ea33124f89bfbb8cb41ffe8`. |
| MCP `bnzVMNkZuGO1GQCZ` |`1b78dc88-cb9b-456f-b711-c3328031e61d`,152 nodos; hash `1b1de2dea56ac4c738c9bf2c8ad26af6f082f520fd4cc64f361da2596b6ed56b`. Incluye la copia estática21 ligada al Shared4263. |
| Receiver `OSi8AcnzLlI0csRu` |`159d7833-1848-47f2-bfce-db9792751a78`,52 nodos. Restaurar la versión post18; no volver al cierre dividido anterior. |
| UPDATE `qBmLf0DmcMSfuWvm` |Conservar `d04fb5c2-ba36-48f9-9cd4-2958ab1f273e`, hash `a1692677f677681094531269d6beb60956060275dd7fb54405647c62e9787998`. |
| Reader `C4hk6fQQomueYC8f` |Conservar `1eca0334-b3af-45d9-ac80-341e99a09faa`, hash `84e7d2bd08cb6cafa512ba505ac6e71468dc8f14e64405278c03439f599bd318`. |

Si se crea una versión nueva al restaurar la fuente en lugar de reactivar la versión histórica, los pins del Guard deben regenerarse con los IDs y hashes **reales** que queden activos. No sustituir una versión por otra sólo porque tenga el mismo número de nodos.

## Motor: retirar únicamente el prefijo13

Mantener el Motor `6ae9095256948191b33f1e023fbfbf8b` y sus eventos/suscripción. Restaurar el texto previo exacto desde el respaldo exacto adjunto `motor-before.txt`: **51831 caracteres**, SHA256 `7b09b7b0b0e29de0e03c248a3900f6cd1ac7739864e08c02ef3e9328eceef3b1`. La modificación13 añadió el bloque inicial `COLOCACIÓN POR CATEGORÍA OPURO — AUTORIDAD DIRECTA GUARD (issue13/D045)`; el texto previo se conserva literalmente dentro del actual. No aplicar reemplazos globales ni reconstruir las instrucciones anteriores de memoria.

Antes de retirar el prefijo, el texto actual debe tener54666 caracteres y SHA256 `a59f79e5ba63ddaebdb91b4aa9f1088638e95be2d2a72069e7243f1d40b34bb7`. Si difiere, conservar los cambios posteriores mediante revisión manual del diff. Actualizar sólo el prompt y los campos estrictamente necesarios, omitiendo los triggers para conservar la suscripción actual. Los adjuntos `motor-before.txt` y `motor-after.txt` contienen los textos exactos y sus hashes coinciden sin retirar saltos: no usar copias de exportación que añadan otro salto final.

## Persistencia y alcance

Conservar la tabla `opmx_tg_editorial_placements_v1`, su historial y las trazas de autoridad; el rollback no requiere DROP ni limpieza. Las exclusiones ya escritas legítimamente en WordPress siguen siendo datos editoriales: no limpiarlas ni revertirlas automáticamente. `conservar` tampoco limpia metadata; `ninguna` es una orden explícita diferente que envía `[]`.

No realizar conciliaciones, cancelaciones, cambios de autor ni publicaciones como parte de este rollback. Los dos slots históricos observados por el diagnóstico permanecen documentados y no autorizan liberar capacidad.
