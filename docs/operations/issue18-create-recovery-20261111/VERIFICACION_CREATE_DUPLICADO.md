# Issue 18 — recuperación CREATE y conciliación del paquete real — 11nov2026

## Resultado de la incidencia /listo
El paquete tg_086014c198ded6762a2a826fb4018227a7388217 llegó a READY19 con una decisión CREATE/EDITORIAL/TODOS confirmada. La lectura privada devuelve la huella confirmada ec22bb2d0808408fa66d1bb58dc27edd4758c3ab4540063bc72ac59b513e030b. La entrega anterior de vista y su confirmación se conservaron; no se pidió reenviar materiales.

Se verificaron por bytes y SHA256 los trece textos y el JPEG original de 191940 bytes. chooseMotorPolicy ejecutado con el inventario y buffers reales devuelve PUBLISH, autorizado explícitamente, TODOS y EDITORIAL. La revisión de fuentes fue acusada por el canal fijo como REVIEW_REPORTED/SOURCES_VERIFIED. El MASTER y ambos JPEG preparados obtuvieron FILES_VALIDATED, bytesVerified=true, estado LISTO, destino TODOS; no se llamó al escritor.

## Duplicado encontrado antes de escribir
Una consulta autenticada independiente comprobó que la misma nota ya está publicada en los tres CMS con el slug diputados-aprueban-presupuesto-egresos-2027-ejecutivo:

| Destino | ID | Estado CMS | Evidencia n8n |
| --- | --- | --- | --- |
| OPURO | 10438 | publish | 32949 |
| OPOL | 3477 | publish | 32957 |
| LIBERAL | 307 | publish | 32958 |

Título: Diputados aprueban Presupuesto 2027 y lo envían al Ejecutivo. Estas publicaciones existentes no se atribuyen al intento READY19. No se crearon copias ni se editaron esos IDs. Las lecturas CMS no equivalen a una comprobación de visibilidad en los tres frontends.

El intento reclamado había quedado sin su capacidad privada después de una interrupción del contexto. No se reintentó iniciar_intento, no se inventó una capacidad ni se abrió la barrera mediante SQL. La nueva recuperación administrativa comprobó bajo bloqueo READY19/RUNNING y AWAITING_DECISION, además de la confirmación exacta, e invalidó atómicamente la capacidad anterior. Ejecución32961: UNACKNOWLEDGED_ATTEMPT_RECOVERED. Después, bloquear_intento devolvió ATTEMPT_BLOCKED/reopenPermitted=false/retryPermitted=false. No hubo ACK de decisión, medios ni escrituras CMS desde este intento. No se presenta como ATTEMPT_COMPLETED ni como una publicación nueva exitosa.

## Despliegue y comprobaciones
- Guard activo: opmx-guard-unacknowledged-recovery.zip. SHA256 5e888aef47c523ffc26ddce051676cc21821e3dacfdd54add62d1758a2e36534. Hostinger mostró Se ha completado / Actual.
- Recuperación administrativa: POST /v1/telegram/attempts/recover-unacknowledged, detrás de la autenticación existente. Sólo administrador configurado, identidad privada coincidente, revisión/evento/huella exactos, intento RUNNING y barrera AWAITING_DECISION. No inicia otro intento ni concede escritura. READY_TO_WRITE, WRITING, HISTORICAL_WRITING y RECONCILING se rechazan.
- 470 pruebas locales pasaron. Arranque síncrono y ensamblaje del ZIP pasaron; un fallo de inicialización conserva cerradas las rutas de escritura.
- Receptor activo 0bfda1b6-a4de-48fd-9f63-d4c9d8a76127: 52 nodos, cero nodos QA18, sin retención manual ni de resultados.
- MCP conserva la versión76ef3bfe-db0a-4fb4-996c-ad703ab1639a documentada en el release anterior. No se modificó su grafo en este tramo.
- El diagnóstico temporal7IDUF9PeHQ5v331Z volvió al GET original de tres nodos, inactivo, saveManualExecutions=false y sin retención de éxitos/errores. Versión restaurada c01ae4d7-bde9-450a-95d9-20ede61bae41.
- Se mantuvo el único Motor y su suscripción; no se creó otra automatización.

## Alcance
La incidencia real acredita recuperación de materiales, selección, entrega/confirmación de vista y revisión privada; también se comprobó en producción la recuperación de un intento interrumpido antes del permiso de escritura y su bloqueo seguro por duplicado existente. La creación pública nueva desde READY19 no se ejecutó porque habría duplicado la nota ya publicada. El ensayo QA anterior de actualización literal de un borrador OPURO está documentado aparte; no se extrapola a todos los destinos. El issue general permanece abierto para criterios amplios no acreditados, incluido CREATE LITERAL. No reenviar este paquete para intentar demostrar una publicación.
