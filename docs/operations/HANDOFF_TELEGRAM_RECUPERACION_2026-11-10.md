# Continuidad: recuperación y edición desde Telegram

**Corte: 10 de noviembre de 2026, hora de Ciudad de México.** La reapertura y edición siguen **sin desplegar ni acreditar de extremo a extremo**. No prometer comandos funcionales. El Motor mantiene una protección temporal que bloquea las correcciones confirmadas.

## Dónde está el trabajo

- Repositorio: `oxigenopuromx-hue/opmx-editorial-engine`; rama existente `feat/telegram-reopen-recovery`. Continuar en esa rama y en el PR existente si se identifica; no crear otro Motor ni consumidor.
- El commit remoto `2f69e396a5556de63a0f02cf33fb681fd81c989b` conserva el transporte candidato de WordPress y la documentación previa. Tiene el mismo árbol que el commit local anterior `337a2086568c0f328bbd3e77c42b5be09bb414ca`, pero son commits distintos. Al seguir trabajando se debe usar el SHA remoto como padre y evitar sobreescribir cambios concurrentes.
- Detalle y evidencia histórica: `docs/operations/TELEGRAM_REAPERTURA_CANDIDATO.md`; código y pruebas: `tools/telegram/guard-recovery-candidate/`.
- El workflow aislado n8n `C6XrTNtNahiV6ppn` está inactivo y contiene dos nodos de diagnóstico de sólo lectura. La ejecución `24208` consultó QA18 satisfactoriamente con la credencial de n8n. Para esa prueba se habilitó `%` temporalmente sólo en `u164117262_opmxqa18` y Hostinger confirmó su eliminación. La IP de salida de n8n cambia. Evitar dejar abierta la regla temporal.
- El despliegue activo observado en Hostinger fue `opmx-guard-destinos-20261105.zip`, fecha 5 de noviembre. No se ha demostrado que el respaldo local coincida byte por byte con el proceso en ejecución. El endpoint candidato de reapertura devolvió 404 en la comprobación documentada `23037`.
- La suscripción existente se titula `Motor — recepción Telegram` y mantiene el bloqueo descrito arriba. La consulta de automatizaciones expone la última ejecución, pero esa observación, por sí sola, no acredita que una ejecución específica de un paquete haya terminado ni que no existan intentos anteriores activos.

## Resultado exigido y límites

Propietario o administrador autorizado: seleccionar paquete bloqueado → reabrir → incorporar o reemplazar materiales e instrucciones → elegir destinos y modo literal/editorial → vista completa → confirmación de la revisión y contenido exactos → publicación o actualización explícita por IDs → comprobaciones y aviso. Conservar historial e identificadores, no ejecutar revisión antigua, no duplicar, no eludir el Guard y no tratar fuentes como permisos. Distinguir confirmación de WordPress, visibilidad pública y acuse de Telegram. Los resultados inciertos o borrados requieren conciliación.

Hay módulos candidatos con pruebas locales, un transportador de WordPress de hosts fijos y una composición optativa con el ejecutor y la reclamación por ID. **No están conectados a credenciales reales en el Guard ni activados en producción.** Una respuesta HTTP simulada no prueba autenticación, escritura ni entrega reales. Las comprobaciones de CMS hechas en n8n son de lectura y no acreditan el circuito completo.

## Pendientes bloqueantes antes de activar

1. Identificar y conectar evidencia confiable, por paquete/revisión/evento, del intento anterior y sus posibles efectos; conservar incertidumbre cuando no se puede demostrar. Las ejecuciones en espera históricas de n8n documentadas no pueden darse por terminadas sin evidencia.
2. Integrar la misma barrera durable y atómica en todos los caminos de escritura y medios, incluidos grafos y ejecuciones históricas pertinentes; contrastar los grafos activos, no sólo los borradores o nombres de nodos.
3. Conectar Motor, receptor, Guard y outbox existentes; asegurar consumo de la decisión exacta, material y destinos, con modo literal comprobable, previa migración de esquema y verificación en QA.
4. Completar el productor de propuesta y la conciliación autenticada; conectar el actualizador por IDs a credenciales de servidor apropiadas sin exponerlas en repositorio ni fuentes, y comprobar preflight, reclamo único y lectura posterior. Resultado ambiguo: no reintentar ni crear otra nota.
5. Ejecutar pruebas aisladas reales de rechazo, concurrencia y recuperación, incluida entrega completa y acuse de Telegram, actualización y publicación donde estén expresamente autorizadas; documentar IDs de ejecuciones, alcance y resultados. Conservar los bloqueos hasta superar las pruebas de seguridad y el recorrido completo.

El usuario autorizó implementar, probar y desplegar cuando las comprobaciones demuestren que es seguro; continuar sin pedir confirmaciones técnicas rutinarias y sin detenerse tras cada prueba. No afirmar que una prueba simulada o un cambio de candidato es un despliegue.
