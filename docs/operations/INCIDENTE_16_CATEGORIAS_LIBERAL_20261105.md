# Incidente 16 — categorías del Motor para LIBERAL

El catálogo anterior y el contrato MEDIA omitían LIBERAL aunque Publisher v3 ya lo admitía. El paquete y la clave originales se conservan exactamente como constan en [el incidente #16](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/16). Este cambio no reenvía, revalida, crea borradores ni publica ese paquete.

Se agregó catálogo v1.3 con las diez categorías de LIBERAL consultadas mediante REST público, 10 registros en una página, sin modificar los objetos de catálogo OPURO ni OPOL de v1.2. El catálogo previo sigue disponible. La consulta pública no acredita las credenciales de escritura ni sustituye el preflight autenticado de Publisher.

El contrato MEDIA v1.4.2 reconoce `CATEGORIAS.LIBERAL.PRINCIPAL`, obligatorio al seleccionar LIBERAL; los paquetes sin LIBERAL mantienen compatibilidad. El prompt v4.9 y las instrucciones del proyecto exigen clasificar por sitio y bloquear si falta categoría, catálogo o la validación automática. `manifest.json` apunta a las nuevas versiones y a `tools/editorial/category-validation.mjs`. La validación requiere los destinos acreditados y no infiere destinos ni comparte IDs. El runtime Publisher conserva su propio preflight de categoría y su compatibilidad histórica; los maestros requieren explícitamente la categoría LIBERAL.

Verificación: pruebas Node de catálogo, compatibilidad, combinaciones, omisión y falsas coincidencias; prueba JSON Schema del campo; validación aislada, con datos sintéticos y sin I/O, del código activo de Publisher para TODOS con una categoría LIBERAL distinta de las demás. No se ha ejecutado una publicación real ni se ha comprobado el acceso de escritura de LIBERAL por este cambio.

Reversión: restaurar de manera atómica el manifest anterior y PROJECT_INSTRUCTIONS desde el commit anterior; conservar los archivos versionados. Revisar paquetes en curso antes de revertir; no cambiar ni volver a usar una clave de solicitud para eludir reconciliación.
