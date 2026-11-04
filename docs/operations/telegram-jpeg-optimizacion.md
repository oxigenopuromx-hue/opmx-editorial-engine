# JPEG para imágenes en paquetes de Telegram

Fecha: 3 de noviembre de 2026 (hora de Ciudad de México).

El Motor activo recibió instrucciones para crear ambas salidas editoriales como JPEG reales; el original se conserva. El módulo `tools/telegram/jpeg-output.cjs`, fijado en la automatización al commit 2de327192978d546398727bd242aa8ce4ac747a2, normaliza orientación, transparencia y color, convierte a JPEG progresivo y comprueba la salida. La destacada debe estar encuadrada a 1200 × 630 y pesar como máximo 500 KiB; se ensayan calidades 85, 80, 75 y 70, y si el límite no se cumple se notifica el fallo en lugar de enviar un archivo incumplido. La hero conserva el encuadre y dimensiones definidos editorialmente. El límite es una meta operativa, no una garantía de previsualización en WhatsApp: intervienen Open Graph, accesibilidad, rastreo y caché.

Validación local: cuatro pruebas Node sobre PNG transparente, WebP, dimensiones incorrectas y entradas inválidas. La automatización tiene guardada la instrucción de ejecutar este módulo y detenerse si falla. No se ha verificado todavía una publicación real desde Telegram con PNG/WEBP/imagen generada, ni existe una validación universal del Publisher que impida PNG por otras vías.

El paquete tg_6db63b3c569d559e5d70379499f3f57fb2305b1a revisión 6 falló por indisponibilidad del entorno de ejecución; no hubo un error de formato. Se comprobó una nota del mismo tema ya publicada en OPURO, post 9874, con hero JPEG 1440 × 1080 de 292871 bytes y destacada JPEG 1200 × 630 de 154437 bytes. No se reenvió el paquete, para evitar duplicado.
