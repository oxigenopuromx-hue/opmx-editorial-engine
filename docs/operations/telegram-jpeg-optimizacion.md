# JPEG para imágenes en paquetes de Telegram

Fecha: 3 de noviembre de 2026 (hora de Ciudad de México).

El Motor activo recibió instrucciones para crear ambas salidas editoriales como JPEG reales; el original se conserva. El módulo `tools/telegram/jpeg-output.cjs`, fijado en la automatización al commit 2de327192978d546398727bd242aa8ce4ac747a2, normaliza orientación, transparencia y color, convierte a JPEG progresivo y comprueba la salida. La destacada debe estar encuadrada a 1200 × 630 y pesar como máximo 500 KiB; se ensayan calidades 85, 80, 75 y 70, y si el límite no se cumple se notifica el fallo en lugar de enviar un archivo incumplido. La hero conserva el encuadre y dimensiones definidos editorialmente. El límite es una meta operativa, no una garantía de previsualización en WhatsApp: intervienen Open Graph, accesibilidad, rastreo y caché.

Validación local: cuatro pruebas Node sobre PNG transparente, WebP, dimensiones incorrectas y entradas inválidas. La automatización tiene guardada la instrucción de ejecutar este módulo y detenerse si falla. No se ha verificado todavía una publicación real desde Telegram con PNG/WEBP/imagen generada, ni existe una validación universal del Publisher que impida PNG por otras vías.

El paquete tg_6db63b3c569d559e5d70379499f3f57fb2305b1a revisión 6 falló por indisponibilidad del entorno de ejecución; no hubo un error de formato. Se comprobó una nota del mismo tema ya publicada en OPURO, post 9874, con hero JPEG 1440 × 1080 de 292871 bytes y destacada JPEG 1200 × 630 de 154437 bytes. No se reenvió el paquete, para evitar duplicado.

## Revisión de imágenes publicadas — 4 de noviembre

Se revisaron 46 publicaciones en OPURO y 46 en OPOL desde el 1 de noviembre, con sus respectivas imágenes destacadas. Se detectó un PNG superior a 500 KB: post OPURO 9882, imagen 9886, 1200 × 630, 780506 bytes. Se creó el adjunto JPEG 9900, de 89952 bytes y las mismas dimensiones, y se asignó como imagen destacada; se conservó el adjunto original y la hero 9884. Se confirmó el cambio con lectura del post y el `og:image` y `twitter:image` públicos apuntaron al nuevo JPG. La nota equivalente de OPOL ya tenía una destacada JPG de 103645 bytes; su página pública apunta a ella en los metadatos sociales. Las cachés de clientes externos podrían tardar en actualizarse. El workflow auxiliar se dejó sin nodos de escritura activos.
