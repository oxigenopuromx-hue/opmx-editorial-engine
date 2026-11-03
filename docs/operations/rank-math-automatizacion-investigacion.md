# Rank Math: metadatos y puntuación en Publisher

Fecha: 2026-11-03. Investigación; aún no hay solución de puntuación desplegada.

## Evidencia de producción

La ejecución 1578 de Publisher, nota elecciones intermedias (OPURO 9850, OPOL 3011), escribió y leyó de vuelta rank_math_title, rank_math_description y rank_math_focus_keyword en ambos CMS; las validaciones previas a publicación pasaron. En las dos páginas públicas se comprobaron título, descripción, canonical, index/follow y NewsArticle. Esta verificación corresponde a una nota, no a todo el histórico ni prueba indexación en buscadores. No se leyó ni confirmó rank_math_seo_score en esa ejecución.

El flujo de Publisher activo 4o7K5TmKc7joScqB escribe los tres metadatos y exige su coincidencia. La escritura de score no aparece en sus nodos de Rank Math. No deducir que todos los scores son N/A.

## Hallazgos de Rank Math

Rank Math documenta un proceso de recalcular scores masivo desde Database Tools, ejecutado en el navegador para entradas publicadas con palabra clave; no usarlo automáticamente para cada nota, ni afirmar que una llamada PHP aislada calcula el score. https://rankmath.com/kb/seo-score-not-available/

La herramienta oficial rank-math/analyze-post-content existe desde Rank Math Free 1.0.274, pero el código upstream declara que recopila datos para que el agente evalúe las pruebas, ya que el motor de puntuación se ejecuta en el cliente. Es de solo lectura; no se demostró que calcule y persista el score oficial. https://github.com/rankmath/seo-by-rank-math/blob/master/includes/abilities/content-analysis/class-analyze-post-content.php

El análisis batch carga analyzer.js y prepara entradas para el analizador: https://github.com/rankmath/seo-by-rank-math/blob/master/includes/modules/database-tools/class-update-score.php

## Plan sujeto a pruebas

1. Identificar versiones y configuración real de Rank Math en cada CMS y verificar si existe capacidad para leer scores por entrada; no instalar ni actualizar plugins sin revisar compatibilidad.
2. Probar en un borrador de prueba aislado el analizador oficial incluido en la versión instalada: evaluar si puede invocarse desde un navegador automatizado o un worker controlado, y si el guardado por entrada es compatible con los permisos. Corroborar el score leyendo de vuelta y comparar con el editor para el mismo contenido y versión.
3. Integrar por ID y destino con Publisher de forma idempotente, sin volver a crear/publicar la nota; reportar por Telegram separadamente SEO confirmado, puntuación y error específico, sin falsificar resultados. Verificar los metadatos efectivos en el frontend headless, schema y canonical de cada dominio.
4. Evaluar la optimización editorial y reportar criterios pendientes; no prometer una calificación mínima ni confundir el score con indexación o posicionamiento. No guardar un número supuesto como score.
5. Procesar históricos sólo con alcance y prueba controlados, sin sobrescribir metadatos editoriales existentes y evitando recálculo global en cada publicación. Mantener el trabajo de invalidación de caché pendiente aparte.

No se confirmó que MCP esté instalado, ni que la capacidad calcule o guarde el score, ni se realizó modificación en WordPress, n8n o Rank Math.
