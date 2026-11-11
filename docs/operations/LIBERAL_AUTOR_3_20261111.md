# El Liberal — autor editorial 3 — 11nov2026

Estado: preparado, NO activado; pendiente autorización para el permiso WordPress.

La credencial actual de Publisher autentica elm_publisher (ID2), rol author. GET /users/me confirmó publish_posts=true y ausencia de edit_others_posts. GET público /users/3 confirmó Redacción El Liberal MX, slug redaccion. No se consultaron contraseñas ni se modificaron usuarios, posts o credenciales.

Se preparó la sustitución exclusiva de author_liberal.id=2 por id=3, source=PUBLISHER_LIBERAL_REDACCION_ID_3, en Validar y normalizar OPMX MASTER de los dos puntos de entrada:
- Shared4o7K5TmKc7joScqB: candidata c7610e14-994b-45bd-8748-bdef90e0fc78; activa conservada cce524a4-660e-4d05-af66-39e003c6338b.
- FormMt7ts2EGPbyaTC2o: candidata bf4cc77c-6853-4303-a25b-2f58dc057d8e; activa conservada 0a0af4ac-fe0d-4aff-a662-7e45bf87a320.

Ambos normalizadores candidatos se ejecutaron con un MASTER válido y destino LIBERAL: producen author_liberal.id=3 y mantienen la configuración OPURO. El POST de creación ya toma canonical.author_liberal.id y el readback ya rechaza un autor distinto; no se necesita una escritura posterior de traspaso.

No se activaron candidatos que hoy fallarían por permisos. Se restauraron los borradores anteriores de ambos workflows. El diagnóstico temporal quedó restaurado, inactivo y sin retención.

Para continuar con las credenciales actuales, el usuario2 requiere edit_others_posts: permite asignar el autor3, pero también amplía su capacidad para editar posts ajenos. No se propone convertirlo en administrador ni conceder delete_others_posts o gestión de usuarios. Se necesita confirmación de ese alcance antes de aplicarlo.

Después: conceder permiso aprobado, comprobar un borrador aislado author=3 y retirarlo a papelera; activar candidatos y actualizar conjuntamente las versiones/huellas del manifiesto Guard para conservar la recuperación. No modificar posts históricos ni otra credencial.
