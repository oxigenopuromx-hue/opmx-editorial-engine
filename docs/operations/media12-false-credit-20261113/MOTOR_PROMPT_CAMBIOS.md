# Corrección del prompt del Motor — imagen y diagnósticos

Preparado localmente; no instalado por este agente. El baseline `ISSUE31_MOTOR_AFTER.txt` permanece intacto.

- Elimina la instrucción final contradictoria que ordenaba enviar códigos legados5–11. La codificación antigua sólo conserva progresos0–4; todo bloqueo nuevo usa el catálogo específico2**40 y su ordinal real. La lectura histórica del backend no cambia.
- La revisión ordinaria se comunica sólo si pasó integridad/coherencia. Un fallo utiliza diagnóstico específico, sin convertir un error de herramienta en una discrepancia SHA inventada.
- Refuerza la regla existente: crédito/leyenda vacíos son válidos para una fotografía ordinaria. La ausencia genérica de autor, procedencia o EXIF no acredita IA ni una composición dudosa. `IMAGE_ORIGIN_UNCLEAR` exige indicios concretos que cambien el uso editorial.
- Sustituye las órdenes genéricas de fallo de imagen por los códigos de herramienta, generación, lectura, formato, dimensiones o recorte realmente observados.
- La continuación manual aplica las mismas reglas que READY automático. Sólo una orden administrativa expresa y la herramienta real pueden devolver `UNACKNOWLEDGED_ATTEMPT_RECOVERED` o `BLOCKED_UNWRITTEN_ATTEMPT_RECOVERED`; el segundo se limita a CREATE EDITORIAL y al gate completo del servidor. La capacidad sólo satisface la exigencia de capacidad del mismo intento, sin otro inicio ni permiso CMS por sí sola.
- Conserva las ramas LITERAL/UPDATE, las autorizaciones de modo/destino, fuentes/SHA, la clave estable, los pins, la validación y el cierre.

El diff exacto está en `MOTOR_PROMPT.diff`; tamaños y hashes en `MOTOR_PROMPT_CHANGE.json`; comprobaciones en `MOTOR_PROMPT_CHECKS.json`.
