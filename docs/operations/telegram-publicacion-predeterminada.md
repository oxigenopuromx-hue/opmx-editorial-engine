# Publicación predeterminada desde Telegram

Estado: desarrollo, NO activado. El receptor y la automatización de producción siguen usando el selector anterior y el valor predeterminado de borrador.

Se preparó un selector que sólo aplica PUBLICAR AMBOS por defecto si recibe y verifica, dentro del inventario READY de ese paquete, las órdenes directas acreditadas /nuevo y /listo. La última orden explícita /publicar o /borrador conserva precedencia y destino; los paquetes antiguos sin señal de apertura siguen en borrador. El selector confirma SHA256 y longitud de cada texto. Diez pruebas locales pasaron con Node.

Pendiente para integrar: el receptor debe anunciar claramente el valor predeterminado al abrir; registrar /nuevo y /listo reales como mensajes acreditados, de forma vinculada al paquete; rechazar esos comandos si se reenvían; no sellar si no pudo guardar y confirmar el cierre; conservar idempotencia, límites y orden bajo concurrencia. La política no se debe registrar hasta confirmarse la entrega del aviso de apertura. Probar con datos sintéticos las carreras, reintentos, fallos de almacenamiento, rechazos, opción borrador y paquetes previos. Actualizar la automatización para usar el commit revisado, preservar su disparador y comprobar el contrato de publicación por paquete, sin generar órdenes /publicar que el operador no envió.

Antes de desplegar, validar integralmente el comportamiento frente a la exigencia de orden explícita del conector. Realizar una prueba real sólo con un paquete autorizado y con control de duplicados. No está probado aún el flujo completo ni disponible la publicación predeterminada.
