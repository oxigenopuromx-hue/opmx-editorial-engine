# Issue 28: cancelación de duplicados (trabajo incompleto)

**Prototipo aislado, no integrado ni apto para desplegar.** No ejecutar contra producción.

## Estado revisado

- tg_e1b0f978ddbad040412d44dbb0dd89d7b99aaa1b: OPEN, revisión 9, reabierto. El usuario autorizó cerrarlo por duplicidad editorial, sin atribuirle OPURO 10737 ni OPOL 3747. No se ha cerrado y no se ha verificado la liberación de sesión.
- tg_086014c198ded6762a2a826fb4018227a7388217: READY, revisión 19. La antigua orden de cancelación de revisión 8 fue reemplazada por una orden de publicación. No cancelar automáticamente.
- tg_610b4b8a5e787fa11d91961706a9450debb9dc44: READY, revisión 8. Existe una orden histórica de cancelación; el usuario pidió no cancelar otros paquetes automáticamente.

Los estados anteriores son una observación puntual; antes de cualquier acción volver a consultar y reconciliar órdenes, revisión y actividad.

## Prototipo

La transacción candidata conserva materiales, guarda un motivo de duplicidad independiente de los identificadores de WordPress, libera sesión y lease, comprueba revisión y reserva pendiente, y comprueba fence y tentativa anterior en reaperturas. Replay idéntico es idempotente. Pruebas con doble de base de datos: `node prototypes/issue28/test-cancel.mjs`. Estas pruebas no verifican MySQL real, concurrencia, la integración con Telegram o todos los escritores.

## Pendiente antes de usar

1. Confirmar el código exacto actualmente desplegado; la fuente local reconstruida procede de versiones anteriores y main no contiene el package-store desplegado.
2. Integrar en Guard la migración y ruta autenticada, y en el receptor Telegram una orden explícita, ligada a actor, paquete y revisión; rechazar mensajes reenviados/editados/citaciones y no inventar receipts.
3. Revisar todos los caminos de escritura, cierres, trabajos de preview/dispatch y mensajes atrasados; garantizar que CANCELLED impida toda escritura o publicación posterior, incluso carreras y reaperturas.
4. Integrar lectura del estado terminal, auditoría y presentación en /estado; comprobar compatibilidad con selección editorial y recuperación.
5. Probar con MySQL y datos aislados: rollback, concurrencia, reintentos, sesiones nuevas o reabiertas, fallas parciales y extremo a extremo.
6. Desplegar por el procedimiento autorizado, verificar la versión activa, luego volver a leer el caso actual, cerrarlo únicamente si sigue siendo el paquete y revisión autorizados, y verificar material, auditoría, estado y disponibilidad de sesión.

El acceso de este entorno al panel Hostinger fue rechazado por la revisión automática al llegar al inicio de sesión restringido. No se desplegó ni se modificó producción. No usar este prototipo para eludir esa restricción.
