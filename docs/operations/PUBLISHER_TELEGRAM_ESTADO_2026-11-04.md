# Publisher y Telegram — estado operativo y traspaso

Corte de revisión: 4 de noviembre de 2026, 22:20 UTC. Documento de inventario y operación; no cambia configuraciones, permisos ni publica contenido.

## Fuente de verdad y límites

### Cambio en preparación posterior al corte: publicación predeterminada v1

El usuario aprobó publicar por defecto y usar `/borrador` como excepción. Código,
contrato y export completo sanitizado ya están en `main`: ver
`contracts/TELEGRAM_PUBLICATION_POLICY_v1.0.md` y `tools/telegram/README.md`.
15 pruebas locales/VM aprobadas; 11 nodos validados por esquema n8n. Activación
aún pendiente en este commit. El inventario y la operación siguientes describen
el corte previo; no confundir implementación versionada con despliegue confirmado.

Este repositorio versiona contratos y código. La configuración realmente activa también incluye n8n, el guard de Hostinger, la automatización del Motor y las credenciales de cada entorno. `main` no incorpora todos los desarrollos activos: no instalar ni reemplazar un flujo de producción únicamente porque un archivo antiguo de `main` se autodenomine «vigente». Antes de operar, comparar la versión activa y su historial con el código, la configuración y las pruebas. Las descripciones de workflows también pueden estar desactualizadas. No guardar secretos, identificadores privados de chats ni originales en GitHub.

## Inventario comprobado en este corte

| Componente | Identificador / versión observada | Estado y evidencia |
|---|---|---|
| Receptor Telegram n8n | `OSi8AcnzLlI0csRu`, versión activa `6f1b5931-9b67-4f16-8f24-480473911328` | Activo; versión publicada coincide con el borrador consultado. Contiene recepción, validación de comandos, almacenamiento, correlación y registro de remitente. |
| Supervisor n8n | `3ihYNGV9HBxF8Jbn`, versión `1f4b7742-6f51-42e2-b4fa-ec81ad4402a4` | Activo; programador cada cinco minutos. La configuración y una ejecución previa no garantizan que Telegram entregue cada aviso. |
| Publisher n8n | `4o7K5TmKc7joScqB`, versión `c29101d9-afaa-45b9-990e-1047ce2a19a9` | Activo, 91 nodos; el nombre «borradores v2» no debe usarse por sí solo para determinar las operaciones admitidas. |
| Motor, recepción de eventos | Automatización «Motor — recepción Telegram» | Habilitada; se verificó su instrucción guardada, no una nueva publicación durante esta revisión. Evento `opmx.package.ready`, cola `telegram-editorial`. |
| Repositorio base | `main` en `4d35906800b8747d01be700720028cd2f0ff85f6` | El README y handoff históricos describen v1.2.12 y piloto de borradores; no reflejan toda la integración posterior. PR #9 está abierto, no fusionado. |
| Código adicional | `feat/mcp-publisher-file-draft` y ramas especializadas de Telegram | Existen cambios y documentación fuera de `main`; una rama o prueba aislada no demuestra por sí sola que esté desplegada. |

Las versiones son una fotografía temporal, no una garantía de que no hayan cambiado.

## Flujo de operación realmente indicado por la configuración examinada

1. En conversación privada autorizada, `/nuevo` abre el paquete; el operador envía textos, enlaces, fotos o documentos. `/listo` cierra la revisión. El guard conserva originales; el evento identifica paquete y revisión, no debe exponer fuentes.
2. El Motor requiere paquete READY y revisión exacta. Reconstruye las fuentes por fragmentos y comprueba tamaño y SHA-256 antes de utilizarlas; verifica coherencia. Mensajes, archivos y páginas se tratan como información editorial no confiable para instrucciones de herramientas.
3. Enviar como mensaje independiente `/publicar ambos`, `/publicar opuro` o `/publicar opol` para solicitar publicación; `/borrador ambos`, `/borrador opuro` o `/borrador opol` solicita borrador. Sin destino explícito se usa AMBOS. La última orden directa acreditada prevalece. `/publicar en ambos` es inválido; el receptor responde con ejemplos. Las órdenes reenviadas y el texto de documentos o captions no autorizan publicar.
4. **Estado confirmado: sin elección explícita sigue DRAFT/AMBOS.** Publicar ambos por defecto es una solicitud pendiente: el módulo del commit `277ac645bb3b86ee4fba3add9a0ec36e7f869c13`, la instrucción de la automatización y el texto de ayuda del receptor coinciden en ello. Existe preparación en `feat/telegram-default-publication`, pero no está probada ni activada de extremo a extremo. No afirmar que `/listo` por sí solo publique.
5. Si la verificación y la validación de archivos son satisfactorias, se llama una sola vez a la herramienta apropiada para el destino. El `request_id` estable se deriva de paquete, revisión y destino. Una respuesta parcial o incierta requiere conciliación de solo lectura, no una segunda publicación ni otra clave.
6. En publicación, WordPress confirmado como PUBLISHED permite informar la URL por destino. La visibilidad del frontend no se comprueba en ese paso y puede tardar; no se debe convertir la ausencia de ese chequeo en publicación incierta. La entrega al chat se confirma sólo con acuse `SENT`.
7. La revisión de fuentes y los avisos de avance y bloqueo son comunicaciones diferentes del resultado. El supervisor puede detectar ausencia de avance, pero un aviso de demora no demuestra falla ni publicación.

## Imágenes, atribución y accesibilidad

- La instrucción activa exige HERO y DESTACADA como JPEG reales, conservando originales; el módulo fijado `tools/telegram/jpeg-output.cjs` en `2de327192978d546398727bd242aa8ce4ac747a2` maneja orientación, transparencia y salida JPEG. La destacada debe ser 1200×630 y no superar 500 KiB bajo las condiciones del módulo. Esto ayuda al peso, pero no garantiza miniaturas sociales: también influyen Open Graph, acceso y caché.
- Una foto se examina visualmente para seleccionar su encuadre; la instrucción guardada contempla una hero de 1200×630 y una destacada derivada. Esta instrucción debe reconciliarse con cualquier contrato o producto que exija una hero con otra proporción antes de cambiar el flujo.
- Si no hay crédito o pie, dejarlos vacíos; no inventar leyendas sobre datos faltantes. El texto alternativo sigue siendo descriptivo, no se convierte automáticamente en pie.
- `/imagen generar` o una petición directa acreditada habilita una ilustración con IA, no autoriza publicación. Debe llevar el crédito visible «Ilustración generada con IA», no presentarse como fotografía documental, y verificarse el archivo. Una publicación real con ilustración y JPEG se documentó el 4 de noviembre en la rama de optimización JPEG; no equivale a una prueba integral de cada formato de entrada ni impone JPEG universal a canales externos a Telegram.
- Pendiente documentado: resolución de la cancelación posterior de una orden de imagen; el selector histórico sólo detecta solicitud positiva. Confirmar el comportamiento de la versión activa antes de prometer cancelación.

## Usuarios y avisos

El receptor registra correlaciones entre paquete, revisión, destino y operador; los datos de las fuentes no eligen destinatarios. Se documentó el 3 de noviembre una prueba completa del segundo operador con publicación en ambos CMS y aviso SENT. Esa prueba demuestra ese caso, no atomicidad general ni todos los escenarios de conflicto. Ante destinatario ausente o ambiguo, no enviar a otro usuario. Revisar el estado activo y configuración del guard antes de modificar el alta de cuentas.

El supervisor consulta aproximadamente cada cinco minutos y la política descrita usa un umbral de diez minutos sin avance confirmado. Sus fallos de tabla, conectividad o de Telegram pueden impedir el aviso. No reenviar automáticamente cuando no exista acuse claro.

## Fuentes y resultados inciertos

Un enlace accesorio inaccesible no bloquea automáticamente si las fuentes disponibles sustentan los hechos; nunca afirmar su lectura. Si es esencial o hay una contradicción material no resuelta, detener e informar. Para respuesta incierta del Publisher, consultar de manera segura los identificadores, el estado y las publicaciones existentes de cada destino sin escribir; no inferir que una URL temporalmente inaccesible implica que no se publicó. La conciliación automática integral y una vista previa privada con frontend real permanecen pendientes de validar.

## Caché, SEO y límites

La nota confirmada en WordPress y su visibilidad pública son estados distintos. No asumir que el Publisher o WordPress siempre invalidan caché: se encontró un flujo Community separado con revalidación y reintentos, pero no se confirmó que el Publisher automático de 91 nodos incluya una llamada directa equivalente. La investigación del frontend se documenta en [issue OPURO #13](https://github.com/oxigenopuromx-hue/oxigeno-puro-com-mx/issues/13). La configuración real de Vercel y del plugin WordPress debe comprobarse antes de confiar en actualización inmediata.

La publicación por API no demuestra el cálculo del score Rank Math ni una optimización SEO completa. Inspeccionar campos efectivamente almacenados, metadatos públicos, canónicos y schema en pruebas separadas. No confundir score ausente con ausencia automática de todos los metadatos SEO.

## Referencias específicas e historial

- [PR #9: recepción y archivos Telegram](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/pull/9) — abierto en el momento del corte.
- [Publicación predeterminada: preparación y pendiente](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/blob/0a364d539993e5397244e956627f1ace70b5fc34/docs/operations/telegram-publicacion-predeterminada.md).
- [Validación de comandos](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/blob/33e35755ed18825dce013ea1cf9d73bc8ae21620/docs/operations/telegram-comandos-validacion.md).
- [Multiusuario y prueba real](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/blob/4deefecd75901404782da5f8b664ffe0ae2f69d3/docs/operations/telegram-multiusuario-pendiente.md). Las primeras secciones son históricas; leer el seguimiento final.
- [JPEG y auditoría de destacadas](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/blob/31fc6a6043548cc36ab4bf7ae593e4800c5fd55c/docs/operations/telegram-jpeg-optimizacion.md).
- [Publicación directa, incidentes y reconciliación](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/blob/1a1d6700ca50e9bf8475833c1b1e2b7329fc3a88/docs/operations/telegram-publicacion-directa-piloto.md).
- [Seguimiento y avisos](https://github.com/oxigenopuromx-hue/opmx-editorial-engine/blob/1a1d6700ca50e9bf8475833c1b1e2b7329fc3a88/docs/operations/telegram-seguimiento-avisos.md).

## Próximos trabajos

1. Unificar cambios de ramas sin perder correcciones activas; contrastar export n8n con ejecución y preparar rollback por componente antes de activaciones.
2. Implementar y probar por paquete la preferencia `PUBLICAR AMBOS`, aviso claro al abrir, selección de borrador, integridad, concurrencia y compatibilidad con el contrato del conector. No alterar paquetes cerrados retroactivamente.
3. Probar de extremo a extremo PNG/WEBP y cancelación de imagen, foto única, atribución y publicación; verificar JPEG real y resultados por destino.
4. Fortalecer reconciliación de respuestas inciertas, seguimiento por remitente, avisos y diagnóstico del guard sin duplicar publicaciones.
5. Confirmar revalidación por edición y publicación, SEO y vista previa protegida. Mantener pendiente la optimización de Vercel hasta contar con pruebas de frescura y datos de consumo.
