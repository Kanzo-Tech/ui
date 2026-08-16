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

#### Leído: el mecanismo transfiere, la forma probablemente no, y los strings no se van

`chartDescriptor(name, compile)` (`packages/ui/src/charts/chart-spec.ts`) es un componente que
renderiza `null` y lleva su compilación en un estático. `ChartRoot` recorre `children`, encuentra
los que la tienen y **los compila sin renderizarlos**; lo demás se renderiza. Nada de eso depende de
que un chart tenga partes, así que un canvas puede hacerlo igual. Un detalle de nuestra forma:
`children` van a `GraphRootProvider` y los canales son entrada de la consulta, así que irían en
`useGraph` — correcto, y lo que Ark hace: la fábrica recibe todo lo que la máquina necesita.

**Pero hay dos razones para no copiarlo, y la segunda corrige lo de arriba.**

Los descriptores existen para una lista de longitud variable — pon las marcas que quieras. Los
canales de un grafo son **tres y singleton**: color, tamaño, etiqueta. Para eso tres props son
mejores que tres hijos, por el mismo razonamiento que nos hizo no copiar los prop getters de Ark.

Y **los canales no arreglan el stringly-typed**: `fill="kind"` es tan cadena como
`categoryField: "kind"`. Plot, Vega y cualquier gramática gráfica nombran la columna con un string,
porque nombrar una columna es eso. Lo que los canales sí quitan es el **objeto** — el saco que
duplica el manifiesto. La cadena que queda es irreducible y no hay que perseguirla.

Así que el destino probable es: `GraphSpec` muere, sus seis campos de corpus salen del manifiesto, y
los tres roles se quedan como props del canvas con los nombres que Plot ya usa. Sin validador: si la
columna no existe, la consulta falla y lo dice.

#### La forma, decidida — canales en la petición, no en la fuente

**La pieza no es cómo se nombran los canales, es dónde viven.** Hoy las columnas se hornean en la
*fuente* al construirla, y por eso no se puede cambiar qué colorea el grafo sin reconstruirla, y por
eso `categoryField` se coló en `openCorpus`.

La separación correcta ya existe y no la estábamos usando: `BoundedSource` es *dónde están los
bytes*, `SliceRequest` es *qué quiero dibujar*. Qué columna colorea es lo segundo. Cambiar el color
es una pregunta nueva, no una fuente nueva — y es lo que hace la referencia: en Plot la **marca**
lleva los canales y es la que produce la consulta; la fuente sólo dice de dónde salen las filas.

```tsx
const { source } = await openCorpus({ coordinator, dest: "/corpus/archive" });

<GraphCanvas source={source} fill="kind" r="degree" title="label" onFailure={…}>
  <Legend />
  <Inspector fields={[{ field: "hall", label: "Hall" }, …]} />
</GraphCanvas>
```

- **Tres canales con los nombres de Plot** para una marca de puntos: `fill`, `r`, `title`. No se
  inventa vocabulario; es el que un lector trae y el que `/analytics` ya envía.
- **`x`/`y` no son canales**, y ahí está la diferencia real con Plot: en un corpus la posición es un
  hecho y no una codificación. La escribió el layout pass y es el índice contra el que se hace toda
  pregunta espacial.
- **`openCorpus({ coordinator, dest })`** — un argumento, ahora de verdad. `categoryField` se va.
- **`groupField` y `detailFields` no son del canvas.** Son lo que enseña el inspector, y el
  inspector es `children` — la misma regla que deja fuera al toolbar y a la leyenda. Un
  `detailFields` con etiquetas de UI dentro de un spec de datos era la pista de que estaba mal
  colocado.
- **`GraphSpec` desaparece entero**: seis campos del manifiesto, tres canales, dos del inspector.

Lo que hay que mover: `Columns` en `duck-source.ts` se construye una vez en la fábrica y pasa a
construirse en `slice()` desde la petición — interpolación de cadenas, no es caro. Y
`useBoundedGraph` vuelve a preguntar cuando un canal cambia, que es correcto: es otra pregunta.

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
- `explore`, `ExploringSource`, `ExploreRequest` — `memorySource` era la única implementación.

**Nada de esto se borra sin mudar su razón, y ésta es la condición, no una nota al pie.** Ángel:
*«no borres por borrar, haz las cosas bien»*. Un borrado que se lleva por delante el argumento que
lo justificaba es cómo la siguiente persona reinventa lo que quitamos.

Concretamente, lo que cada uno debe a la lápida:

- **`explore` y compañía.** La vecindad no estaba de adorno: se añadió corrigiendo un error de
  diseño real — un rectángulo no puede expresar «dos saltos desde este nodo», y un contrato que sólo
  hablaba de rectángulos imponía la metáfora del mapa a una red. Y `decisions/a-tile-is-an-address-not-a-verb.md`
  la nombra como la costura por donde entra el `expand` de fossil. Si se va, el tombstone en
  `index.test.ts` tiene que llevar **las dos frases**, o dentro de tres meses alguien vuelve a
  descubrir que hace falta.
- **`memorySource`.** La aserción del `smoke` no desaparece: **cambia** a la que ya existe al lado
  (*«graph root barrel imports with only non-optional peers»*), y el changeset dice que el barrel
  raíz deja de dibujar. Sin eso el borrado se lleva una garantía que costó encontrar.
- **El ejemplo.** Empeora, y la página lo dice en vez de disimularlo.
- **`GraphSpec`.** Aquí no hay borrado: seis campos los da el manifiesto, tres son canales, dos se
  mudan al inspector. Es reubicación, y se escribe como tal.

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
