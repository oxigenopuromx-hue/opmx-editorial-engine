# Entrada automática OPURO — operación v1

Estado: activa en n8n; creación de borradores OPURO probada con fixture sintético el 2026-11-01. La publicación pública y Social no forman parte de esta entrada.

## Recursos operativos

- Proyecto personal: OXÍGENO PURO <oxigenopuromx@gmail.com>, raíz, sin carpeta.
- Workflow: https://n8n.oxigenopuro.com.mx/workflow/4o7K5TmKc7joScqB
- Trigger: `Entrada automática protegida`.
- Versión activa inicial: `c6ec4283-becb-4a1f-b83d-730ea2073934`.
- Webhook: https://n8n.oxigenopuro.com.mx/webhook/opmx-automatic-opuro-draft-v1
- Autenticación: n8n User Auth OAuth2, requiere permiso de ejecución. POST anónimo comprobado: 401.
- Recuperación de sólo lectura: workflow `C4hk6fQQomueYC8f`, publicado; no libera ni reintenta.
- Guard desplegado en publisher.oxigenopuro.com.mx. El Motor no necesita su secreto: sólo n8n usa la credencial ya existente.

Se usa la conexión oficial ChatGPT → n8n. No desplegar el servidor experimental MCP Node ni configurar otro proveedor OAuth para utilizar esta entrada.

## Entrega desde el Motor / Work

Antes de ejecutar, consultar detalles del workflow para confirmar su trigger y versión. El archivo MASTER conserva el contrato editorial vigente del repositorio: no alterar CONTROL_EDITORIAL para hacer pasar la validación.

Enviar mediante la herramienta oficial de ejecución n8n:

```json
{
  "workflowId": "4o7K5TmKc7joScqB",
  "executionMode": "production",
  "triggerNodeName": "Entrada automática protegida",
  "inputs": {
    "webhookData": {
      "method": "POST",
      "body": {
        "request_id": "IDENTIFICADOR_ESTABLE_DE_16_A_128_CARACTERES",
        "CREAR_EN": "OPURO",
        "PUBLICAR": false,
        "master": {},
        "hero_file": {"base64": "BYTES_DEL_ARCHIVO_HERO_EN_BASE64"},
        "featured_file": {"base64": "BYTES_DEL_ARCHIVO_DESTACADO_EN_BASE64"}
      }
    }
  }
}
```

El MASTER vacío y los marcadores del ejemplo no son ejecutables: reemplazarlos con el paquete aprobado y los bytes de los dos archivos. Para pruebas usar executionMode=manual y exclusivamente fixtures sintéticos o contenido cuya prueba esté autorizada.

Los archivos deben estar accesibles al entorno que llama: leer los adjuntos o archivos autorizados y convertir sus bytes a base64. No enviar una URL temporal en lugar del binario, ni pegar manualmente HTML en WordPress. No afirmar transferencia automática de adjuntos desde un chat que no haya leído los archivos. PNG/JPEG/WebP admitidos; el preparador limita cada cadena base64 a 14,000,000 caracteres. El flujo completo sólo se validó con PNG sintético pequeño; límites altos y transporte desde otro chat requieren comprobación real.

El MASTER OPURO debe contener GUTENBERG_ENRIQUECIDO_FINAL, metadata y categorías vigentes, Hero {{OPMX:HERO_OPURO}} y destacada {{OPMX:DESTACADA_OPURO}}. El validador heredado también exige la clasificación OPOL del paquete aunque se seleccione sólo OPURO. Mantener ambas clasificaciones como exige ese validador.

request_id es estable para la misma entrega y sólo admite A-Z, a-z, 0-9, guion y guion bajo. No generar uno nuevo para eludir un duplicado o una respuesta incierta. PUBLICAR=true y OPOL/AMBOS están bloqueados por esta entrada.

## Resultado y errores

La herramienta devuelve executionId; consultar esa ejecución del mismo workflow e incluir el nodo `Resultado consolidado OPMX`. El éxito final debe ser status=SUCCESS, mode=DRAFT, summary.opuro=DRAFT y un post_id_opuro válido, con edit_url_opuro. Una ejecución iniciada no confirma borrador terminado.

Si existe el slug, el flujo se detiene antes del guard y los medios. Si una escritura o reporte seleccionado falla, se consulta guard + WordPress y se exige conciliación manual; ese informe no equivale a éxito editorial. No hay autorización de reenvío automático. Otros errores de validación o taxonomía detienen el flujo sin conciliación automática. La recuperación no comprueba los archivos byte a byte ni ofrece snapshot consistente.

No llamar al Publisher manual simultáneamente para el mismo slug: ese flujo no participa en este guard. El control de la nueva entrada no excluye otros publicadores ni ediciones externas.

## Evidencia

- #108: paquete sintético completo, reserva durable, Hero 9679, destacada 9680, draft 9681. Readback verificó Gutenberg literal, slug, título, autor, categoría, etiquetas, subtítulo/crédito y Rank Math. Media readback verificó metadata por rol.
- #109: replay del mismo paquete detenido en consulta de duplicados; no nuevas cargas ni reserva.
- #110: POST vacío sin credenciales al webhook activo rechazado con HTTP 401.
- #111 / hijo #112: lectura guard + CMS de la identidad del draft; postId 9681 coincide, medios reportados 9679/9680, retryPermitted=false. No verifica bytes de medios.
- 77 pruebas locales Node; SDK validado con 48 nodos. Advertencias de credenciales del SDK corresponden a placeholders; la instalación usa credenciales existentes y no creó secretos nuevos.
- Objetos sintéticos de pruebas permanecen como draft / medios de QA. Nunca publicarlos.

## Fuentes reproducibles

- `OPMX_ENTRADA_AUTOMATICA_OPURO_v1.json`: export sanitizado, inactivo y sin credenciales para revisión.
- `OPMX_ENTRADA_AUTOMATICA_BORRADORES.n8n.js`: fuente SDK.
- `tools/mcp-publisher/build-automatic-draft.mjs`: generador a partir de la referencia guardada.
- `node tools/mcp-publisher/build-automatic-draft.mjs --check`.
- `node --test tools/mcp-publisher/*.test.mjs`.

Los exports no son una invitación a activar otra copia: reutilizar el workflow operativo identificado arriba y asignar credenciales sólo si se instala en otro entorno.
