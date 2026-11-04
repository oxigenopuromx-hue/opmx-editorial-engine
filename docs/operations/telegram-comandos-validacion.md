# Validación de comandos de Telegram

Fecha: 2026-11-03.

El receptor activo versión a6914cb9-8b93-4026-a617-13e0dc6cf836 rechaza comandos independientes con barra que no coinciden con la sintaxis admitida, incluido `/publicar en ambos` y `/borrador en ambos`. La respuesta propone ejemplos válidos y el mensaje no se guarda como texto editorial. Se comprobaron los casos válidos, inválidos y texto ordinario con la función activa aislada, y la configuración del nodo pasó validación n8n. Falta prueba de interacción real en Telegram. Las órdenes directas válidas continúan acreditadas; no se cambiaron ni el Motor ni el valor predeterminado de borrador.

## Publicación predeterminada aún pendiente

El usuario solicitó publicar por defecto en ambos, conservando la opción de borrador. El conector publicar_nota_opmx establece que PUBLICAR debe usarse sólo cuando el usuario ha ordenado publicar el paquete concreto. La instrucción de la automatización y el selector de modo actualmente también exigen una orden acreditada concreta. No sustituir esa comprobación por un resultado fabricado ni cambiar la semántica de paquetes en curso o ya cerrados. Se requiere una solución compatible con el contrato del conector que refleje la preferencia predeterminada, incluya señales por paquete, advierta en Telegram antes de cerrar, preserve la opción borrador y bloquee órdenes de modo inválidas que puedan confundirse con la intención de publicar. Mantener revisión editorial, protección contra duplicados y avisos por remitente. Hasta resolverlo, no afirmar que la publicación predeterminada está activa.

## Seguimiento del 3 de noviembre

Se activó el receptor n8n versión 6f1b5931-9b67-4f16-8f24-480473911328 para que el mensaje de cierre indique que los avances y resultados llegan al mismo chat de Telegram. El nodo pasó validación y la versión activa coincide con la editada. La comunicación de seguimiento no constituye una prueba completa de extremo a extremo.

El paquete tg_6db63b3c569d559e5d70379499f3f57fb2305b1a, revisión 6, se detuvo por INTERNAL_ERROR: el entorno de la ejecución del Motor no estaba disponible. Se verificó el inventario READY y se identificó la orden autenticada de publicar en OPURO. El texto coincide temáticamente con la nota sobre Karina Olivas publicada en OPURO (post 9874); antes de reactivar o crear otra nota se requiere reconciliarla para evitar duplicados. La causa de la indisponibilidad del entorno todavía no se ha establecido ni reparado.

El valor predeterminado permanece DRAFT: elegir PUBLICAR sin una señal de autorización del paquete requeriría cambios en el protocolo del receptor y en el selector verificable y no está implementado ni probado. No alterar paquetes ya cerrados retroactivamente.
