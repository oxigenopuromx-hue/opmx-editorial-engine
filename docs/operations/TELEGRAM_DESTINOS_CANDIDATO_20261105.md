# Telegram y destinos — candidato de análisis, 5 noviembre 2026

No desplegado ni integrado al receptor, Motor o avisos. `main` inicial 3b27a5ad49c83f4c7e64014a12ebecf1ee368078; registro Publisher copiado sin modificaciones desde `feat/publisher-liberal-v3` 48bf07a9e8ac8cad57fba241569c40c5dc19a77d para pruebas aisladas. Al integrar se debe usar una única fuente versionada, no mantener copias divergentes.

Producción observada: receptor OSi8AcnzLlI0csRu versión 6dcedb03-e0da-4637-b97f-b0f13f61164e, Publisher MCP bnzVMNkZuGO1GQCZ versión f23a3dab-d2b4-4dde-98da-9e1e22a9d557 y entrada de borradores 4o7K5TmKc7joScqB versión eb70e2ff-3aa0-403b-8009-f762ee515f24. La automatización usa selector fijado 70040428b241b592756bfeb7b165746fec2bc2a0. Volver a leer versiones antes de editar.

`destination-command-candidate.mjs` explora parseo a partir del registro de Publisher. Mantiene AMBOS = OPURO + OPOL, TODOS explícito y rechaza selecciones desconocidas o vacías. No acredita órdenes, no recibe mensajes y no es apto para activar solo. Las pruebas Node cubren 15 controles previos y tres casos nuevos aislados, sin IO. No prueban Telegram, guard, mensajes o WordPress.

El esquema de herramientas visible en la sesión aún limita `destino` a OPURO, OPOL y AMBOS. Un refresco en configuración no ha cambiado el esquema visible en esta conversación; probar sesión nueva y la automatización de evento antes de operar. Aún se requieren integración de normalización y controles acreditados en receptor, selector del Motor, correlaciones y mensajes con enlaces para todos los destinos, pruebas de errores y contenido sintético, versionado y rollback coordinado. No cambiar por separado un componente productivo. Evitar reintentos de publicaciones inciertas.
