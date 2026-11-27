# Predeterminado AMBOS y aviso de Telegram — 27/11/2026

Los paquetes nuevos se abren con `publish-ambos-v4`: AMBOS = OPURO y OPOL. Una orden explícita de destino prevalece; `TODOS` sigue incluyendo LIBERAL y HORIZONTE. La política original se conserva al abrir un paquete anterior.

## Hallazgo

El receptor activo ya anunciaba AMBOS y guardaba aperturas v4. El selector versionado y las instrucciones fijadas del Motor también mantenían ese predeterminado. El parser genérico del receptor todavía resolvía un comando sin argumento como TODOS; se usaba para reconocer órdenes y para redactar su confirmación. El almacenamiento acreditado usaba el selector versionado correcto, pero el aviso podía decir TODOS aunque el paquete v4 seleccionara AMBOS.

El paquete `tg_5378aea9edd837ae08cefef25c96fdea951f288e` (Bodega Nacional de Arte) sí se entregó en cuatro medios. Su apertura es v4 y conserva una orden autenticada `/publicar TODOS`, item `ti_d0b4ee9edcbf07adc3e806a6eca68c0daa8ab3da`, SHA-256 `e61a94057d8c15dca00c34afdc9b34262db3a1272ef91f415c6613cf18437c79`. La revisión confirmada 11 seleccionó TODOS. Sus publicaciones 11294/4200/606/148 pertenecen a esa autorización explícita; este ajuste no las modifica.

## Cambio

Los tres parsers genéricos del receptor usan AMBOS. La confirmación de una orden se calcula con el mismo selector versionado que usa el guardado y con `context.session_policy`, conservada por el resolutor. Una política desconocida produce un aviso sin inventar destinos. Se preservan las políticas históricas v2/v3 y los destinos explícitos.

Sólo cambian los nodos Code Normalizar entrada Telegram, Resolver paquete Telegram y Confirmar operación de paquete Telegram. Las conexiones, credenciales, órdenes adicionales del #55, cierre, materiales y rutas de escritura se conservan. No requiere cambiar Guard ni reiniciar el Motor.

## Aceptación

13 pruebas Node aprobadas con el código real de los tres nodos: reproducción del aviso antiguo, comandos publicar/borrador, defaults v1/v2/v3/v4, destinos explícitos y combinaciones, política ausente, controles indirectos y preservación de las otras rutas. Ejecución nativa aislada 101301: ocho casos, todos aprobados; cero llamadas externas, mensajes o publicaciones. Utilidad de QA restituida.

Versión del receptor preparada y comprobada: `624aeb3b-d459-4120-aaa9-1f46db0d4b12`. La activación se comprueba en el registro del cambio. Sin GitHub Actions.
