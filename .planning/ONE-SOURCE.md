# Una sola fuente — lo que falta, 2026-08-16

Decisión de Ángel: `@kanzo-tech/graph` envía **una** fuente y es la del corpus. `memorySource` y
`duckBoundedSource` se borran. El paquete existe para interactuar con fossil y eso es lo único que
mantenemos.

Este fichero es el corte: lo hecho está en `main`, lo que falta está aquí con el porqué, para que
una ventana limpia lo continúe sin reconstruir el razonamiento.

---

## Hecho

- **`openCorpus`** (antes `corpusSource`) devuelve `{ source, nodes, edges }`. Registrar vistas no
  es un extra: sin ellas la mitad «preguntar» —charts, crossfilter, verbos— se queda sin relación,
  y cada host tendría que re-derivar las URLs a mano, que es lo que borramos.
- **`categoryField`** vuelve como el único argumento que el manifiesto no puede dar. Declara
  nombres, no roles.
- **El corpus del archivo del Guild**, compilado: `docs/showcases/workspace/corpus/` con su
  `.fossil`, su `.shex` y su script. 1.543 vértices, 4.280 aristas, las nueve propiedades que los
  paneles consultan. Gitignoreado.
- El benchmark ya va por `openCorpus` y **no cambia**: cero referencias a las dos que se van.

## Falta

### 1 · Cablear el workspace

`ARCHIVE_SPEC` (`graph-state.tsx:104`) pasa a `idField: "dense_id"`, y `loadGraph()` deja de
construir CSVs en el navegador: una llamada a `openCorpus({ coordinator, dest: "/corpus/archive",
categoryField: "kind" })` da la fuente y los nombres de vista que `spec.table` / `spec.edges`
necesitan.

**Lo primero contra lo que se choca: los nombres de vista.** `ARCHIVE_SPEC.table` y `.edges` son
constantes de módulo (`archive_nodes`, `archive_edge_pairs`) y `openCorpus` **deriva** los suyos
(`corpus_Node`, `corpus_Node_edges`). Fijarlos a mano en el spec sería acoplar el showcase a cómo el
paquete construye un nombre, que es lo que acabamos de quitar. Lo que hay que mover es el spec: hoy
es una constante de módulo y tiene que pasar a salir de la apertura, junto a `ready`. `loadGraph()`
ya vive detrás de `ensure(...)`, así que el sitio existe; lo que no existe es que el spec sea un
valor del proveedor en vez de un `export const`.

**Y la imagen cambia.** El layout pasa a ser el que escribe fossil, no el de `buildArchiveGraph`, así
que esto pide mirarlo en el navegador y no sólo compilarlo — la retención de aristas por ventana y la
legibilidad son justo lo que el corpus reordena.

**El id se queda en `dense_id` y no pasa a `subject`, y esto se razonó y se corrigió una vez.**
Todo uso del id en el workspace es de sesión — `useDetails` busca etiquetas del puñado que se va a
dibujar, `IdSetClient` publica una cláusula que dura un gesto. Nada sobrevive a la pestaña, así que
`subject` sería arrastrar 1.543 IRIs a 1,87× los bytes sin comprar nada. La identidad importa donde
algo **persiste**: el día que el inspector tenga «copiar enlace» o un marcador, la columna ya está.

Dos cosas que hay que mirar al hacerlo: el layout es de fossil ahora, no el de `buildArchiveGraph`,
así que **la imagen cambia**; y el corpus no trae columna `community` — sólo `cluster_id` — que es
justo por lo que `categoryField: "kind"` es obligatorio aquí.

### 1 bis · Y antes de cablear nada: `GraphSpec` huele, y la validación es el síntoma

Ángel, sobre depender de constantes: **`ARCHIVE_SPEC` es el problema, no los nombres de vista.**
Ésos ya los devuelve `openCorpus` y el host no escribe ninguno. Lo que sí escribe a mano es
`idField`, `labelField`, `categoryField`, `sizeField`, `groupField` y los `detailFields` — sobre un
corpus que **ya declara sus propiedades en el manifiesto**. Es el patrón de `CHUNK_SIZE` otra vez:
este lado escribe lo que el otro posee, y caducará igual.

La reparación obvia —que `openCorpus` devuelva `properties` para poder comprobar los strings al
abrir— **es un olor, no un arreglo**: compensa un enganche débil en vez de quitarlo, y deja dos
sitios sabiendo de columnas.

El enganche débil es el rol como cadena. `categoryField: "kind"` es un string que debe casar con una
columna, comprobado en runtime, sin tipo que lo sostenga.

**Y la forma buena ya está en el repo, una capa al lado.** La capa de charts no lleva un spec con
nombres de columna: lleva descriptores con **canales** — `ChartLine x="date" y="value"`. Un grafo es
una marca con canales. `x`/`y` ni siquiera son canales aquí, son hechos del corpus; quedan tres, y
son los que Plot llama `fill`, `r` y `title`.

Así que la dirección probablemente no es un spec más limpio sino **ningún spec**: los canales los
declara el canvas como los declara una marca, con el vocabulario que ya enviamos. Sin objeto que
mantener en sincronía con un manifiesto porque no hay objeto.

**Esto se decide antes de cablear el workspace**, porque cablearlo con `GraphSpec` es escribir el
call site que luego hay que reescribir.

### 2 · El ejemplo, contra el corpus real

Ángel: *«para los ejemplos los creamos con fossil y los importamos, quiero que sean ejemplos de lo
real»*. `docs/examples/graph/example-default.tsx` usa `memorySource` con una constante en línea.
Pasa a abrir el corpus del archivo — el mismo que el workspace, que es el ejemplo que corre en
`docs/example/`, no un segundo mundo.

**Y hay un coste que hay que aceptar a la cara:** el ejemplo más pequeño deja de ser «arrays en
mano, una llamada, sin base de datos» y pasa a arrancar DuckDB. Como primera cosa que alguien ve de
un paquete de grafos es peor, y la página tiene que decirlo en vez de disimularlo.

### 3 · El borrado

- `packages/graph/src/memory-source.ts` entero, y `MemoryGraph`.
- `duckBoundedSource`, `DuckSourceOptions` y `Columns.subject`/`typeIndex` si quedan huérfanos.
- `explore`, `ExploringSource`, `ExploreRequest` — `memorySource` era la única implementación. Se
  van por la regla 1: superficie sin implementación es lo que este repo borra. Lo que los trae de
  vuelta está escrito en `decisions/a-tile-is-an-address-not-a-verb.md`: el `expand` de fossil.

### 4 · Lo que el borrado rompe y hay que decidir a la vez

**`smoke-install.mjs` pierde su aserción de comportamiento.** Hoy es *«memorySource answers a slice
with no database installed»* — la única prueba de que el barrel raíz dibuja sin peers opcionales.
Con una sola fuente, en `/duckdb`, **el barrel raíz se queda sin ninguna fuente** y esa promesa deja
de existir. La aserción pasa a ser la que ya existe al lado: *«graph root barrel imports with only
non-optional peers»*. Hay que decirlo en el changeset: `@kanzo-tech/graph` sin base de datos es
superficie de renderizado —hooks, looks, identidad, `buffers`— y ya no dibuja.

- `packages/graph/src/index.test.ts` — la única aserción de comportamiento del barrel, misma
  historia.
- `packages/ui/src/documented-exports.test.ts` — dos entradas.
- `docs/content/docs/(root)/installation.mdx` y `docs/content/docs/graph/index.mdx` — la tabla «tres
  fuentes, tres trabajos» pasa a una.
- El changeset.

---

## El estado del árbol al cortar

`packages/ui` está en rojo por trabajo **ajeno**: otra sesión tiene ocho ficheros de theme/palette
sin commitear a mitad de una migración a `paletteByAppearance` — 11 tests y un `setPalette` sin
usar. No es nuestro y no se toca. El resto (`build`, `typecheck`, `check:generated`, `eslint` fuera
de `packages/ui`, los 41 tests de graph y los 32 de docs) está verde.

`rmlext` tiene `apps/corpus/content/docs/conventions/payload.mdx` corregido y **sin commitear** —
la afirmación de que las columnas separadas suben a la GPU sin transformación, que cosmos.gl
desmiente. Es el otro repo; el commit es de Ángel.
