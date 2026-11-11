# Issue 18: flujo de recuperación y vista previa — 11nov2026
La misma suscripción del Motor `6ae9095256948191b33f1e023fbfbf8b` conserva READY y PREVIEW en `telegram-editorial`. No se creó otro Motor ni se publicó una nota de prueba.

## Ensayo aislado
Paquete `tg_442c77fab2c264e37b2ba110cf86b65a22dc3945`; borrador OPURO **10428**.
Las entradas del receptor fueron sintéticas y explícitamente identificadas como QA18, usando mensajes reales del bot como referencia para verificar respuestas y orden. Esto no acredita una acción humana desde el cliente Telegram.
El JPEG de prueba (27,560 bytes, 1200×630) se subió y descargó realmente mediante Telegram; SHA256 `e9411bee5638c0bd1cd495a4020e4e17c390095fc90445e0ea9a67a7298aca82`. Los originales se conservaron.

| Comprobación | Evidencia |
|---|---|
| Borrador autorizado /borrador OPURO | 10428, request estable `tg_d2b69deb17a4b641997795da36f41a6ddf9880caa4a15876449df66cf086da14`, writer receipt RECORDED, ATTEMPT_COMPLETED |
| Primera reapertura | Revisión7 → OPEN8, conciliación CMS/ledger y snapshot |
| Primera vista | Revisión11; evento SENT una vez, run `ad30dc07-b664-8332-845e-a9c084b14bc5`, entrega Telegram confirmada |
| Defecto descubierto | El adaptador MCP omitía confirmed_correction; READY12 bloqueado antes de CMS, sin duplicar el borrador |
| Conciliación y segunda reapertura | 30268: RECONCILIATION_VERIFIED con ROLLBACK; 30271: reapertura confirmada |
| Segunda vista | Revisión15, run `895a9c15-23c4-8332-86ac-e58d8068929f`, Telegram entregado |
| Confirmación antigua | 30278: revisión11 rechazada mientras la actual era15 |
| Confirmación intermedia | 30348: READY16; 30352: inventario con UPDATE/LITERAL/OPURO y post_id10428; el Motor bloqueó por selector fijado a commit antiguo, sin CMS |
| Política corregida | Pin bc9138f1dc60f838559d385ec4fc20f511089210, UPDATE admitido; ensayo offline con inventario y bytes reales de revisión16 devolvió UPDATE/LITERAL/post_id10428 |
| Tercera vista y confirmación | Revisión19 entregada por run267ebad1-1e8c-8331-99ed-df166c2ae426; confirmación30482 → READY20 |
| Actualización real | READY20, run64f05521-1d18-8331-a936-8cb8022612bd: CMS_UPDATE_CONFIRMED, ATTEMPT_COMPLETED y aviso fijo Telegram confirmado |
| Lectura CMS independiente | 30557: excerpt raw exacto; id/type/slug/status/title/content/featured_media/author/categories/tags/meta idénticos al valor anterior. ID10428 sigue draft |
| Conciliación después del UPDATE | 30558: RECONCILIATION_VERIFIED revisión20, ID10428 DRAFT; ROLLBACK, sin nueva sesión ni escritura |
## Retirada del arnés y activación
Receptor productivo52nodos activo **55b966f6-b695-41a6-a353-3448f3e496c9**; reversión45bebad0-f9e8-45e0-915e-afe5de7a1ea2. El borrador limpio fue restaurado y se comprobó igualdad de código/conexiones/credenciales con la versión ensayada; cero nodos QA18 tanto en el borrador actual como en la versión publicada. saveManualExecutions=false y sin retención de resultados.
El diagnóstico n8n7IDUF9PeHQ5v331Z volvió a su consulta GET original de3nodos, está inactivo y sin retención manual. No se dejó la sesión del ensayo abierta: la confirmación selló READY20. El diagnóstico posterior usa ROLLBACK y no la reabre.
El aviso final Telegram es el mensaje fijo de PROCESS_COMPLETE confirmado por el canal acotado existente; no es una comprobación de visibilidad pública ni un envío de enlaces de edición. El cierre no repite la escritura.

## Versiones activas y reversión
- Guard: `opmx-guard-recovery-update-chain-v2.zip`, SHA256 `615435cab5de2d518d0f9ddeaf1d0b2ec5e8c9826522b35bc89b8c1f19301b23`. Incluye inicialización, cerco, recuperación, propuestas, acuses, ejecutor UPDATE y diagnóstico privado sin secretos.
- MCP: `9c7c0b56-3b19-4219-9aed-4e8787f32c3f`,133nodos. Reversión `3f0147c7-7ac0-449d-9342-f4737277562e`. Su borrador previo fue restaurado. Sólo cambió el adaptador de lectura respecto a esa versión activa.
- Transporte UPDATE: `qBmLf0DmcMSfuWvm`, activo `d04fb5c2-ba36-48f9-9cd4-2958ab1f273e`. Consume trabajo opaco de un solo uso; no acepta destino, ID, payload o URL externos.
- Observador: `2HBn1RnSYgyxuHgE`, activo `b88257e9-7f6d-41e3-bdfd-e2cd40c12c25`. Inspecciona cinco grafos fijos y páginas completas de ejecuciones. No afirma terminación física de ChatGPT.
- Lector CMS: `F4Ybwst2LZfzKyWS`, activo `0bb87412-b517-4d6e-8a1c-426acb6151ef`; GET de identidad y proyección editorial exacta para comprobar UPDATE.
- Borradores y formulario conservan sus versiones cercadas ya registradas en el manifiesto. No se ampliaron dominios de credenciales ni permisos.

## Validación y alcance
453 casos locales pasan, más arranque síncrono y ensamblaje del paquete desplegable. La prueba real cubre una actualización literal de extracto en un borrador OPURO, con conservación del resto de campos comprobados; no equivale a una matriz real de tres destinos o publicaciones públicas.
Las respuestas inciertas y operaciones parciales permanecen bloqueadas. Una confirmación UPDATE no abre los escritores de creación/medios/publicación. La conciliación posterior conserva IDs desde el vínculo inmutable al ledger original.
El issue general permanece abierto para los criterios amplios de aceptación aún no ensayados en vivo. CREATE literal sigue cerrado por falta de un escritor de salida exacta; no se presenta como disponible. CMS confirmado, visibilidad pública y acuse Telegram final son estados distintos. En este ensayo se verificaron CMS y aviso fijo Telegram por separado; no se publicó ni se comprobó visibilidad pública.
