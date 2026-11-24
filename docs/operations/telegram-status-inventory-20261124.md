# Telegram: /estado antes de /listo — entrega del issue35

Fecha: **24 de noviembre de 2026, Ciudad de México**.

Issue: https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/35

## Resultado instalado

Desde /nuevo y /abrir, /estado muestra materiales y órdenes antes de /listo: fragmentos reconocibles, enlaces, nombres/tipos/captions, reservas pendientes, opciones vigentes y órdenes sustituidas. Cada elemento editable tiene su comando exacto /descartar ti_.... El listado completo se divide por partes cuando hace falta.

Las órdenes técnicas y la autorización histórica se distinguen como protegidas. Una retirada que ampliaría destinos o pasaría de borrador a publicación exige registrar antes un reemplazo explícito; no se ofrece un descarte que se sabe rechazable. En una reapertura, /opciones reemplaza acción/modo/destinos conservando la autorización anterior.

Se mantiene el recorrido de /listo: cierre/procesamiento ordinario desde /nuevo y vista/comando de confirmación desde /abrir. /estado no cambia revisión, selección, cola o permisos ni llama al Motor o Publisher.

## Versiones y despliegue

| Componente | Base | Versión instalada |
| --- | --- | --- |
| Guard, release/production | e42f801d0310d3daa566728f1a68ec8ea05288d5 | **15932b9433f896c5055177661dc1a20e9fccb361** |
| Receptor OSi8AcnzLlI0csRu | c67004a0-a40f-4a42-b2d0-79f7ae8e2685 | **e39495d5-3472-478f-9fed-c1b6bcb6102a** |

PR implementado: https://github.com/oxigenopuromx-hue/opmx-publisher-guard/pull/23

Hostinger mostró el commit15932b94 como despliegue **Actual / Se ha completado**, iniciado a las **16:30:46 CDMX**. Se usó su conexión GitHub existente, sin GitHub Actions, migraciones ni cambios de credenciales.

El receptor se leyó otra vez antes de editar: seguía exactamente en c67004a0. Se actualizaron únicamente los nodos **Normalizar entrada Telegram**, **Confirmar operación de paquete Telegram** y **Resultado piloto Telegram**. El borrador se verificó antes de publicar y la lectura final acredita active=true, activeVersionId=e39495d5 y sameAsDraft=true. Los 54 nodos, conexiones, credenciales y demás parámetros conservaron su identidad y contenido salvo esos tres códigos.

## Validación

- **22 pruebas** de contrato y receptor aprobadas.
- **38 escenarios MariaDB10.11.18 aislados** aprobados, con almacén real, SQL transaccional, HTTP autenticado y recorrido del receptor observado. Incluye texto, imagen, PDF, órdenes, originales, hashes, replay, acceso cruzado, pendientes, carreras con /listo y descarga, lease propia/administrativa y selección de recuperación. El consumidor de vista es un stub local; no se afirma una publicación de prueba.
- npm test aprobado: sintaxis y regresiones existentes.
- Suites SQL issue28/mysql-test y real-store-test aprobadas con el cambio.
- Una ampliación de regresiones encontró una falla **preexistente** en literal-recovery-mysql.test.mjs: DECISION_UNCONFIRMED en línea88. Se reprodujo igual en la base e42 sin este cambio. No se afirma que toda la suite SQL literal esté verde; no se alteraron sus controles productivos.
- **Ejecución n8n90936**, 16:34:52 CDMX: se ejecutaron los códigos exactos de la versión activa con datos ficticios, sin conectar Telegram, CMS, Guard o Publisher. Resultado ISOLATED_RECEIVER_VERIFIED. Tanto nuevo como reabierto incluyeron los **40 elementos en cinco partes**; máximos3062 y2916 caracteres. Los acuses completos resultaron COMPLETE y la falta de partes resultó PARTIAL / RECEIPT_NOT_CONFIRMED.
- Los descartes inválidos reciben ayuda de /descartar, no ayuda genérica de /publicar.
- JFIF se admite como archivo JPEG con comprobaciones de firma/tamaño/bytes; las fotos Telegram conservan telegram-photo.jpg. Los diagnósticos concretos de descarga y guardado existentes se mantienen.

## Lectura productiva y cierre de auxiliares

Consultas autenticadas de sesión a las16:32, ejecuciones90931 y90932: HTTP200 / NO_OPEN_PACKAGE para los dos operadores configurados. No había una sesión abierta para hacer una consulta de inventario real; no se creó ni reabrió un paquete real como ensayo. La aceptación del inventario y edición se realizó con datos aislados, y se comprobó la instalación del código exacto en Guard y receptor.

El flujo auxiliar41kQE94ZJVfarH2n se restauró exactamente a sus dos nodos y parámetros originales, sin publicar y active=false. Se retiró el nodo temporal de comprobación; no quedó un consumidor adicional.

La aceptación y el cierre corresponden al issue35. El incidente histórico Sinaloa y su diagnóstico se documentan por separado en el issue61; esta instalación no vuelve a procesarlo.
