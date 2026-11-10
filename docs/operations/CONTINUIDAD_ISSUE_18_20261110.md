# Continuidad del incidente #18 — 10 de noviembre de 2026

El usuario confirmó que `/nuevo` volvió a funcionar después del despliegue de la ampliación de cuota del incidente #22. El Guard activo se actualizó con un límite de 1000 paquetes; el resto de límites de bytes no cambió. La recuperación candidata debe conservar ese límite al integrarse.

En `guard-recovery-candidate/package-store.mjs`, la cancelación de una reserva PENDING conserva la fila y el recibo para auditoría y libera de forma transaccional la reserva de bytes y un lugar de elementos. Una repetición de un descarte devuelve DISCARDED_REPLAY. El código comprueba contadores antes de disminuirlos y revierte ante conflicto. Este cambio sólo aplica a nuevas operaciones de descarte; no recalcula los contadores históricos de filas previamente descartadas. No elimina originales STORED ni crea eventos.

El cambio es candidato y no está desplegado. Por instrucción del usuario no se realizaron pruebas ni verificaciones adicionales para esta integración. La reapertura y edición completas siguen sin habilitarse: faltan conectar la evidencia autoritativa de fin del intento, la cobertura de todos los escritores, el productor real de vistas previas y las credenciales al guard existente, además de conectar el receptor y Motor existentes. Se mantienen las barreras que impiden duplicar o editar sin autorización. No asumir que los comandos de recuperación ya funcionan en producción.

## Conexión añadida posteriormente

Se añadió al adaptador candidato del Motor la herramienta `preparar_vista_actualizacion_telegram_opmx`: recibe paquete, revisión, destino y propuesta, y se enruta por el MCP existente al almacén de vista del Guard. La propuesta no autoriza actualizar; el almacén exige sesión, selección UPDATE y revisión vigentes. El enrutamiento MCP actual identifica al propietario original desde el seguimiento, por lo que la preparación realizada por un administrador que reabrió un paquete ajeno no está conectada todavía y debe permanecer cerrada hasta disponer de identidad fiable del editor.

El receptor candidato admite `/descartar` directamente en una sesión ordinaria para reservas pendientes; `/estado` muestra los identificadores pendientes. En recuperación se conserva la protección de controles y originales. El Guard candidato evita guardar nuevos controles `/listo` mientras existan reservas pendientes, por lo que reintentar el cierre no consume más huecos en ese caso.

Estos cambios sólo están en la rama candidata. No se desplegaron, no se ejecutaron pruebas y no se ha completado el productor ni el disparador real de la propuesta, la conciliación autoritativa, la cobertura de todos los escritores ni el flujo de confirmación y actualización en producción.
