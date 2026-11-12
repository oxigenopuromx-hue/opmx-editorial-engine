# Issue 19 — entrega literal autenticada

Seguimiento más reciente: [revisión19, adaptador MCP y Guard vigentes](RECURRENCIA_REV19.md).

Seguimiento posterior: [revisión14 y descartados](RECURRENCIA_REV14.md). El hash de prompt de este informe corresponde al despliegue inicial; consultar ese seguimiento para el prompt actual y pin de imagen.

Fecha: 12 de noviembre de 2026. Alcance autorizado: corregir la infraestructura; NO publicar, crear borrador ni reintentar la nota pendiente.

## Causa

El paquete de revisión 10 encontró la exigencia editorial de En breve/estructura aun cuando el operador pidió publicar tal cual. El receptor no acreditaba esa frase como selección de perfil y la ruta de recuperación CREATE LITERAL seguía bloqueada. Las recuperaciones posteriores también podían perder la modalidad.

## Comportamiento corregido

- /literal, /editorial y una lista exacta de frases directas seleccionan el perfil en mensajes nuevos independientes del operador autenticado. Incluye «La publicación va tal cual, sin agregarle nada». Reenvíos, respuestas, ediciones, captions y frases dentro de un artículo no autentican controles. La modalidad no concede permiso de publicación ni cambia destinos.
- chooseMotorPolicy conserva DRAFT/PUBLISH, destinos y clave canónica. La captura de revisión conserva modalidad, controles y hash de la decisión confirmada a través de reaperturas sucesivas.
- El perfil LITERAL serializa título, subtítulos y cuerpo originales sin En breve, fuentes añadidas, secciones ni cierre. No aplica los objetivos SEO generales de 60/160 caracteres. Conserva límites técnicos (título 2048 bytes UTF-8; subtítulo 500 caracteres) y rechaza el exceso antes de escribir, sin truncar.
- Guard coteja el contenido completo con fuentes activas verificadas en sus tablas, acredita la modalidad real y conserva prueba inmutable de texto/solicitud/revisión/destino/decisión. Una bandera del MASTER no basta. La prueba ocurre antes de imágenes/CMS y del ACK de CREATE LITERAL recuperada.
- El escritor aplica el control para todas las solicitudes Telegram: omitir la bandera no elude la modalidad real. La publicación de borradores literales coteja también los registros CMS exactos antes de publicar. EDITORIAL conserva su contrato; la ruta manual no acepta LITERAL sin controles Telegram.
- Permanecen autor3 de El Liberal, imágenes, créditos, categorías por CMS, fences, duplicados, conciliación Waldo, observación final de publicaciones y monitor de alertas #30.

## Nota pendiente protegida

Paquete tg_dd8ff15fbc93b83b3e579c4266d5aea4bcf2be7b, revisión 10. Sólo se consultó inventario y la instrucción de 48 bytes (SHA256 ffe39c3ed4641eda6411a0940e22344e2ac738b076bdf69d9771cfe15c0c6a2f). No se leyó el cuerpo de la noticia, reclamó intento, reabrió, cambió modalidad histórica ni reactivó evento. No se llamó ningún escritor CMS ni se envió texto a Telegram. La instrucción histórica sin acreditación no se transforma retroactivamente en autoridad. El usuario publicará esa nota por su cuenta.

## Validación

- 450/450 pruebas Node pasan, incluidas negativas de perfil, fuentes, autenticación, decisión, replay, incertidumbre y preservación EDITORIAL. Helper final SHA256c824cf684a83474a34bcb5e24a5e3694f4a203c971124e85140231af28cba516.
- Helper de imagen fijado al pin anterior63222a1e:5/5 casos pasan; los controles literal/editorial no activan ni bloquean imagen y las fuentes manipuladas siguen rechazadas.
- Dos ensayos del ZIP ensamblado pasan: arranque CommonJS real; 401 sin bearer; fallo de inicialización BD no concede escrituras; nuevo endpoint y rutas previas conservan bloqueo sin estado válido.
- n8n37529:28assertions con código real de normalización/preflight/readbacks, título130caracteres/subtítulos362, tres destinos, enlaces/tooltip nuevos rechazados. Fuentes/Guard sintéticos; cero solicitudes Guard/CMS de esa QA.
- n8n37532: Guard real observe-final devuelve FINAL_PUBLICATION_CONFIRMED para WEG8/TODOS, con recibo durable y lecturas de OPURO10513/OPOL3524/LIBERAL397. Este observador verifica los cinco grafos fijados y escritores inactivos. No autoriza escribir ni modifica publicaciones.
- n8n37537: el endpoint nuevo /v1/telegram/literal/validate recibe objeto vacío y responde LITERAL_TEXT_UNCONFIRMED, writesStarted=false/retryPermitted=false. No se genera prueba ni se toca una nota.
- Relectura del paquete pendiente: READY10, seis elementos almacenados; instrucción y SHA iguales. No se cambió su intento histórico.
- Relectura de los cuatro workflows: versiones activas exactas. Los tres grafos activos de escritores son idénticos a los preparados auditados incluso después de restaurar los drafts ajenos.

## Versiones instaladas

| Componente | Versión activa nueva | Reversión a versión activa previa |
| --- | --- | --- |
| Receptor OSi8AcnzLlI0csRu | b9a2f944-8a03-4fd2-a730-3b93b6c33688 | 0bfda1b6-a4de-48fd-9f63-d4c9d8a76127 |
| MCP bnzVMNkZuGO1GQCZ | 32e28420-47ef-4732-b346-22c2708bff49 | 76ef3bfe-db0a-4fb4-996c-ad703ab1639a |
| Shared4o7K5TmKc7joScqB | 4263fea4-90a4-406d-a234-da7397d456bf | c7610e14-994b-45bd-8748-bdef90e0fc78 |
| FormMt7ts2EGPbyaTC2o | d6bbb33a-ab6e-4f90-a88c-921623426444 | bf4cc77c-6853-4303-a25b-2f58dc057d8e |

Guard: opmx-guard-literal19.zip, SHA256518721f59f5803885e852d99f6e884901031310974e6865775074ee91d92c163. Hostinger: completado/Actual12nov16:06:48CDMX. Fuente de runtime/selector/compilador/builders: e7fae39e62d8b233c379198d24c516fe4b580071, rama feat/telegram-reopen-recovery. Maestros/perfil en main:b1064e91ae795e5843c77485d2215425fdfdced5. El contrato general conserva blob5c8a11fdf1ac232d91b13404e42f4a2c49fba5ec; no se relajó EDITORIAL.

Motor existente6ae9095256948191b33f1e023fbfbf8b: sólo cambia prompt, SHA256f74b77103dea0434c7f8fe1e85d66b7ac7ebec5f055a5658eb162150f612f0dd; cuatro referencias al mismo sourcepin final. Relectura: texto exacto, enabled/title/schedule/conversation/environment iguales. La llamada update_subscription omitió triggers para conservar READY/preview. No se creó ni cambió ninguna suscripción de eventos.

## Limpieza y drafts preservados

Los drafts anteriores de MCPf9cdb316…, Shareded76ec37… y Form8e0c7559… se restauraron DESPUÉS de activar las versiones nuevas. Nuevos IDs de draft: ab60c994-4bd9-43b3-9eb9-a3288a322e5d /3cb247db-d295-42ef-9e92-6cfded04fa1d /5f24314b-4fa3-4972-8ba0-b51cfe54f36c. Son trabajo ajeno anterior, no el código productivo de este release; futuros editores deben partir de la versión activa y conservar esos drafts.

Probe7IDUF9PeHQ5v331Z: restaurado de b12cfe6f-ea62-48a8-8d70-f4b0579c1dde a draft4c1166c3-3c39-4d0e-a03d-be22ad24d37e, inactivo, tres nodos, GET original de workflow MCP con credencial n8nApi únicamente. saveManualExecutions=false/saveDataSuccessExecution=none/saveDataErrorExecution=none/saveExecutionProgress=false; límite30s sólo en este diagnóstico. No se amplió acceso ni cambiaron credenciales.

Guard previo para reversión coordinada: opmx-guard-final-publication-observer.zip, SHA256ecd2f908e6e19616097ebcf5aee891aa64e36b3305675ffab4c32146bb55fdc0. Selector previo Motorbc9138f1dc60f838559d385ec4fc20f511089210. Restituir prompt anterior junto con las cuatro versiones previas y Guard; no activar el nuevo receptor con un escritor/Guard previo. No publicar los drafts ajenos restaurados como mecanismo de reversión.

## Límites de la comprobación

Las pruebas positivas de literalidad usan fuentes sintéticas y los proveedores reales con base de datos simulada. La prueba de código n8n no llama Guard ni CMS. No se crea un paquete ni una nota de prueba en producción, conforme a la instrucción del usuario. La lectura de runtime/CMS verifica integridad y versiones de la infraestructura, pero no equivale a una publicación literal real.

## Reversión coordinada

Conservar el único Motor y su suscripción READY/preview. Revertir conjuntamente Guard, los tres escritores, receptor y prompt anteriores; no mezclar pins de versiones incompatibles. Conservar los drafts ajenos anteriores. El cambio de código no autoriza reintentar solicitudes inciertas ni paquetes históricos. La cancelación de paquetes (#28) sigue diferida.
