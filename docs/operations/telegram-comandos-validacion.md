# Validación de comandos de Telegram

Fecha: 2026-11-03.

El receptor activo versión a6914cb9-8b93-4026-a617-13e0dc6cf836 rechaza comandos independientes con barra que no coinciden con la sintaxis admitida, incluido `/publicar en ambos` y `/borrador en ambos`. La respuesta propone ejemplos válidos y el mensaje no se guarda como texto editorial. Se comprobaron los casos válidos, inválidos y texto ordinario con la función activa aislada, y la configuración del nodo pasó validación n8n. Falta prueba de interacción real en Telegram. Las órdenes directas válidas continúan acreditadas; no se cambiaron ni el Motor ni el valor predeterminado de borrador.

## Publicación predeterminada aún pendiente

El usuario solicitó publicar por defecto en ambos, conservando la opción de borrador. El conector publicar_nota_opmx establece que PUBLICAR debe usarse sólo cuando el usuario ha ordenado publicar el paquete concreto. La instrucción de la automatización y el selector de modo actualmente también exigen una orden acreditada concreta. No sustituir esa comprobación por un resultado fabricado ni cambiar la semántica de paquetes en curso o ya cerrados. Se requiere una solución compatible con el contrato del conector que refleje la preferencia predeterminada, incluya señales por paquete, advierta en Telegram antes de cerrar, preserve la opción borrador y bloquee órdenes de modo inválidas que puedan confundirse con la intención de publicar. Mantener revisión editorial, protección contra duplicados y avisos por remitente. Hasta resolverlo, no afirmar que la publicación predeterminada está activa.
