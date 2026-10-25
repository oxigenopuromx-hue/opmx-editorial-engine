# Social v1.0.1 — hardening y pruebas offline

2026-10-25. Base revisada: `3a7de1f` en `main`.

## Motivo

La inspección del código, no una ejecución de producción, detectó en v1.0:

- Ejecutar un child workflow que sólo tenía Webhook trigger.
- La simulación llegaba primero al staging WordPress y podía subir archivos.
- Threads aún leía `media.original.alt_text`, pero el contrato vigente usa
  `media.social` con archivo manual posterior al Publisher.
- El copy de Threads generaba `\\n` literales en vez de saltos de línea.
- Conexiones de varias plataformas pasaban por el nodo terminal de X y faltaba
  consolidación final de nueve resultados.
- Reintentos genéricos sobre POST no idempotentes; posibilidad de duplicación.
- Un `id` de container podía confundirse con un post ID al mezclar respuestas.
- Resultado remoto declarado sin readback; credenciales y almacén no configurados.
- La fecha de limpieza se contaba desde upload, no desde distribución terminada.
- `manifest.json` y un documento seguían apuntando Publisher v1.2.11, aunque
  README/handoff ya registraban v1.2.12. Sólo se corrigen punteros documentales.

## Solución acotada

- Nuevos exports completos v1.0.1 **offline-preflight**. Los v1.0 se conservan
  históricamente y no deben activarse ni tratarse como rollback operativo.
- Triggers de subworkflow, nueve ramas terminales y Merge append de nueve inputs.
- Validación real con JSON Schema 2020-12 (Ajv empaquetado en los Code nodes).
- Revisión técnica de contrato v1.0.1; la versión wire de entrada sigue en `1.0`.
  `source_site` obligatorio se alinea con el gate y la decisión OPURO_ONLY ya
  vigentes. Salida exige cada plataforma exactamente una vez.
- Separación de `SKIPPED/DRY_RUN`, `SKIPPED/MANUAL_REQUIRED` y `FAILED/LIVE_BLOCKED`.
- No hay nodos HTTP/WordPress ni bypass configurable del gate de publicación real.
- Plan de asset valida firma/hash sin modificar binario ni inventar ID/URL públicos.
- No se elige infraestructura ni se crean credenciales.

## Evidencia

35 pruebas Node aprobadas; Code nodes de los JSON ejecutados en VM sin red;
compilación de schemas; comprobación reproducible de exports; audit npm (incluye
devDependencies): 0 vulnerabilidades reportadas. `git diff --check` limpio.

**No probado:** importación/ejecución en n8n nativo, uploads WordPress, OAuth,
llamadas sociales, deduplicación persistente, permisos ni publicación/readback.
Publisher y maestros editoriales permanecen byte por byte sin cambios.
