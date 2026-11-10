# Incidente 22: apertura de paquetes Telegram

El 10 de noviembre de 2026 el comando /nuevo devolvió un aviso genérico de fallo. La repetición idempotente de la solicitud original devolvió QUOTA_EXCEEDED; la consulta de sesión devolvió NO_OPEN_PACKAGE.

La tabla de cuota registró 100 paquetes y el recuento real también fue 100: 99 READY y ninguno OPEN. El límite de producción era 100; el uso registrado fue 22 467 180 bytes, inferior al máximo total de 134 217 728 bytes. No se eliminaron paquetes ni se modificaron contadores.

Se preparó un ajuste de emergencia sobre la fuente desplegada del Guard: en tools/telegram/package-store.mjs, PACKAGE_LIMITS.packages pasa de 100 a 1000. Los límites de bytes, archivos y elementos permanecen iguales. El archivo de despliegue es opmx-guard-incidente22.zip; Hostinger inició su compilación el 10 de noviembre de 2026. Consultar el estado del despliegue antes de considerarlo activo.

Esta ampliación proporciona margen, no elimina la necesidad de una política de retención y capacidad. El máximo de bytes también puede agotarse. El receptor de Telegram sigue mostrando un mensaje genérico para QUOTA_EXCEEDED; mejorar el aviso y los registros seguros queda pendiente. Confirmar la apertura real mediante /nuevo en Telegram tras el despliegue, sin crear publicaciones de prueba.
