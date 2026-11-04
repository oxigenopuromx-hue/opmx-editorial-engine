# Publicación predeterminada desde Telegram

Estado: desarrollo, NO activado. El receptor y la automatización de producción siguen usando el selector anterior y el valor predeterminado de borrador.

Se preparó un selector que sólo aplica PUBLICAR AMBOS por defecto si recibe y verifica, dentro del inventario READY de ese paquete, las órdenes directas acreditadas /nuevo y /listo. La última orden explícita /publicar o /borrador conserva precedencia y destino; los paquetes antiguos sin señal de apertura siguen en borrador. El selector confirma SHA256 y longitud de cada texto. Diez pruebas locales pasaron con Node.

Pendiente para integrar: el receptor debe anunciar claramente el valor predeterminado al abrir; registrar /nuevo y /listo reales como mensajes acreditados, de forma vinculada al paquete; rechazar esos comandos si se reenvían; no sellar si no pudo guardar y confirmar el cierre; conservar idempotencia, límites y orden bajo concurrencia. La política no se debe registrar hasta confirmarse la entrega del aviso de apertura. Probar con datos sintéticos las carreras, reintentos, fallos de almacenamiento, rechazos, opción borrador y paquetes previos. Actualizar la automatización para usar el commit revisado, preservar su disparador y comprobar el contrato de publicación por paquete, sin generar órdenes /publicar que el operador no envió.

Antes de desplegar, validar integralmente el comportamiento frente a la exigencia de orden explícita del conector. Realizar una prueba real sólo con un paquete autorizado y con control de duplicados. No está probado aún el flujo completo ni disponible la publicación predeterminada.

## Estado de seguimiento — 4 de noviembre

El receptor de producción continúa activo con el selector anterior; sin orden acreditada el modo sigue siendo DRAFT/AMBOS. No se ha desplegado ni probado de extremo a extremo la rama de publicación por defecto. Para publicar actualmente, el operador debe enviar /publicar ambos (u otro destino) antes de /listo.

El paquete tg_5de20fccce9583879ca0e1fd99cfed1a4b5ec75c revisión 6 recibió aviso de demora tras la etapa de imagen y carece de etapa final registrada. Contenía un enlace de La Jornada sobre Bobby Pulido y una foto. Un paquete posterior, tg_171639f5d8f09b8993ea2341bb1e85dc35808b0f revisión 7, contiene exactamente el mismo enlace y la misma imagen según las huellas y terminó con PROCESS_COMPLETE; existen notas publicadas del tema en OPURO ID 9911 y OPOL ID 3078. No reactivar ni reenviar el paquete anterior sin reconciliación, para evitar duplicados. La existencia de estas notas no prueba por sí sola cuál solicitud las creó.
