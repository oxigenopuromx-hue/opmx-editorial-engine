# Horizonte: extensión editorial candidata

Estado: preparación; no habilita destinos, escritura ni publicación. Debe activarse con el receptor, Guard, Publisher y Motor de la misma versión, tras las pruebas integrales.

La lista de destinos se toma exclusivamente de la revisión acreditada por Guard. En revisiones anteriores, `TODOS` conserva su selección original. La opción v3 `TODOS` incluye OPURO, OPOL, LIBERAL y HORIZONTE; `ACTIVOS` comprende los tres primeros y `AMBOS` sólo OPURO y OPOL.

Cuando el alcance acreditado incluya HORIZONTE, el MASTER requiere clasificación independiente:

```json
{
  "CATEGORIAS": {
    "HORIZONTE": {
      "PRINCIPAL": "sin-categoria",
      "REGION": "bcs",
      "TEMA": "politica",
      "TIPO": "news",
      "MUNICIPIO": "la-paz"
    }
  }
}
```

El ejemplo describe una nota ficticia. `PRINCIPAL`, `REGION`, `TEMA` y, cuando aplique, `MUNICIPIO` son slugs confirmados en el catálogo autenticado del CMS de Horizonte; no se reutilizan identificadores de otros medios. `TIPO` admite `news`, `analysis` u `opinion`. `MUNICIPIO` es opcional y sólo corresponde a la región `bcs`. `FUENTE_URL`, cuando se conozca y corresponda, debe ser HTTPS; no inventar una URL.

El catálogo se lee directamente del CMS por un componente autenticado. Un archivo, texto fuente o campo del MASTER no acredita su origen. `normalizeHorizonteCatalog` comprueba la respuesta y `validateSelectedCategories` valida el conjunto para el destino seleccionado; ninguna de esas funciones autoriza escritura. El escritor debe volver a resolver los términos y el autor institucional en el CMS de Horizonte antes de crear su borrador.

Hero y destacada se transfieren como medios propios del CMS de Horizonte y deben verificarse por separado. `IMAGENES.HERO_HORIZONTE` puede aportar `CREDITO`, `FOCAL_X` y `FOCAL_Y`; si no se dispone de esos datos, no se inventan. Hasta que exista una transferencia de imágenes internas, la ruta de Horizonte rechaza bloques `core/image` con adjuntos de otro CMS. Los cambios y actualizaciones de notas existentes requieren su propia decisión confirmada y quedan pendientes de integración.

No introducir un nuevo Motor ni ampliar la selección de paquetes históricos. Los resultados, reintentos, fallos parciales, enlaces y acuses deben corresponder al conjunto exacto acreditado para cada revisión.
