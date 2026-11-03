# Telegram → borradores: piloto de integración

Fecha: 2026-11-02.

## Alcance activo

La automatización existente `opmx.package.ready` para `telegram-editorial` conserva la verificación de paquete, versión, integridad y coherencia, y ahora instruye al Motor para preparar un MASTER y solicitar borradores en los destinos solicitados (ambos por defecto). La publicación pública sigue requiriendo una orden explícita separada. La solicitud usa una clave estable basada en paquete, revisión y destino, y no se reintenta si el resultado es incierto.

Para una sola foto, el Motor debe examinarla, elegir un punto focal y usar un recorte proporcional a 1200 × 630 sin regenerar la escena. Implementación y pruebas: rama `feat/mcp-publisher-file-draft`, `tools/telegram/visual-hero.cjs` y `visual-hero.test.cjs`. Requiere `sharp`; si no puede visualizar, recortar o comprobar dimensiones, no debe crear el borrador.

## Estado de validación

- Recepción real de paquete, evento, lectura e informe de revisión: comprobados anteriormente.
- Publisher: creación manual asistida de borradores en ambos destinos comprobada con el paquete real; no prueba la nueva automatización.
- Recorte: dos pruebas locales sintéticas; no equivale a una prueba del Motor automatizado con una foto real.
- Pendiente: primer evento posterior a este cambio con una nota nueva; verificar maestros efectivos del proyecto, imagen, MASTER y ambos borradores sin duplicados.
- El aviso de revisión de fuentes sigue siendo independiente. Publisher envía al mismo chat privado los enlaces de edición sólo cuando confirma los borradores de una solicitud Telegram; no hay reintento de aviso incierto. El código y las pruebas están en la rama `feat/mcp-publisher-file-draft`, en `tools/telegram/draft-notify.mjs`, `draft-notify.test.mjs` y `build-draft-notify.mjs`. Pasaron cuatro pruebas simuladas en n8n sin enviar mensajes. La entrega real con una nota nueva aún no está comprobada.

## Avisos de bloqueo

El MCP del Publisher dispone de una acción acotada para reportar fallas detectadas de fuentes, contenido, imagen, validación, Publisher y errores técnicos. El destinatario está vinculado al operador del bot; el servidor comprueba que el paquete existe, pertenece a ese usuario y coincide con la revisión READY. Los mensajes son plantillas fijas, sin destinatarios, texto ni enlaces libres. El resultado sólo se confirma con el acuse positivo de Telegram; ante incertidumbre no se reintenta automáticamente. El receptor de eventos quedó instruido para invocar la acción cuando esté disponible.

Validación: cuatro pruebas locales y cinco comprobaciones sintéticas en n8n sin mensajes reales. La acción fue desplegada; su exposición en el catálogo de la sesión actual y una entrega real por un bloqueo nuevo siguen pendientes de verificación. Un cierre abrupto o ejecución que nunca llega a llamar a la acción no activa aviso: falta un vigilante independiente de plazos. Los eventos duplicados podrían producir avisos de bloqueo duplicados, pues la acción no utiliza una reserva persistente por evento; la protección de duplicados del Publisher sigue separada.
