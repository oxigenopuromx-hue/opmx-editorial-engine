# Revisión14 — instrucción histórica activa

12nov2026. Issue19 reabierto para aceptación de la recuperación real. El usuario conserva el control de publicación.

## Diagnóstico

Paquete tg_dd8ff15fbc93b83b3e579c4266d5aea4bcf2be7b, READY14, siete elementos. confirmed_correction CREATE/LITERAL/TODOS, preview_hash842ea5b29f86f040072011a39c934ed2c2d5814997fd04cff9e65489b6c7080a.

Motor5062acc3-bacc-8330-a931-7dac6d0d53a4 (22:26:18–22:28:20UTC) sí reconoce LITERAL y aprueba integridad/coherencia. Bloquea porque el item ti_499936aa3b91ce9f1e5193c0c368531bfe1ee218,48bytes, texto «La publicación va tal cual, sin agregarle nada», sigue activo como fuente sin acreditación. SHA256ffe39c3ed4641eda6411a0940e22344e2ac738b076bdf69d9771cfe15c0c6a2f. No fue otro rechazo por En breve o SEO. Resultado del Motor: ATTEMPT_BLOCKED antes de ACK/CMS. La orientación inicial de DEV omitió retirar ese mensaje histórico.

DEV sólo leyó inventario/resultado: no reabrió, descartó, confirmó, reclamó ni publicó el paquete, ni volvió a descargar el cuerpo/fotos.

## Exclusión autenticada existente

package-store.mjs permite descartar STORED bajo lease de recuperación, protege prior.controls y conserva texto, SHA, bytes y reserva; avanza revisión. recovered-policy coteja contra snapshot. La vista marca REMOVED. Guard literal y chooseMotorPolicy omiten DISCARDED sin exigir chunks. El modelo no altera inventario ni convierte la instrucción histórica en control.

El operador envía cada comando en mensaje separado y espera respuesta:

```text
/abrir tg_dd8ff15fbc93b83b3e579c4266d5aea4bcf2be7b
/descartar ti_499936aa3b91ce9f1e5193c0c368531bfe1ee218
/opciones crear literal TODOS
/listo
```

Después revisa la retirada del mensaje/destinos en la nueva vista y copia su /confirmar crear con revisión/hash nuevos. No reutiliza la confirmación14. La confirmación inicia la operación autorizada; no requiere otro /listo. Sólo se retira la instrucción de48bytes; se conservan artículo y dos fotos.

## Dependencia corregida

El helper de imágenes del pin63222a1e0f104ee2fae22e9b18b57f2e17486bf6 exigía bytes de todos los TEXT, incluso DISCARDED; packages/chunk sólo entrega STORED. Eso podía bloquear el flujo después de retirar correctamente la instrucción.

Nuevo tools/telegram/image-intent.mjs, commit68134a5b29c43f0ec0dbf83f4c0e7c507c25966b, blob55fb2e7042bc770beae349d6a7f5f6a9117596ee, SHA25673e114d401d889c23e0113d809ad3c081b74f94bad3719f537417576f97d7163. Cambio de dos líneas: valida state y omite DISCARDED antes de recuperar/verificar/interpretar texto. STORED mantiene SHA; estado desconocido bloquea. Se pasa inventario auténtico íntegro, sin filtrarlo en el modelo.

466 pruebas pasan:450 previas +13 del helper +3 regresiones de descarte con proveedores SQL reales. El mensaje histórico sintético48bytes descartado funciona sin Buffer; si sigue activo y falta Buffer bloquea; corromper el original retenido también bloquea. No son pruebas de publicación CMS.

## Instalación

Sólo cambia prompt del Motor6ae9095256948191b33f1e023fbfbf8b:45848bytes, SHA25691c3e9878c348ee13bbc24604c82ee0b33ffcf1b21d9fc326bd7d2cf46d60df6. Imagen fijada a68134a5b…; selector/compilador literal conserva e7fae39e62d8b233c379198d24c516fe4b580071. Relectura exacta y enabled/título/horario/conversación/entorno iguales. Se omitió triggers para conservar READY/preview. Prioridad pública: MOTOR_DISCARDED_PRIORITY.txt. No se publica el prompt privado completo.

Guard/n8n/contratos/credenciales sin cambios. ZIP vigente continúa opmx-guard-literal19.zip SHA256518721f59f5803885e852d99f6e884901031310974e6865775074ee91d92c163. Este helper se carga por el Motor; no necesita nueva carga ZIP.

No se hizo una publicación positiva del paquete desde DEV ni se liberó automáticamente su intento14. Issue19 queda abierto hasta resultado real del operador tras retirar la instrucción y confirmar nueva vista.

Reversión de este seguimiento: restaurar el prompt anterior, su pin de imagen63222a1e… y retirar la prioridad DISCARDED. Guard y n8n no cambian. Esa reversión reintroduce el bloqueo del helper histórico ante descartados y no autoriza reintentos.
