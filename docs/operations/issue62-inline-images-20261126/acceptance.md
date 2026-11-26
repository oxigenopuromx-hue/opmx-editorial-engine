# Issue62 — imágenes interiores activas

Verificado el26 de noviembre de2026. La función CREATE EDITORIAL/LITERAL quedó desplegada y el Motor se reanudó a las14:07:53, hora de Ciudad de México. Se utilizó Git conectado a Hostinger y las herramientas de n8n, sin GitHub Actions.

## Entrega instalada

Una foto conserva su rol Hero; su destacada se produce a1200×630 con el encuadre existente. Con varias fotos, `Hero` identifica la principal; `Thumbnail` y `Destacada` son alias de la miniatura. Sin etiqueta de miniatura se infiere una única imagen de1200×630; si no existe se deriva de Hero y las ambigüedades se detienen. Las fotos restantes pueden llegar sin caption y se insertan en el texto mediante anclajes de párrafos.

El archivo MASTER nativo transporta manifiesto y bytes reales. Publisher comprueba SHA256 antes de escribir, WordPress verifica Content-MD5 al recibir el archivo y cada medio devuelve sus propios IDs y URLs. El readback confirma metadata, imágenes, posiciones y texto. LITERAL conserva la comprobación del original antes de la inserción. Los límites son16 interiores,10MiB por archivo y25MiB en total, sujetos también al límite del paquete.

Se conserva la revisión, la solicitud y los reclamos por destino/foto ante errores. Una respuesta incierta exige conciliación administrativa sobre los IDs existentes; no habilita repetir subidas o crear otra nota automáticamente.

## Código y runtime

- Engine PR63 integrado: `e78f5256fe409c7648b66f5063cf00316b4e2967`.
- Guard PR24 integrado y observado como despliegue actual/completado en Hostinger: `d311cf5e250304b51c6bb101d625e678d4ef9b1a`.
- El Motor carga `docs/MOTOR_IMAGES_V1.md` y los helpers nuevos desde `da0753303597dc15bfafcac04b45e5767fd3bf25`. Sólo se trasladaron sus reglas de imágenes al documento versionado y se añadió esta extensión; el resto del prompt se preservó. Misma automatización y suscripción, habilitada, sin horario añadido.
- MCP:`288249a4-e8a1-4431-9886-22781c718230`; Shared:`5156fe27-b568-43e7-bb09-03e31060ba37`. Guard devolvió `RUNTIME_OBSERVED`, versiones coincidentes y cero escritores activos. El receptor conserva `e39495d5-3472-478f-9fed-c1b6bcb6102a`.

## Comprobaciones

| Comprobación | Resultado |
| --- | --- |
| Engine, roles/bundle/límites/texto literal |137 pruebas aprobadas|
| Guard |npm test y31 pruebas específicas aprobadas|
| MariaDB aislado |197 grupos de comprobación;64 slots y una sola concesión ante dos reclamos concurrentes|
| n8n Code/Crypto/Loop |96985 aprobado; binarios recuperados del item original|
| n8n semántica EDITORIAL/LITERAL por CMS |96996:8 casos aprobados|
| Dos interiores nativos y borrador por CMS |97017/97046:OPURO,OPOL,LIBERAL,HORIZONTE aprobados|
| Archivo MASTER nativo real |FILES_VALIDATED,5232 bytes; bundle comprobado y sin escrituras|
| Escritor completo con Hero, destacada y dos interiores |97082:SUCCESS/DRAFT; registros de medios y readback confirmados|
| Combinaciones de destinos |30 casos:las15 combinaciones en ambos modos; alcance y manifiesto conservados|
| Conservación en el paso de publicación |Código real de los cuatro verificadores acepta el mismo cuerpo e imágenes y rechaza cambios; cero solicitudes reales de publicación|

Los cinco borradores técnicos11258/4173/602/144 y11264 fueron leídos y enviados a papelera. La última comprobación independiente97086 confirmó texto íntegro y adjuntos11262/11263 antes de retirar11264. Se usaron imágenes sintéticas, sin reutilizar notas o fotos del operador. QA quedó restaurado a sus dos nodos originales e inactivo.

El preflight de archivo nativo se hizo sin solicitud de escritura; el ensayo completo usó la entrada autenticada preexistente de Shared y su solicitud técnica estable. No se fabricaron controles, paquetes ni permisos Telegram para probar. La autenticación y orquestación general de Publisher manual conservan el alcance previo de #56.

Las diferencias de infraestructura encontradas quedaron cubiertas: Hostinger puede transformar los bytes públicos de una imagen, por lo que no se confunde el hash de CDN con el original recibido por WordPress. El Liberal puede devolver entidades HTML en pies y serializa img con un espacio antes de `/>`; se generan bloques canónicos y se admite una sola capa de codificación en metadata, sin eliminar etiquetas ni cambiar texto.

## Continuidad

La copia posterior a otros destinos corresponde a #55 y sigue abierta. Debe transportar también este manifiesto y los originales, resolver IDs nativos nuevos y conservar los destinos ya entregados. #62 no crea borradores en los cuatro medios por defecto ni activa UPDATE con nuevos interiores. La creación manual general permanece en #56. Estos alcances se mantienen como seguimientos separados, según la prioridad indicada por Dirección.

Evidencia estructurada: [acceptance.json](acceptance.json). No contiene originales editoriales, credenciales ni capacidades de intentos.
