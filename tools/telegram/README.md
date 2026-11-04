# Telegram — publicación predeterminada

Política: `contracts/TELEGRAM_PUBLICATION_POLICY_v1.0.md`.

- Selector puro: `default-publication-policy.mjs`.
- Helpers del receptor: `default-receiver.mjs`.
- Generador mecánico de export completo y operaciones: `build-default-receiver.mjs`.
- Migración acotada de la instrucción privada del Motor: `patch-motor-default.mjs`.
- Pruebas: `node --test tools/telegram/default-publication.test.mjs`.
- Regenerar: `node tools/telegram/build-default-receiver.mjs`.

Los JSON de `workflows/telegram/` son completos e importables pero desactivados.
Por seguridad, omiten IDs de credenciales y sustituyen la lista privada de
usuarios por un error deliberado; configurar usuarios autorizados y credenciales
antes de utilizarlos. No activar una importación paralela al receptor actual.
No son sustitutos de la versión nativa para un rollback exacto con credenciales.

El generador usa la referencia exacta sanitizada del receptor activo previo,
no reconstruye el Publisher. Al desplegar operaciones se conservan sus listas
privadas y se reutiliza la credencial HTTP ya configurada. Los siete nodos nuevos
y las conexiones se aplican al receptor existente; Publisher no cambia.

Para rollback restaurar/publicar la versión nativa anterior del receptor y
revertir sólo las ocho sustituciones del prompt, fijando el selector histórico
al commit original. Coordinar ambos componentes; no degradar paquetes con
policy=publish-ambos-v1 a la automatización antigua, que debe bloquearlos.
No guardar el prompt completo, datos de chats u originales en GitHub.
