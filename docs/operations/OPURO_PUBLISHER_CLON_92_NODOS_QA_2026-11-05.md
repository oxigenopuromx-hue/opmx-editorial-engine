# OPMX Publisher — Clon inactivo de 92 nodos · QA
Fecha de corte: 5 noviembre 2026.

## Resultado verificable
Se creó un workflow independiente en n8n para validar la carga del grafo completo sin tocar el Publisher productivo.

- **Candidato:** `637qP2jabW0DnfX9` — [abrir en n8n](https://n8n.oxigenopuro.com.mx/workflow/637qP2jabW0DnfX9)
- **Versión observada:** `45b90884-6126-4c7a-82e9-547d095d6294`.
- **Estado:** inactivo; `activeVersion=null`.
- **Nodos:** 92, todos **disabled=true**.
- **Credenciales asignadas:** cero.
- **Conexiones:** 133; se trasladaron 132 de la referencia y se sustituyó la arista Categoría→Etiquetas por Categoría→Preflight→Etiquetas.
- **Preflight:** `OPURO — Preflight de colocación (CANDIDATO)`.
- **Lógica preparada:** `Preparar MASTER y binarios`, `Validar y normalizar OPMX MASTER`, `OPURO — Crear borrador Gutenberg enriquecido` y `OPURO — Validar antes de publicar`.
- **Producción:** workflow original `4o7K5TmKc7joScqB`, versión `c29101d9-afaa-45b9-990e-1047ce2a19a9`, 91 nodos, permanece activo, no modificado.

## Procedimiento ejecutado

1. Se validó el SDK oficial y se creó un esqueleto manual/inactivo de un nodo, sin credenciales.
2. Se importaron mediante `update_workflow` los 91 nodos de `workflows/publisher/OPMX_ENTRADA_AUTOMATICA_DESTINOS_v2.json`, deshabilitados y sin credenciales.
3. Se añadió el preflight y se retiró el trigger manual temporal, dejando 92 nodos.
4. Se restauraron 133 conexiones, con el preflight insertado entre la resolución de categoría y las etiquetas.
5. Se preparó procedencia de la intención editorial fuera del MASTER, validación del arreglo de categorías, consulta de ancestros, escritura condicional y readback.
6. Se releyó el workflow: 92 nodos deshabilitados, 0 credenciales, `active=false`, `activeVersion=null`.

## Resultados de QA disponibles
- [GitHub Actions run #8](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/actions/runs/42001373493) — SUCCESS, genera export inactivo de 92 nodos y artifact `opmx-category-placement-candidate-no-activate` (artifact ID `13402163580`).
- n8n QA `oTukmjDFYXfYUhDp` — #5567 jerarquía real; #5576 intención dry-run; #5578 readback sintético; #5595 separación entre orden directa y contenido fuente. Todas SUCCESS.
- WordPress CI descartable, PR frontend #21: runs WordPress Integration #220 y Quality Gates #243 SUCCESS.

## Límites y riesgos pendientes
- **No se ha ejecutado** el clon de 92 nodos con datos. Está totalmente deshabilitado para impedir solicitudes a WordPress, Guard o Publisher, incluso por error.
- Las advertencias n8n de autenticación genérica (PLAIN_GENERIC_AUTH) son esperadas en un clon **sin credenciales**. No insertar credenciales automáticamente ni publicar para silenciarlas.
- La envoltura `EDITORIAL_PLACEMENT` distingue una orden directa del operador de un campo generado desde fuentes, pero todavía carece de una **atestación verificable del guard/identidad editorial**. No tratar `confirmed:true` como seguridad criptográfica.
- Los dos puntos que impiden promoción son: (a) validar orden directa del operador desde el conector/guard existente, y (b) validar HMAC verdadero emitido por WordPress web hacia Vercel. A ello se añade una prueba staging autenticada del workflow completo con rollback.
- Si accidentalmente se publica el clon, podría duplicar la ruta webhook del Publisher vigente. **No publicar ni habilitar nodos sin plan de aislamiento y reversión.**
- La referencia versionada del repositorio no contiene credenciales y el clon tampoco.
- No hubo cambios de DNS, contenido, medios, publicación ni configuración del Publisher activo.

## Próximo punto seguro
Mantener el candidato inactivo. Crear un adaptador de autorización de orden editorial firmado o vinculado a una sesión válida del guard y probarlo con fixtures. Después, en staging separado, conectar credenciales de prueba, habilitar solamente los nodos pertinentes y comprobar preflight → POST WordPress → readback → reversión antes de cualquier promoción.


## Readback final del clon e intento de prueba autenticada (5 noviembre, 09:xx UTC)

Se comparó otra vez la referencia de 91 nodos con n8n. Resultado nativo del workflow candidato:
- 92 nodos, `active=false`, **los 92 deshabilitados**, **cero credenciales**.
- 133 conexiones (las 132 de referencia con una arista sustituida por dos): **0 faltantes, 0 adicionales**.
- Sólo cuatro nodos de la referencia tienen diferencias de parámetros intencionales: preparación del sobre, validador del MASTER, cuerpo de creación OPURO y readback OPURO. Se añade un nodo preflight.
- El Publisher productivo todavía mantiene 91 nodos y versión `c29101d9-afaa-45b9-990e-1047ce2a19a9`, activo.

Se creó además un workflow manual/inactivo de **solo lectura** `2pbjg5UPclZ76dds` para verificar la existencia del borrador técnico previamente autorizado `9924`, usando la referencia a la credencial existente sin mostrar ningún secreto. Ejecución `5600` **SUCCESS**: GET autenticado `context=edit` confirmó `id=9924`, `status=draft`, `slug=""`, categorías `[1]`, `oxpuro_excluded_category_ids=[]`. No hubo escritura.

Para diseñar reversión antes de cualquier POST, se creó el workflow manual de rescate `7QgTXCpqbmj1CmM3`, con control de estado del borrador. **El control de seguridad del entorno bloqueó la asignación de la credencial al workflow que contenía POST**. No se intentó eludir ese bloqueo, no se ejecutó ninguna escritura ni se intentó instalar otra credencial; el workflow de rescate se **archivó**, sin credenciales ni ejecución. No continuar con POST sobre el CMS productivo desde esta conexión.

Esto delimita el bloqueo operativo: se puede validar lectura autenticada y el contrato en WordPress desechable (PR #21 PASS), pero **no** ejecutar desde aquí la escritura autenticada de prueba/rollback ni la firma HMAC desde el proceso WP web. Se requiere un mecanismo de staging/hosting autorizado y seguro, no un bypass.
