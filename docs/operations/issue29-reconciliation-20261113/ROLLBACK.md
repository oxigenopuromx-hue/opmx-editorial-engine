# Reversión de issue29

La cancelación dirigida es autoridad persistida. Una reversión de código no puede retirar la orden del usuario ni rehabilitar LIBERAL para Simey.

## Estado que debe conservarse

Mantener `opmx_tg_destination_cancellations_v1`, su evidencia/hash, `opmx_tg_recovery_audit_v1`, intentos revocados, fences y ledgers históricos. No eliminar ni truncar tablas, deshacer auditorías, restituir tokens, borrar bindings o inventar otra revisión/request. No transformar el resultado mixto en una publicación completa.

Conservar WordPress sin cambios: OPURO10493 y OPOL3515 publicados; LIBERAL393 con el estado observado y su identidad original. Este release no restaura ni recrea el post en papelera. Una reversión tampoco debe hacerlo.

## Guard

Después de persistir la cancelación, **no desplegar Guard31 ni otro binario anterior que ignore el registro de cancelación**. Podría recuperar la autorización original TODOS o conceder una escritura tardía. El ZIP anterior se conserva como evidencia y referencia de archivos; no es una reversión productiva segura de la nueva autoridad.

Si Guard29 falla, mantener los escritores cerrados y desplegar una corrección compatible que conserve:

- La tabla y validación completa del registro de cancelación.
- La denegación de LIBERAL para ese paquete en decisiones, vista, CREATE, medios, UPDATE y consumo de entregas.
- Las comprobaciones de paquete/revisión, pins de escritores y fences.
- Los registros durables de freeze y sus tokens revocados.

La denegación ante MySQL o evidencia inaccesibles debe permanecer. No usar un flag ambiental o un cambio manual de estado como sustituto de conciliación.

Base preservada para comparar archivos: `opmx-guard-blocker-diagnostics31.zip`, SHA256 `bbbd1e46cf4d5d930eca2d769866704f2bd98d6f640bcde86abdbc1efd85e323`, 212023 bytes y 87 archivos. Guard29 conserva 82 archivos idénticos y el mismo manifiesto de escritores. El release29 aprobado es `opmx-guard-issue29-reconciliation.zip`, SHA256 `a86b41d24792266f8270cdce750f27d818a42532bb51eecba7f1254dcca3af31`, 221553 bytes y 89 archivos.

## Monitor administrativo

Antes de la activación29, la versión activa era `cac1f08f-fff4-44ec-bd81-ed2f123287c8`,16 nodos; el candidato es `602e9c32-8a18-40bc-b131-04058c280b90`,18 nodos. Puede restaurarse el grafo previo del monitor si es necesario, conservando íntegro Guard29 y su autoridad de cancelación. La reversión del monitor puede devolver avisos históricos genéricos; no concede autorización de escritura ni justifica reintentar la entrega.

No borrar `DELIVERY_CANCELLED_RECONCILED|<hash>`, diagnósticos31, acuses o evidencias de publicación30 para limpiar la interfaz. Si una persistencia fue incierta, comprobar el registro exacto antes de cualquier nueva inserción o supresión.

## Operaciones e incertidumbre

Ante COMMIT incierto de la cancelación, usar `/v1/telegram/destination-cancellations/observe`. No repetir `cancel` para averiguar qué ocurrió. Para freezes inciertos, inspeccionar los registros durables mediante la comprobación administrativa correspondiente; no volver a reclamar el intento ni reabrir barreras por SQL.

La lectura `recovery-readiness` no crea una revisión. Si IA o Morena permanecen READY tras el freeze, eso es compatible con el contrato: el siguiente paso es `/abrir` auténtico desde Telegram. No fabricar un recibo, una sesión, un evento, una confirmación o una key alternativa para completar una reversión.

Antes de reactivar cualquier escritor o monitor, verificar de nuevo la versión/huella, la cancelación persistida, la denegación de LIBERAL, los estados originales del CMS y el cierre de intentos históricos. Registrar las fechas y los acuses reales en `release.json`; este documento no constituye un acuse productivo.
