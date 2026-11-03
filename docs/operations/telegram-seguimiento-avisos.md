# Seguimiento y avisos de paquetes Telegram

## Comportamiento

El receptor registra el cierre READY de cada paquete y su revisión en la tabla n8n de seguimiento. La automatización comunica las etapas: revisión de fuentes, redacción, preparación de imagen, envío a Publisher y resultado; los bloqueos usan categorías acotadas y no incluyen texto libre. En el catálogo existente se utiliza el canal de revisión con una extensión del protocolo para estados: outcome SOURCES_VERIFIED y revision codificada como 1000000 + revision_real*32 + código. Esa codificación no sustituye la revisión real al consultar fuentes o publicar. El Publisher vuelve a comprobar propiedad, estado READY y revisión real antes de enviar el mensaje al chat privado. Ante envío incierto no se reintenta.

El supervisor n8n revisa cada cinco minutos eventos recientes y, después de diez minutos sin avance confirmado, avisa el último estado. La demora no prueba que el proceso haya fallado ni que se haya publicado. Registra el aviso para no repetirlo para la misma etapa; una etapa posterior puede activar un nuevo aviso si vuelve a quedarse sin avance. Los resultados parciales y bloqueos informados no se reenvían a Publisher.

## Validación al 3 de noviembre de 2026

- Prueba sintética del protocolo y rechazo de identidades/versiones inválidas, ejecución n8n 626.
- Prueba del supervisor y tabla con datos ficticios; la etapa con demora generó un único registro de aviso y el paquete terminado no generó aviso. Una segunda ejecución no duplicó el aviso (627 y 628). Telegram estuvo simulado.
- La lectura real del inventario de un paquete existente fue correcta. El flujo aislado preparó correctamente el aviso de prueba sin enviarlo (642).
- Un envío real de prueba devolvió FAILURE_UNCERTAIN; no se reintentó. No está confirmada su entrega ni el funcionamiento completo de los avisos de etapa y bloqueo. El supervisor está activo, pero su entrega real a Telegram tampoco se ha comprobado.
- Una solicitud de activar guardado completo de ejecuciones del Publisher fue rechazada por revisión automática por posible exposición persistente de fuentes y datos sensibles; no se activó ni se intentó eludir la decisión.

La etapa final puede no quedar registrada si el envío o el registro falla. El supervisor puede no avisar si la tabla o Telegram están inaccesibles. Los registros de seguimiento no contienen el contenido de las fuentes. Falta una prueba integral con paquete real y una confirmación de entrega; no declarar terminada esa validación hasta que exista evidencia.
