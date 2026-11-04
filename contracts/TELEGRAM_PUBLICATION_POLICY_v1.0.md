# Telegram — política de publicación v1.0

Decisión autorizada por el usuario el 2026-11-04: publicar las notas por defecto;
crear sólo borradores cuando se indique `/borrador` explícitamente.

## Alcance

Paquetes nuevos del chat privado autorizado de Telegram. No modifica contratos
editoriales, contenido Gutenberg, Publisher de 91 nodos ni Social. La creación
inicial interna como draft y las verificaciones del Publisher se conservan; el
resultado final solicitado es PUBLISH, no la eliminación de esas verificaciones.

## Entrada acreditada y resultado

- `/nuevo`: apertura real autenticada. El bot anuncia PUBLICAR AMBOS al cerrar y
  explica `/borrador`. Sólo después del acuse Telegram se almacena el registro
  de apertura con su message_id y notice_message_id, ligado al package_id.
- `/listo`: cierre real autenticado. Se almacena antes de sellar el paquete.
- `/borrador [ambos|opuro|opol]`: DRAFT explícito; sin destino usa AMBOS.
- `/publicar [ambos|opuro|opol]`: PUBLISH explícito; permite cambiar el destino.
- Prevalece la última elección directa según message_id Telegram, no por el
  orden en que terminaron las solicitudes de almacenamiento.
- Sin elección, apertura anunciada + cierre acreditado + material sustantivo
  producen PUBLISH/AMBOS, authorized=true, explicit=false y
  authorization=ANNOUNCED_DEFAULT_AND_DIRECT_CLOSE. No inventar `/publicar`.
- Una elección directa produce authorized=true, explicit=true y
  authorization=DIRECT_MODE_COMMAND. La salida incluye control_item_ids.

Los registros usan el marcador reservado existente, seguido del comando real y
JSON con policy=publish-ambos-v1, package_id y message_id. La apertura agrega
notice_message_id mayor que message_id. Sólo el receptor autenticado puede
introducirlos; rechaza órdenes reenviadas e inyección del marcador.

## Validación y compatibilidad

Selector: `tools/telegram/default-publication-policy.mjs`. Exige READY, textos
íntegros por tamaño/SHA-256/UTF-8 y sin duplicados; el Motor exige además revisión
exacta, originales verificados, coherencia, maestros y FILES_VALIDATED/LISTO.
Los controles no son fuentes editoriales ni autorización de imagen.

El último elemento almacenado debe ser el cierre acreditado: una fuente que
llegó entre la reserva del cierre y el sellado bloquea, no publica a escondidas
ni se convierte silenciosamente en borrador. Fallos de acuse, registro, quota o
integridad bloquean la publicación por defecto. No sellar sin registro de cierre
confirmado; no reintentar operaciones con resultado incierto.

Paquetes READY anteriores nunca se promueven retroactivamente. El selector
conserva su elección histórica; la automatización no inicia nuevas escrituras
para ausencia histórica de elección (LEGACY_PRESERVED). Un paquete abierto antes
del cambio requiere elección directa o iniciar una nota nueva, no hereda la
política por un simple `/estado` o `/nuevo` que responda ALREADY_OPEN.

El guard y su límite de 20 elementos no se modifican. Apertura y cierre consumen
dos lugares, y cada orden de modo/imagen consume el suyo; máximo 18 fuentes si
no hay otras órdenes. Un paquete sólo de controles no es una nota válida.

La idempotencia Publisher mantiene SHA-256 de
`package_id:revision:DESTINO:draft-v1`, prefijado `tg_`. Publicar una sola vez
mediante publicar_nota_opmx con confirmar_publicacion=PUBLICAR, sin cambiar
claves ante timeout. No afirmar PUBLISHED, visibilidad pública o aviso SENT sin
la evidencia correspondiente.

## Pruebas reproducibles

`node --test tools/telegram/default-publication.test.mjs`

Son pruebas locales/VM del selector y Code nodes exactos; no demuestran una
publicación real. La activación y pruebas n8n se registran por separado en el
estado operativo, con versiones y limitaciones.
