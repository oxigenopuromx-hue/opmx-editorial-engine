# CAMBIOS OPMX-4.2

## Módulo de ingestión multifuente consolidado

Se documenta la arquitectura validada en n8n para convertir una entrada flexible en un único `editorial_dossier`.

## Casos validados

- solo texto;
- múltiples URLs;
- múltiples PDF;
- URLs sin documentos;
- documentos sin URLs;
- URL + imagen;
- URL + PDF;
- URLs + texto + múltiples PDF + imagen.

## Identidad de fuentes

- `url_1`, `url_2`, etc.;
- `document_1`, `document_2`, etc.;
- `direct_text_1`.

La identidad debe viajar dentro de cada item y no recuperarse mediante referencias ambiguas a nodos anteriores.

## Extracción web

- normalización de URL;
- resolución y descarga HTTP;
- meta tags y Open Graph;
- JSON-LD tolerante a caracteres de control;
- preferencia por `NewsArticle`;
- extracción de párrafos;
- limpieza heurística;
- detección del final del artículo;
- descarte de publicidad, módulos relacionados, correo, footer y copyright.

## Documentos

- separación de múltiples binarios;
- remapeo temporal a `document_file`;
- extracción de PDF con texto;
- normalización por documento;
- reunión en `document_sources[]`;
- descarte del binario después de extraer el contenido.

## Entradas opcionales

Se incorporan paquetes vacíos para evitar bloqueos de Merge:

- `Sin URLs`;
- `Sin documentos`.

## Imagen

La imagen se conserva una sola vez en la rama principal.

No se replica por URL ni por documento.

Al finalizar ingestión, Binary debe contener únicamente la imagen, cuando exista.

## Fuentes bloqueadas

CAPTCHA, HTTP 403 u otras protecciones deben registrarse sin evadir controles y sin derribar el expediente cuando existan otras fuentes utilizables.

## Nuevo objeto final

```text
editorial_dossier
```

Estado listo:

```text
READY_FOR_EDITORIAL_ENGINE
```

## Archivos

Actualizados:

- `PROTOCOLO_EDITORIAL_OPMX_v4.2.md`
- `CONFIG_SEO_OPMX_v2.2.json`
- `ENTRADA_EDITORIAL_OPMX_v2.0.json`
- `SALIDA_EDITORIAL_OPMX_v2.2.json`

Nuevo:

- `INGESTION_PIPELINE_OPMX_v1.0.json`
- `CAMBIOS_OPMX_4.2.md`
