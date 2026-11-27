# Issue 55 — instalación y aceptación

Instalación verificada el 26/11/2026, hora de Ciudad de México. Comando adicional activo en Telegram. El #62 de imágenes interiores sigue instalado.

## Release instalado

- Guard PR25: `084258dcc332a72fb196d7943a8f96222bdd6ff3`.
- Corrección de enlaces y builders, Guard PR26: `db59e37bcab3dd849a156f53d6d69e5acbe3df8a`.
- Rama de despliegue: `release/production`, integración existente de Hostinger. Sin GitHub Actions.
- Receptor: `OSi8AcnzLlI0csRu` / `e1464379-af6e-4a95-ac90-53e02fef8e7f`, 63 nodos.
- Ejecutor adicional: `lgh8mpDLuJHTVCKk` / `130b5033-3389-40dc-bd5c-0d8e47529a8c`, 312 nodos.
- Consulta adicional: `qewz99eB3DQeqEZo` / `7e4d24ed-1920-4454-858c-f9912a69e014`, 40 nodos.
- Shared: `4o7K5TmKc7joScqB` / `00ce6967-4d3b-463c-bd5e-804c68bb533a`, 287 nodos.
- MCP: `bnzVMNkZuGO1GQCZ` / `ba21b431-f3d8-4278-9c69-ae24789eb492`, 203 nodos.
- Observador runtime: `2HBn1RnSYgyxuHgE` / `2540fb3f-2266-4edd-bd4e-4cd9eff251d7`, 14 nodos.

Las seis huellas de los escritores publicados se contrastaron con el manifiesto Guard. El receptor también coincide con su huella. El comprobador usa la versión activa real, aunque algún otro flujo conserve un borrador distinto. Ver [release-active.json](release-active.json) y [graph-acceptance.json](graph-acceptance.json).

## Pruebas

- 111 pruebas unitarias aprobadas: contratos, acceso, HTTP, LITERAL, roles, posiciones, snapshots, clasificación, comandos y código real de los nodos.
- MariaDB aislada: 17 grupos del archivo, 99 del recorrido adicional y 7 de importación histórica. Incluye 12 cargas simultáneas del mismo blob y 8 reclamos por destino, con un solo permiso de ejecución.
- Importación histórica: acceso rechazado antes de consultar CMS, contenido congelado y LITERAL, deduplicación física y rechazo de cambios durante la lectura.
- `npm test`: sintaxis de 124 archivos de runtime y regresiones existentes aprobadas. Importaciones transitivas del runtime comprobadas.
- n8n 98026: 12 perfiles (cuatro medios × LITERAL/EDITORIAL/FROZEN_COPY), de cero a dos interiores; doce MASTER alterados rechazados. Sólo datos sintéticos, sin llamadas Guard, publicaciones ni mensajes reales.
- n8n 98098: cuatro comandos adicionales, siete entradas indirectas rechazadas, título escapado y enlaces completos en el intérprete real. Cero mensajes o llamadas reales. Detectó y corrigió la ausencia del global URL en Code.
- Preflight nativo de sólo lectura: OPURO 97491, OPOL 97493, LIBERAL 97492, HORIZONTE 97483. Autores y catálogos verificados con las credenciales existentes.
- Canario Guard 98078: ruta adicional autenticada responde con rechazo de acceso a una solicitud inexistente; no crea publicaciones.
- Runtime final 98101: HTTP 200, seis versiones coincidentes, páginas completas y ningún escritor activo durante el corte.

La integridad de subida nativa de interiores a los cuatro CMS procede de la aceptación instalada del #62. Para #55 se reutilizan esos mismos adaptadores y credenciales; las nuevas transiciones Guard se probaron con base de datos real aislada y semántica nativa. No se publicó una noticia nueva como prueba de este release.

## Caso histórico y duplicados

El paquete `tg_f72b511330f552bb94f46b178db279c173944894`, revisión 6, conserva OPURO 11085 y OPOL 4033. HORIZONTE 136 ya había sido entregado el 23/11; no debía volver a publicarse.

El canario real 98081 recuperó el archivo histórico, contrastó fuentes y detectó `ADDITIONAL_TARGET_EXISTS` con HORIZONTE 136 en estado `publish`. No reabrió el paquete ni creó otra nota. URL existente:
https://horizontedecalifornia.mx/lecturas/la-paz-foro-pesca-permisos-acuacultura/

## Cierre operativo

Se pausó el mismo Motor antes del cambio y se comprobó ausencia de ejecuciones. Se publicaron las versiones fijadas, el receptor se activó al final y la observación posterior confirmó las seis versiones. El mismo Motor `6ae9095256948191b33f1e023fbfbf8b` quedó habilitado con su prompt de 60107 caracteres idéntico al previo.

La utilidad temporal de lectura `41kQE94ZJVfarH2n` se restituyó a sus dos nodos originales, inactiva y sin conservar registros temporales de pruebas. La consulta adicional mantiene registro de éxito/error desactivado. El ejecutor conserva ejecuciones con error para diagnóstico.

Los formatos históricos ambiguos, cambios de origen y resultados inciertos detienen nuevas escrituras para revisión. No hay reinicio automático de reclamos consumidos. El Publisher manual del #56 permanece diferido; esta entrega corresponde al flujo Telegram.
