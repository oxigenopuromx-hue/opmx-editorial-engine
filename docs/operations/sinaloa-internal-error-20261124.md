# Diagnóstico del bloqueo Sinaloa — 24 de noviembre de 2026

Incidente: https://github.com/oxigenopuromx-hue/opmx-editorial-engine/issues/61

## Incidente y autorización

Paquete `tg_58c600f50923808a4bba1790c42172cc118258bc`, READY revisión 9, seguridad en Sinaloa. Dirección pide identificar la excepción real, corregir el fallo y comprobar intentos/escrituras antes de reanudar, conservando la misma solicitud y evitando duplicados. No atribuir la falla al comunicado dividido sin evidencia.

## Evidencia recuperada — 24/11/2026 CDMX

- PROGRESS_WRITING 14:09:24 y DIAG|INTERNAL_ERROR|INTERNAL_PROCESSING_ERROR|0 a las 14:09:39, según el registro aportado.
- Motor `9aa8077a-ee5c-8320-a84c-e6714291ee2e`, ventana 14:09:21–14:13:02. El resultado final distingue este bloqueo de otra nota sobre contratos del INE que sí publicó. No confundir los IDs de esa otra nota con Sinaloa.
- El resultado retenido del Motor sólo dice error interno, aviso entregado y cierre seguro confirmado. No incluye tipo de excepción, código, stack o módulo/línea. La consulta privada y la vista del chat devolvieron el mismo resumen; no se recuperó una excepción histórica concreta. El código 33 es un fallback definido cuando no se conoce la causa, no prueba por sí solo de una excepción de código.
- Se recuperaron y verificaron íntegramente tamaños/SHA-256 de los cinco TEXT y del caption de imagen: orden /nuevo, enlace Presidencia, comunicado en dos textos de 3,977 y 2,191 bytes, orden /listo y caption Hero. No hay evidencia de que la separación del comunicado haya causado el bloqueo.
- Guard `/v1/telegram/reconciliation/observe`, ejecución n8n **90327**, HTTP 200: **RECONCILIATION_VERIFIED**, OPURO BLOCKED y OPOL BLOCKED, writeAuthorized=false, processTerminationClaimed=false. `writesRolledBack=true` corresponde a la transacción diagnóstica revertida; **no significa que se haya revertido una publicación**. Acredita el resultado del gate de conciliación, no una búsqueda global de duplicados bajo otras solicitudes.
- La consulta SQL QA 90302 fue rechazada por su credencial; es una falla de esta comprobación auxiliar y no la excepción histórica de Sinaloa. No se cambiaron credenciales, IPs ni permisos. Se restauraron los flujos diagnósticos usados.
- Lectura final posterior: READY9, seis elementos STORED, sin publisher_result. No se abrió otra revisión, no se emitió un nuevo READY ni se llamó a Publisher para esta nota.

## Corrección acotada instalada: conservar detalle técnico disponible

Se actualizó únicamente el párrafo de diagnóstico del mismo Motor para que el resultado privado de Work conserve paquete/revisión, etapa, última herramienta/ejecución y, si hubo una excepción realmente observada, tipo/código y módulo/línea saneados. Prohíbe mensaje crudo, secretos y fuentes; no envía trazas técnicas a Telegram y exige decirlo si no consta una excepción.

Lectura independiente exacta: 65,446 → 65,526 caracteres; actualización 14:19:21 CDMX. Identidad, habilitación, horario, timezone, selección de entorno y todos los pins conservados. Sin nuevo consumidor ni ejecución histórica disparada por instalar. Esta instrucción mejora el diagnóstico de futuras ejecuciones; **no recupera la excepción perdida ni demuestra corregida la causa de la revisión 9**.

## Pendiente para resolver el incidente

1. Obtener un registro concreto de la herramienta/paso que falló o una reproducción aislada de esa fase con los materiales exactos; si ese registro no existe, mantener explícito el límite en lugar de inventar una causa.
2. Corregir sólo el defecto reproducido y verificarlo sin una publicación de ensayo.
3. Antes de reanudar: comprobar reservas/submissions/intentos y CMS actuales por el circuito autenticado; conciliar cualquier efecto y conservar identidad/solicitud. La ausencia de publisher_result por sí sola no autoriza reintentar.
4. Usar únicamente una recuperación soportada para el estado y modalidad reales; no crear otro paquete/clave ni simular confirmaciones para sortear el intento bloqueado.
5. Acreditar el resultado y cierre del mismo paquete. El incidente permanece abierto; no se ha afirmado reparación de causa raíz.

Relacionado: #24, #31, #32 y #40.


## Cambio exacto del párrafo del Motor

Se reemplazó una única coincidencia del párrafo de conservación de controles, compactando su redacción y agregando la obligación de registro privado. El resto del prompt permanece idéntico. Todos los IDs/pins conservaron su secuencia exacta; lectura independiente del prompt y metadata realizada después de actualizar.

### Texto anterior

```text
Este bloque cambia cómo comunicas un bloqueo comprobado. Conserva íntegramente el único Motor, READY/preview, sus suscripciones, los pins del selector y fuentes, la modalidad, destinos, request_id, decisiones, controles de escritura y cierre del intento. No reabras ni reproceses paquetes históricos por esta actualización. Las continuaciones manuales autorizadas aplican estas mismas reglas editoriales y de diagnóstico, sin rescatar reglas históricas más restrictivas.
```

### Texto instalado

```text
Conserva Motor único, READY/preview, suscripciones, pins, modalidad, destinos, request_id, decisiones, controles y cierre. Esta actualización no reabre ni procesa históricos. Las continuaciones autorizadas aplican estas reglas, no las históricas más restrictivas.

TRAZA EN WORK: Conserva paquete/revisión, etapa y última herramienta/ejecución. Registra sólo tipo/código y módulo/línea de la excepción observada, sin mensaje crudo, secretos ni fuentes. Si no consta excepción, dilo. Código33 no demuestra una excepción. No envíes la traza a Telegram.
```

## Verificación y reversión

- Motor existente: `6ae9095256948191b33f1e023fbfbf8b`.
- Caracteres: 65446 antes, 65526 después; dentro del límite de 65,536.
- Lectura exacta confirmada; ID, título, horario, timezone, estado habilitado, thread y selección de entorno iguales.
- La actualización no es un run ni prueba de captura del próximo error: falta aceptación integral ante una excepción controlada.
- Para revertir, releer el prompt actual y reemplazar únicamente el texto instalado por el anterior si sigue siendo una coincidencia única. No sustituir el prompt completo con una copia vieja, porque podría haber cambios concurrentes.
- No recuperar, reabrir, encolar, publicar ni cambiar request_id al revertir. Los permisos del paquete no dependen de este párrafo.

La causa histórica de Sinaloa sigue sin identificarse. No se cambió su texto, modalidad, imágenes, revisión, solicitud ni estados en CMS.
