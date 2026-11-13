# Issue24 — aceptación durable y consulta del resultado

Fuente candidata preparada el12nov2026. Este documento no acredita activación ni una publicación de prueba. La causa concreta del corte del transporte original sigue sin atribuirse a un timeout específico.

## Evidencia que motiva el cambio

El escritor hijo37855 trabajó con éxito de23:04:52.957 a23:06:04.143UTC (71.186s solamente para borradores). El seguimiento registró incertidumbre23:05:50.784 mientras la hija aún procesaba El Liberal. El MCP mantenía la respuesta HTTP hasta completar borradores, publicación, recibo y aviso. El resultado PUBLISH posterior ya quedó conciliado en30; no se repite esa nota.

## Mismo escritor, respuesta breve

El MCP descarga y valida los archivos por la ruta vigente; conserva el payload JSON íntegro con los binarios base64 originales. Antes de invocar al subworkflow existente, calcula su SHA256 y pide una aceptación a Guard. La tabla nueva `opmx_tg_publisher_submissions_v1` registra únicamente identidad técnica, fase esperada, huella, ejecución y acuses; no contiene fuentes, originales, tokens ni contraseñas.

Guard exige binding canónico, propietario o administrador, paqueteREADY/revisión exacta, intentoRUNNING y fenceREADY_TO_WRITE. La inserción se confirma antes de devolver SUBMISSION_RECORDED. Sólo esa primera ejecución continúa el backend; SUBMISSION_REPLAY responde pendiente sin continuar. Un contenido distinto, acuse perdido o errorHTTP nunca habilitan un reenvío. Una caída entre aceptación y continuación puede dejar pendiente el trabajo: no se fabrica un éxito ni se reanuda automáticamente.

El webhook responde DRAFT_SUBMITTED o PUBLISH_SUBMITTED con `result_pending:true`, hash de aceptación, paquete/revisión/request y sin permiso nuevo de escritura. El escritor sigue usando los mismos fences, herramientas, recibos y avisos. Al terminar, registra por separado su resultado y el acuseTelegram; no intenta responder otra vez al HTTP ya atendido. La documentación oficial de n8n describe la continuación de datos tras RespondToWebhook y que sólo su primera respuesta se utiliza: https://github.com/n8n-io/n8n-docs/blob/main/docs/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook.md . Antes de activar debe comprobarse además con un webhook aislado en esta instalación.

Las revisiones históricas ordinarias conservan la ruta síncrona sólo ante SUBMISSION_SYNC_REQUIRED explícito: binding/propietario/revisión verificados, cero intentos y submissions, sin decisión ni closure de recuperación, fenceREADY_TO_WRITE y scopeEDITORIAL derivado del lector autoritativo. No hay fallback por ausencia de binding, HTTP fallido, LITERAL, recuperación o intento modernoQUEUED.

## Contrato de consulta del Motor

La herramienta existente `leer_paquete_telegram_opmx` conserva su inventario y agrega opcionalmente `publisher_result`, leído después de su autorización existente y dentro de la misma transacción. No usa runtime-observer ni realiza lecturas/escrituras CMS. Un recibo histórico nunca prueba disponibilidad actual.

Campos de un resultado final:

```json
{
  "schema": "opmx.publisher-submission-result.v1",
  "status": "WRITER_RESULT_CONFIRMED",
  "package_id": "paquete original",
  "revision": 8,
  "request_id": "request canónico original",
  "phase": "PUBLISH",
  "destino": "TODOS",
  "slug": "slug-original",
  "submission_hash": "SHA256 de aceptación",
  "receipt_hash": "SHA256 del recibo canónico auténtico",
  "historical": true,
  "targets": [
    {"destination": "OPURO", "post_id": 100, "slug": "slug-original", "status": "publish"},
    {"destination": "OPOL", "post_id": 101, "slug": "slug-original", "status": "publish"},
    {"destination": "LIBERAL", "post_id": 102, "slug": "slug-original", "status": "publish"}
  ],
  "telegram_notice": "SENT",
  "current_cms_state": "NOT_CHECKED",
  "public_visibility": "NOT_CHECKED",
  "retryPermitted": false,
  "write_authorized": false
}
```

Otros estados: SUBMISSION_PENDING, SUBMISSION_UNCERTAIN o SUBMISSION_UNCONFIRMED. No incluyen targets ni receipt_hash confirmado. `telegram_notice` puede ser SENT, UNCERTAIN o NOT_RECORDED y siempre es independiente del recibo de escritura. No se fabrican URLs desde los IDs.

El Motor ejecuta `validatePublisherSubmissionOutcome` del módulo nuevo `publisher-submission-policy.mjs`, fijado a un commit. Exige scope original, fase esperada, destinos e IDs completos, y recalcula el hash del recibo a partir de la serialización canónica. Si la aceptación inicial se perdió, se conserva submissionHash=null en el expected; no se inventa un hash. El recibo final de todos los destinos permite cerrar el intento una sola vez con la capacidad original aunque el avisoTelegram no esté confirmado. SENT sólo acredita entrega técnica del aviso.

La política propuesta permite como excepción acotada doce consultas cada15segundos hasta180segundos en la misma ejecución del Motor, manteniendo capacidad privada; no crea otra automatización o suscripción. Un PUBLISH no se completa con su DRAFT intermedio. La lectura histórica DRAFT sigue disponible si luego hubo una publicación explícita, pero el cierre no puede congelar un claimPUBLISH todavía en curso.

## Alcance y verificación preparada

Builder final sobre MCP137nodos agrega14nodos (151total),74operaciones; conserva el subworkflow escritor, credenciales, envíoTelegram y routing existente. Las entradas al Respond final pasan por registro del resultado; las llamadas síncronas conservan su forma de respuesta.

Pruebas puras preparadas: store67, adapter/builder41, política13; total121nuevas, sin red/CMS/Telegram. Revisión independiente de identidad, fase intermedia, replay, commit perdido, legado y cierre superada. El probeCode preparado ejecuta los cuerpos reales de aceptación, reporte y manifest con fixtures,15comprobaciones y cero I/O. La activación y ensayos de instalación se documentarán por separado.

Reversión requiere restaurar conjuntamente MCP anterior, manifiesto de escritores compatible y ZIP Guard previo. No borrar la tabla de aceptaciones ni los recibos; son evidencia e impiden atribuir permiso a una respuesta perdida. No revertir publicando borradores ajenos de n8n.
