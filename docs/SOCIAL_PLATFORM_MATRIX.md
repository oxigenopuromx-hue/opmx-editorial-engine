# OPMX Social Distribution — Matriz de plataformas

Estado: DISEÑO v1.0
Actualizado: 2026-10-23

| Plataforma | Copy / formato aprobado | Automatización v1 | Nota |
|---|---|---|---|
| X | SUBTITULO + línea en blanco + URL_OPURO + IMAGEN_SOCIAL | Prevista | Rama independiente |
| LinkedIn | SUBTITULO + línea en blanco + URL_OPURO + IMAGEN_SOCIAL | Prevista | Rama independiente |
| Google Business Profile | SUBTITULO + línea en blanco + URL_OPURO + IMAGEN_SOCIAL | Prevista | Rama independiente |
| Facebook | SUBTITULO + línea en blanco + URL_OPURO + IMAGEN_SOCIAL | Prevista | Separada de Instagram |
| Instagram | SUBTITULO + línea en blanco + URL_OPURO + IMAGEN_SOCIAL | Prevista | Separada de Facebook |
| Threads | Por cerrar | Prevista | API y formato deben validarse contra documentación oficial vigente |
| TikTok | PHOTO; título TITULO_SEO; descripción sólo SUBTITULO; sin URL_OPURO | Prevista | Rama independiente |
| YouTube | SUBTITULO + línea en blanco + URL_OPURO; derivado 1:1 top-aligned | Manual inicialmente | SKIPPED/MANUAL_REQUIRED mientras Community no tenga vía oficial adecuada |
| WhatsApp Channel | URL_OPURO para link card | Manual inicialmente | SKIPPED/MANUAL_REQUIRED |

## Regla
No inferir capacidades de API por similitud entre productos de una misma empresa. Facebook, Instagram y Threads son ramas y resultados independientes.

## Mantenimiento
Work debe revalidar endpoints, scopes, permisos, límites y requisitos oficiales en el momento de implementación y actualizar esta matriz en cada hito que cambie una integración.
