# Cierre de #18 — 13nov2026 UTC / 12nov CDMX

Estado: desplegado y comprobado. Fuente: commit `287e65b9eb0947faeed9f94325a3b6b7d1fdd634` de `feat/telegram-reopen-recovery`.

Guard `opmx-guard-atomic-close18.zip` quedó **Actual / Se ha completado** en Hostinger el 12nov a las 20:27:00 CDMX. SHA-256: `e76550d99baa33d0b4839487d13040422f4f6805d7018238a3d5949a5b6d79aa`. Después se activó el receptor existente `159d7833-1848-47f2-bfce-db9792751a78`: 52 nodos y el mismo grupo original de 51 miembros.

## Resultado operativo

`/listo` reserva el control y sella, o produce la vista de recuperación, en la misma transacción autenticada. Un fallo revierte control, revisión y cuota. Un reintento o acuse perdido reutiliza el recibo durable; no ocupa otro espacio ni reenvía resultados inciertos. Se comprueban actor, lease, revisión, último control, bytes y SHA-256. El diagnóstico distingue elementos, bytes por paquete y capacidad global. Se conservan las rutas anteriores.

La capacidad real respondió HTTP200 `CAPACITY_OBSERVED`: 145 de 1000 paquetes, 52,900,939 de 134,217,728 bytes en la segunda lectura, cero reservas pendientes. Ambos contadores de riesgo de cierre legado dieron **0**. El inventario puede cambiar por operación normal mientras se comprueba.

La contabilidad global de paquetes y bytes coincide. Hay dos espacios históricos conservados correspondientes numéricamente a dos filas DISCARDED vacías; la política del parche del 10nov excluyó expresamente recalcular descartes históricos. Se registra `matchesCurrentRules:false`, no se falsea una igualdad ni se modifican contadores. La lectura no localiza esa diferencia por paquete. No hay riesgo de cierre legado detectado ni agotamiento global.

Se adopta retención conservadora: preservar originales, historial, cancelados y recibos; no purgar automáticamente, no liberar cuota sólo por publicar y no elevar límites. La cancelación general continúa en #28 como pidió el usuario.

## Comprobación

- 92 pruebas dirigidas pasan. Regresión:1280 pasan y7 fallos idénticos a la base; cero fallos nuevos.
- n8n38102: código final del receptor,8 casos y30 aserciones, cero I/O.
- n8n38115: POST vacío al cierre nuevo devuelve HTTP400 `not_confirmed`, sin escritura.
- n8n38116: HTTP200 `RUNTIME_OBSERVED`, cinco versiones/pins correctos y ningún escritor n8n activo al corte. Esto no afirma que haya terminado un Motor histórico.
- Matriz de aceptación: [MATRIZ_ACEPTACION.md](MATRIZ_ACEPTACION.md), con evidencia histórica de reapertura, materiales, control de operadores/revisiones, descarte, publicación parcial y respuestas perdidas.

El incidente original `tg_9aeb…` quedó CANCELLED por orden expresa posterior:19 originales preservados; no hay autorización pendiente para publicar sus dos temas. No se publicó ni editó ninguna nota real como prueba. Un único Motor y suscripciones READY/vista previa conservados.

## Reversión

Restituir Guard21 (archivo completo versionado en `issue21-semantic-preflight-20261113`) y publicar receptor `db33c542-8fa0-48a9-848d-49aea32ae75e`. Los contratos previos siguen disponibles. Los artefactos de esta entrega incluyen ZIP completo y evidencia JSON, sin secretos.
