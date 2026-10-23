# OPMX Social Distribution Engine — Arquitectura v1.0

Estado: DISEÑO
Fecha base: 2026-10-23

## Objetivo
Distribuir una nota ya publicada por el Publisher a múltiples plataformas sin comprometer la publicación editorial si una red falla.

## Arquitectura lógica
INPUT (Publisher o formulario de prueba)
→ NORMALIZE INPUT
→ VALIDATE CONTRACT
→ PREPARE SOCIAL ASSETS
→ PLATFORM ROUTER
→ ramas independientes
→ NORMALIZE RESULTS
→ CONSOLIDATED RESULT

Ramas:
- X
- LinkedIn
- Google Business Profile
- Facebook
- Instagram
- Threads
- TikTok
- YouTube
- WhatsApp Channel

Patrón por rama:
SHOULD_PUBLISH? → PRECHECK → PUBLISH → VERIFY → SUCCESS / FAILED.
Si está deshabilitada o no es automatizable: SKIPPED.

## Desacoplamiento
Publisher y Social son workflows n8n separados. Operativamente formarán una sola cadena, pero no deben fusionarse en un workflow gigante. Social sólo se dispara después de una publicación válida y recibe un contrato explícito.

## Datos mínimos
- TITULO_SEO
- SUBTITULO
- URL_OPURO
- URL_OPOL cuando exista
- IMAGEN_SOCIAL
- targets habilitados

## Media
Varias APIs necesitan una URL pública recuperable. Se contempla un Social Media Staging desacoplado de WordPress. La opción técnica definitiva debe validarse antes de implementación.
La imagen original es inmutable. Cualquier variante (por ejemplo 1:1 para YouTube) es derivada.

## Resiliencia
El fallo de una plataforma no cancela las demás. Resultado consolidado: SUCCESS, PARTIAL_SUCCESS o FAILED según resultados individuales.

## Seguridad
Credenciales exclusivamente en n8n/gestor de secretos. GitHub sólo contiene nombres lógicos, requisitos y documentación; nunca secretos.

## Pendiente de cierre
- API/autenticación vigente de Threads.
- Revalidación de APIs/permisos de todas las plataformas al implementar.
- Media staging definitivo.
- Contrato Social v1.0 final.
- Política de reintentos/idempotencia.
- Observabilidad y registro de IDs/URLs de posts.
