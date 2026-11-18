> **Actualización 18/11:** el usuario reutilizó `tg_e1b0f978ddbad040412d44dbb0dd89d7b99aaa1b` para otra nota y retiró la orden anterior de cancelación. No usarlo en pruebas ni cancelarlo por esa orden. Las referencias siguientes son históricas y están sustituidas por esta instrucción.

# Integración candidata del issue 28

Estado: **trabajo aislado, incompleto y no desplegable**. El patch se preparó contra la fuente reconstruida a partir del artefacto issue 37 y ajustes locales issue 39; no se ha verificado que esta fuente coincida con el Guard activo. Los archivos del receptor derivan de la versión activa n8n 8ce13116-eaeb-4010-a0c0-b2e839a2812f observada durante esta sesión; existe un borrador diferente que debe preservarse y reconciliarse antes de cualquier cambio.

## Cambios candidatos

- Guard: migración de auditoría, operación transaccional, registro en el arranque y ruta autenticada `POST /v1/telegram/packages/cancel-duplicate`. Evita cancelar si hay reservas, evento, fence o intento de la revisión actual, trabajos de vista de revisión actual o una reapertura sin fence conciliado. Conserva materiales y no crea publicaciones ni vincula notas.
- Lectura: no busca la selección de portada en paquetes terminales CANCELLED.
- Receptor: orden directa `/cancelar duplicado <paquete> <revisión>`, con identidad real y cotejo de paquete y revisión con la sesión; rechaza reenvíos, respuestas, archivos, ediciones y texto adicional. La respuesta verifica paquete, revisión, motivo y flags recibidos.
- El rechazo frente a cualquier trabajo de vista existente es deliberadamente conservador: se requiere reconciliación posterior. No se ha confirmado que permita cancelar el caso real.

## Pruebas ejecutadas

- Transacción simulada: éxito, replay, revisiones antiguas, identidad, pendientes, fence, trabajo de vista, liberación de sesión y rollback simulado.
- Ruta HTTP en copia reconstruida: autenticación, resultado y error de estado simulados.
- Flujo de los cuatro nodos del receptor en simulación con datos inventados, incluido rechazo de reenvíos y texto adicional. La prueba persistida es `node prototypes/issue28/integration/test-receiver.mjs`; la prueba transaccional es `node prototypes/issue28/integration/test-cancel.mjs`. `test-http.mjs` requiere colocar el archivo en una copia de la fuente reconstruida con el patch aplicado.

Las pruebas con MySQL aislado cubren cancelaciones simultáneas y una carrera con emisor simplificado. La ampliación contra el almacén de paquetes del Guard está en verificación. No cubren caída del proceso, todos los posibles escritores, el flujo de n8n real ni equivalencia con el Guard desplegado. Deben cubrirse antes de producción. Hace falta además garantizar la lectura verificable de estado terminal, la liberación real de sesión y el comportamiento del receptor ante respuestas HTTP inciertas.

El patch y el módulo deben aplicarse juntos sólo después de verificar la fuente correspondiente. No activar nodos ni ejecutar contra datos reales con esta versión. El paquete objetivo se observó OPEN revisión 9; debe consultarse de nuevo antes de actuar.

La copia local coincide con el ZIP del Guard desplegado documentado el 14/11 (SHA-256 2d308f082dc3aba42652b294a4987b051b6f822a485e47bcd0847444c46ec47f), sin verificar que siga activo. El fixture actual-guard introduce únicamente los cambios candidatos de manifest, compatibilidad MySQL 8 y detalle de error para pruebas; no es evidencia de producción.
