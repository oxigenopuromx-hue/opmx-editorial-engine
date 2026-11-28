# Continuidad de Publisher Telegram — 27/11/2026

Corte de lectura: 19:48–19:50, Ciudad de México (28/11/2026 01:48–01:50 UTC). Verificación nueva después del handoff. No se repitieron publicaciones, recuperaciones, confirmaciones ni eventos.

## Resultado y alcance autorizado

Los issues #62 y #55 están cerrados como completados. Se consultaron sus cuerpos vigentes, contratos, aceptaciones y los PR Guard #24, #25, #26 y #29, todos integrados. El siguiente trabajo indicado por el handoff ya estaba instalado: no se requiere implementar otra variante ni reactivar históricos.

#62 mantiene CREATE EDITORIAL/LITERAL, Hero/Thumbnail/Destacada e interiores nativos; #55 mantiene la propuesta y confirmación de un único destino adicional con texto y archivos conservados. No se crean borradores preventivos en todos los medios. #56 permanece diferido, y los demás casos históricos de #28 requieren su decisión particular.

Esta verificación confirma continuidad, versiones y estados actuales. No sustituye los recorridos de aceptación originales ni añade una prueba real de publicación.

## Producción comprobada

| Lectura | Evidencia | Resultado |
| --- | --- | --- |
| Estado de eventos autenticado | n8n 103164, HTTP 200 | Una suscripción ACTIVE vigente; 388 entregas SENT; backlog.missingDeliveries=0 |
| Runtime autenticado de Guard | n8n 103178, HTTP 200, RUNTIME_OBSERVED | Seis versiones coincidentes; páginas running/waiting/new completas y vacías |
| Huellas de los seis escritores | Código writer-release-contract.mjs y manifiesto de Guard release/production | Seis graphHash y seis versionId coinciden usando los grafos activos, no los borradores |
| Motor único | Automations 6ae9095256948191b33f1e023fbfbf8b | Habilitado, prompt de 60107 caracteres; no se modificó |
| Receptor | OSi8AcnzLlI0csRu | Activo, versión 624aeb3b-d459-4120-aaa9-1f46db0d4b12 |
| Utilidad de lectura | 41kQE94ZJVfarH2n | Restituida exactamente a nodos, conexiones y settings originales, inactiva, dos nodos |

388 es el total observado en este corte, no una expectativa fija. Cero entregas ausentes no certifica éxito editorial de cada paquete histórico. RUNTIME_OBSERVED no acredita terminación del proceso ChatGPT ni autoriza recuperaciones.

Guard release/production apunta a 5ff47707bfbc0ee48d7ebfbb4b3d550abbe7ecd8. El diagnóstico de backlog nuevo respondió en producción. No se verificó en este corte el SHA del proceso Node mediante el panel Hostinger: se distingue la cabeza Git del código servido. No hubo despliegue nuevo ni cambio del mecanismo Hostinger.

El workflow Mt7ts2EGPbyaTC2o conserva un borrador distinto de su versión publicada; se comparó exclusivamente la versión activa 5e0e1875-2996-4b8c-99aa-e4d07f7d8822, de 58 nodos. No se publicó su borrador.

### Escritores activos y huellas

| Workflow | Versión activa | SHA-256 del grafo |
| --- | --- | --- |
| bnzVMNkZuGO1GQCZ | ba21b431-f3d8-4278-9c69-ae24789eb492 | f0300b59b84a6b03499effa121c22a35c00e628238882dae9672db1cbc2605ab |
| Mt7ts2EGPbyaTC2o | 5e0e1875-2996-4b8c-99aa-e4d07f7d8822 | 121dae57c374586b850619ade4f2e8dcb0dca8c0556f2f430d8335700067ffee |
| 4o7K5TmKc7joScqB | 00ce6967-4d3b-463c-bd5e-804c68bb533a | db723a582f5e0839bbdc5eaa2738c705d3564825b0345608b6a578b91f2af1f1 |
| qBmLf0DmcMSfuWvm | 355d529f-8bd6-4f58-8ba4-4cd19d8ac658 | ea76f7528313f0ed11c9041a582c50e296962e6d45cc3c84fd3586b8f0d51c8d |
| C4hk6fQQomueYC8f | 1eca0334-b3af-45d9-ac80-341e99a09faa | 84e7d2bd08cb6cafa512ba505ac6e71468dc8f14e64405278c03439f599bd318 |
| lgh8mpDLuJHTVCKk | 130b5033-3389-40dc-bd5c-0d8e47529a8c | 9287858f8ac7e7dcaa2348d7561975ac66fc2727b693092c73156807cb7741ed |

## Paquetes y CMS

La lectura de Archivos confirmó:
- tg_ef7373285e6eb4c28841241e2e2d58cec179a376: CANCELLED, revisión 8 y cuatro materiales conservados. No se intentó otra cancelación.
- tg_7e86541dfd428f4547bdfec666a5fb55916f660e: revisión 7, recibo WRITER_RESULT_CONFIRMED, misma solicitud tg_1153789a668d0a6a8ca931ba129228ae990c0b8becb33e64fc48e81d0d8f5315 y aviso histórico SENT.
- tg_5378aea9edd837ae08cefef25c96fdea951f288e: revisión 11 y recibo original intactos.

El recibo histórico de Bodega registra publish en cuatro destinos. Eso no es el estado actual: la lectura autenticada independiente n8n 103180 consultó exclusivamente GET con campos de estado y confirmó:

| Nota | CMS | ID | Estado actual |
| --- | --- | --- | --- |
| Bodega Nacional de Arte | OPURO | 11294 | publish |
| Bodega Nacional de Arte | OPOL | 4200 | publish |
| Bodega Nacional de Arte | LIBERAL | 606 | draft |
| Bodega Nacional de Arte | HORIZONTE | 148 | draft |
| Albanese | OPURO | 11319 | publish |
| Albanese | OPOL | 4220 | publish |

Los seis GET devolvieron HTTP 200 y los slugs del handoff. No se modificaron esos posts ni sus imágenes. READY se interpretó junto con el resultado durable, nunca como trabajo pendiente por sí solo.

## Procedimiento y preservación

Se usaron los conectores de GitHub, Archivos, n8n y Automations. La evidencia y código se recuperaron nuevamente de GitHub; no se dependió de temporales anteriores. La utilidad manual existente de lectura se configuró temporalmente para runtime y seis GET autenticados, se ejecutó y se restauró inmediatamente. No se activó ni se añadió otro consumidor. La utilidad de eventos se ejecutó sin modificarla; la utilidad de reactivación no se ejecutó.

Se validaron los parámetros HTTP antes de configurar la utilidad. El cálculo local de las huellas ejecutó la implementación exacta de writer-release-contract.mjs recuperada del commit productivo contra los grafos activos leídos por el conector. Todos coincidieron. No se ejecutaron GitHub Actions.

No se cambiaron Guard, Motor, receptores, escritores, suscripciones ni CMS. Este cambio registra evidencia documental de continuidad; no requiere transición productiva.

## Referencias

- [Issue62](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/62)
- [Issue55](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/55)
- [Aceptación #62](../issue62-inline-images-20261126/acceptance.md)
- [Aceptación #55](../issue55-additional-publication-20261126/acceptance.md)
- [Contrato adicional vigente](../../PUBLISH_TO_ADDITIONAL_DESTINATION_V1.md)
- [Recuperación de cola](../queue-resume-20261127/acceptance.md)
