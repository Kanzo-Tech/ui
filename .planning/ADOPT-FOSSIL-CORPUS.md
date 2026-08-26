# Adoptar el corpus de fossil, y borrar el nuestro — plan, 2026-08-25

Escrito para sobrevivir a un `/clear`. Lo que hay aquí es estado medido el 25, no recuerdo.

> **Al día el 2026-08-26. F0 y F1 están cerradas; F2, F3 y F4 no.** Éste es el plan de referencia de
> `packages/graph`, y es el único fichero de `.planning/` que dirige el grafo de punta a punta.
>
> - **F1 ya no está bloqueada: corrió.** `openCorpus` existe con sus cuatro miembros, y nuestro
>   lector y el suyo leen los dos contenedores de tesela y dan respuestas idénticas. La salida (a)
>   del §2 —depender del checkout hermano para el spike— fue la que se tomó, y contestó lo que el
>   spike iba a preguntar.
> - **F3 tiene su lista de trabajo en otro fichero.** Aquí es una frase; los cinco sitios que el
>   borrado de `memorySource` y `duckBoundedSource` rompe están enumerados en `ONE-SOURCE.md` §4, y
>   el primero es la única aserción de comportamiento que `smoke` tiene sobre el barril raíz sin
>   peers opcionales. **No ejecutes F3 sin leerla**, y lee también su cabecera: su §3 condena
>   `explore`, que `ONE-PATH.md` revirtió.
> - **F4 igual.** Sus tres rutas se apoyan en los pasos 3, 6 y 10 de `ONE-PATH.md`, que son las
>   únicas descripciones que existen de multitipo por vecindad, de la segunda pasada de aristas y de
>   subir el cromo al paquete con el workspace como prueba.
> - **F2 está PARADA, y no por trabajo: por una dependencia que no existe.** Ver §1.6. Adoptar es
>   importar `@fossil-lang/graph`, y lo publicado en npm sigue siendo `0.3.0-alpha.3` del 16 de junio,
>   sin `corpus` ni `address` dentro del tarball. La salida (a) —`link:` al hermano— sirvió para el
>   spike y **no es commiteable**: sería una mina para `smoke` y para cualquiera que clone. Hace falta
>   la salida (b), una publicación, y eso es decisión del dueño.
> - **Una deuda que F2 hereda, ya resuelta por el dueño.** `without-fossil.mdx` de rmlext nos publica
>   como su prueba de existencia — *«kanzo-ui lee corpus escritos por fossil sin ninguna dependencia
>   `@fossil-lang/*`»*. Adoptar `openCorpus` es exactamente la dependencia que esa frase niega.
>   **Resolución de Ángel: se adopta, y su página cambia** — su prueba de existencia pasa a ser
>   `apps/corpus/guards/reader.mjs`, que está escrito sólo desde las convenciones publicadas, no
>   importa nada suyo, y ya es exactamente eso aunque su página no lo sepa. **El repo hermano no se
>   toca desde aquí**; esta línea existe para que salga en el siguiente traspaso.

## 0 · Dónde estamos, con evidencia

- **Lo publicado en npm NO es lo que necesitamos, y esta línea decía lo contrario.** El último
  alfa es `0.3.0-alpha.3`, del **16 de junio** — más de dos meses. Su barril exporta cuatro cosas:
  `initFossilGraphWasm`, `createGraphClient`, `GraphClient` y los tipos generados. **Ni `openCorpus`,
  ni `resolveCorpus`, ni `address`**: el tarball no contiene esos ficheros. En rmlext el paquete es
  `0.0.0-development` y los únicos tags son `v0.1` y `v0.2`. Medido el 25 desempaquetando el tarball.
  Todo lo que sigue está leído del checkout hermano, no de npm.
- **El direccionamiento salió del lector.** `packages/graph/src/address.ts` en rmlext, y es
  **síncrono**: no toma `fetch`, no abre conexión, no devuelve promesa. Mejor que lo que pedimos —
  mi propuesta llevaba un `fetch` dentro.
- **Hay una API de referencia**, `corpus.ts`: `corpus.types`, `corpus.window({x,y,w,h})`,
  `corpus.node(iri)`, `corpus.neighbours([iri], { depth })`. Su cabecera dice que no hay teselas,
  ni `dense_id`, ni Morton, ni prefijos, ni footers en la cara de quien llama.
- **Cuatro de los seis huecos que mandamos el 19 están cerrados**: completitud (`window` dice si eso
  es todo), identidad duradera (`node(iri)`, más el índice que publica el corpus), el invariante de
  `src_chunk_size` (muere: ya no hay dos implementaciones) y el corpus de conformidad.
- `HANDOFF-FROM-KANZO-UI.md` fue borrado en rmlext, que era la instrucción.
- **Nuestro árbol está limpio y verde** (`pnpm typecheck` = 0). `duck-source.ts` son 1.216 líneas.

## 1 · Las dos incógnitas, contestadas el 25 — leyendo `rmlext`, no ejecutando

Decidían cuánto se borra. Ya no están abiertas.

**1 · `window()` habla en coordenadas de mundo, y NO toma presupuesto.**

`Box` es, literalmente, *«a rectangle in the corpus's own coordinates»*, y `corpus.extent` existe
para que quien sólo tiene una URL tenga coordenadas que meter en ella. Hasta ahí, lo que pedíamos.

Pero `WindowParams extends Box` añade exactamente dos campos opcionales, `type` y `directions`.
**No hay `limit`, ni escala, ni muestreo.** Y el contrato es explícito en que `complete` no
significa «no se truncó»: *«It is not "the answer is large" or "nothing was truncated" — neither
member truncates»*. Un rectángulo devuelve **todos** sus vértices.

La consecuencia manda sobre F2: la regla de la zancada sobre Morton y la política de cuándo
muestrear **se quedan de este lado**, tal como el §2 ya listaba. Y `window()` **no puede servir la
vista lejana**: encuadrar la extensión de un corpus de cinco millones es pedir cinco millones de
filas. F2 se apoya en `openCorpus` para la lectura *acotada*, y no para la panorámica.

**2 · Sí: 4.096, es una fila de grupo por tesela, y está argumentado.**

`crates/fossil-df/src/files.rs::batches_to_parquet` fija
`max_row_group_row_count = DEFAULT_CHUNK_SIZE = 1 << TILE_SHIFT = 4096`, con un test que se llama
`a_row_group_is_a_tile`. Como el grupo de filas *es* la tesela, el footer lleva **una caja `x`/`y`
por tesela direccionable** — que es justo el índice que estábamos sondeando a mano.

Y trae medida la pregunta que F1 iba a contestar ejecutando. A cinco millones: **1.221 grupos de
filas, footer de 496 kB, 5,6 peticiones de rango y 1,38 MB por ventana**, contra 22,3 peticiones
para las mismas teselas como 1.221 ficheros sueltos. La elección de 4.096 la decide `λ·β` con el
enlace multiplexado, y la curva de bytes es plana entre 1.024 y 8.192 — *«a change there is not an
improvement, it is noise with a `git blame` on it»*.

**Lo que esto no dice:** es lo que hace el escritor *hoy*. Antes era 122.880, el defecto de DuckDB,
así que un corpus servido y escrito con la versión vieja tiene la disposición vieja. Comprobarlo es
mirar el footer del corpus concreto, no el escritor.

**Y una del §4 que también cae: `resolveCorpus` es público a propósito.** Tiene subruta propia,
`@fossil-lang/graph/address`, más una reexportación en el barril, y la cabecera argumenta por qué
(no necesita WASM, ni `query`, ni promesa: *«a notebook, a CLI or a server opens the same corpus
with this and a Parquet reader of its own choosing»*). La pregunta 4.1 sigue en pie como pregunta
de diseño, pero su premisa está confirmada, no era una lectura errónea.

## 1.5 · F1 ejecutado el 25, con `link:` al hermano — y los corpus servidos no abren

**Cómo.** `link:` desde un paquete de usar y tirar a `../rmlext/packages/graph`, cuyo `dist` estaba
sin `corpus.js` (se compiló con `tsc -p`; `dist/` está en su `.gitignore`, no se ensucia su árbol).
Motor: `@duckdb/duckdb-wasm` bajo `NODE_RUNTIME` contra rutas locales, que es el mismo arnés que
usa su `tests/corpus.test.ts`. El spike vive fuera del repo: **nada de `link:` en un `package.json`
nuestro**, que sería una mina para `smoke` y para cualquiera que clone.

**Lo primero que pasó: `openCorpus` se niega a abrir nuestros corpus.**

```
CorpusManifestError: vertex/Node.vertex.yml declares no vertex_count, so how many tiles
Node has is not derivable — tiles are addressed and never listed, and HTTP gives no
directory to fall back on
```

A los seis corpus de `docs/public/bench/` les faltan **tres campos** que el escritor de hoy sí
emite, y ninguno es opcional para el lector:

| campo | dónde | nuestro corpus | el de conformidad |
|---|---|---|---|
| `vertex_count` | `*.vertex.yml` | ausente | `300` |
| `edge_count` | `*.edge.yml` | ausente | `596` |
| `prefix` por orientación | `adj_lists[]` | ausente | `by_source/`, `by_target/` |

El tercero es el silencioso: sin `prefix` la orientación **se salta sin error** —*«an orientation
declared without it has tiles nobody can address»*— y el corpus abre con `directions: []`, cero
aristas y un `gap` de `not-declared` en cada ventana. Un grafo sin aristas que no se queja.

Los tres se derivan de los bytes que ya tenemos (1.000.000 vértices y 6.897.357 aristas, contados
con `duckdb`), así que **no es un rescribir: es volver a emitir los manifiestos**. Y confirma lo
que ya avisaba `run-status-duplicates-the-manifest`: el número va en el YAML.

**Con los manifiestos parcheados, el millón abre y responde.** Medido sobre copia con enlaces
simbólicos al payload real:

| paso | consultas | tiempo |
|---|---|---|
| `openCorpus` | **3** (dos `read_text`, un `DESCRIBE`) | 105 ms |
| `extent()` | 1 | 95 ms |
| ventana | **2**, sea cual sea su tamaño (1 si no hay aristas) | ver abajo |

| ventana | vértices | aristas | teselas | tiempo |
|---|---|---|---|---|
| 0,1% de la extensión | 0 | 0 | 0 | 82 ms |
| 1% | 131 | 952 | 4 | 89 ms |
| 10% | 12.635 | 84.063 | 7 | 160 ms |
| 50% | 308.844 | 2.072.775 | 79 | 2.701 ms |
| **100%** | **999.967** | **6.897.348** | 245 | **11.076 ms** |

Cinco cosas que sólo se ven ejecutando:

1. **Una ventana es una consulta por orientación, no una por tesela.** El podado sale del footer
   dentro de DuckDB; la lista de teselas es un *resultado* (`tiles`, *«reported, never asked for»*),
   no una petición. Contra ficheros locales, claro: **esto son consultas, no peticiones HTTP**, y
   ese número sigue sin medirse con corpus nuestro. El suyo dice 5,6 rangos por ventana a 5M.
2. **El coste va con las filas, no con las teselas.** 79 teselas → 2,7 s; 245 → 11 s. Es lineal en
   lo que devuelve, que es exactamente lo que dice el §1: no hay presupuesto.
3. **Encuadrar la extensión entera funciona.** No falla, no trunca: tarda 11 s y materializa ~7,9
   millones de objetos en JS. Ése es el precio de «no toma presupuesto», con número.
4. **La ventana de la extensión completa NO es el corpus completo**: 999.967 de 1.000.000 y
   6.897.348 de 6.897.357. La caja se compara medio abierta, así que la fila del borde `maxX` se
   cae. La vista lejana tiene que acolchar, o contará de menos y nadie lo notará.
5. **El 0,1% centrado en el centroide da cero vértices.** No es un fallo del lector: es
   `layout-draws-a-different-partition` otra vez, el centro geométrico está vacío.

**Lo que esto le hace a las fases.** F2 puede escribirse ya contra una API que responde. Pero antes
de que sirva para algo hay un paso que no estaba en el plan: **F0 · reemitir los manifiestos de los
seis corpus de `bench/` con los tres campos**. Sin él, ninguno abre.

## 1.6 · F2 parada el 26, y qué es exactamente lo que falta

Medido el 26, no recordado.

**1 · La dependencia no existe, y no hay rodeo.** `npm view @fossil-lang/graph versions` da tres:
`0.3.0-alpha.1`, `.2` y `.3`, y `dist-tags` es `{ latest: 0.3.0-alpha.1, alpha: 0.3.0-alpha.3 }`.
Desempaquetado el tarball de `@alpha`, `tar tzf … | grep -E "corpus|address"` **no devuelve nada**.
Nuestro árbol no nombra `@fossil-lang/*` en ningún `package.json` — las nueve citas que hay son
comentarios y planificación. Así que F2 no es trabajo pendiente: es la salida **(b)** del §2, una
publicación, y es del dueño.

**2 · La pieza que hay que adoptar es `resolveCorpus`, no `openCorpus`.** Esto corrige el nombre que
el plan lleva desde el 25, y lo decide el §1 de aquí: `corpus.window()` no toma presupuesto y
materializa todas las filas del rectángulo (11 s y ~7,9 M objetos a un millón), así que no puede ser
el camino del `slice`. Lo que sí encaja exactamente es `resolveCorpus`
(`@fossil-lang/graph/address`, 704 líneas, **síncrono y sin WASM**): toma `manifestFiles:
Record<string, string>` ya traídos por el host más un `base`, y devuelve `vertexType().tileUrl(t)`,
`files()` y `window({ tiles, directions })` → `{ vertexUrls, edgeUrls, complete, gaps }`. Es
literalmente la mitad de `duck-source.ts` que sabe de prefijos, y deja intacto todo lo del §2 que no
se muda — la caché de teselas, el `MosaicClient`, `Resident`, cosmos.gl.

**3 · Lo que se iría de `duck-source.ts`, contado.** El fichero son **1.216 líneas**. Lo que
`resolveCorpus` sustituye es: `scalar`/`listItems` (el escáner de YAML a mano, 791–806), la lectura
de `type`/`prefix`/`chunk_size` y el emparejado del edge por `src_type` (856–883), `tileUrl` y
`edgeTileUrl` (900–901), y el sondeo de existencia por `HEAD` doblando y bisectando más el
`ceil(V/chunk_size)` que lo motiva (1.018–1.054). Son **~120 líneas, y son exactamente las de
prefijos** — el criterio de éxito que el §2 escribe. Lo que **no** se va, y hay que decirlo antes de
prometer una cifra mayor: el lector de cajas por `parquet_metadata` (1.064–1.081) es nuestro, porque
`resolveCorpus` direcciona y no lee footers, y `intersecting` se queda porque la aritmética sobre
cajas es nuestra.

**4 · Y el formato se movió otra vez hoy, en la dirección que refuerza adoptar.** `818218c`
(26-08, 16:56) introduce `container: 'files' | 'rowgroups'` en `graph.graph.yml`: *«un fichero por
tesela con la dirección en el nombre»* frente a *«un Parquet por conjunto cuyos grupos de fila son
las teselas»*, y **ausente significa `files`**. Nuestro lector no tiene ese concepto y hoy asume los
dos a la vez sin saberlo: la línea 901 direcciona `by_source/tile{k}.parquet` (contenedor `files`) y
la 1.133 registra la vista sobre `by_source.parquet` (contenedor `rowgroups`). Funciona sólo porque
el escritor viejo emite **ambos** — verificado en `docs/public/bench/2000/edge/Node_linksTo_Node/`,
que tiene `by_source/`, `by_source.parquet`, `by_target/` y `by_target.parquet`. En cuanto un corpus
declare un contenedor y emita uno solo, una de las dos líneas apunta a un fichero que no está. Es la
tercera vez que este lado copia lo que el otro posee, después de `chunk_size` y de los tres campos
de F0.

**5 · Trampa viva ahora mismo: el binario está caducado.** `rmlext/target/release/fossil` es del
**25 a las 23:29** y `crates/fossil-sinks/src/manifest.rs` es del **26 a las 16:56**. Regenerar los
corpus con ese binario —que es lo que dice el comando de F0— escribe manifiestos **sin `container`**.
No falla; escribe la disposición vieja en silencio, que es la trampa 2 de `ONE-SOURCE.md` repitiéndose
con otro campo. Recompilar antes de regenerar nada.

**Qué desbloquea F2, en una frase:** un alfa de `@fossil-lang/graph` que lleve `dist/address.js` y
`dist/manifest.js` dentro del tarball. La subruta `./address` ya está declarada en su
`package.json` y su `tests/address-standalone.test.ts` ya compila ese cierre sin `pkg/`, así que no
falta diseño: falta `npm publish`.

## 2 · Las fases

**F0 · Los manifiestos. Hecho el 25.** Primero parcheando los tres campos contados de los bytes
—los siete corpus abrieron—, y luego mejor: el `fossil` de hoy los emite solo **y además tesela
`by_target/`**, que cierra el hueco `dst:not-declared`. Así que se regeneran con
`FOSSIL_BIN=… node docs/showcases/graph-bench/corpus/build-corpus.mjs --sizes …`, que es el
generador que este plan daba por perdido y estaba en `docs/showcases/graph-bench/corpus/`.
`docs/public/corpus/archive` sigue siendo la copia parcheada, no regenerada.

**F1 · Spike, sin tocar el lector. Hecho el 25–26.** Su salida —qué devuelve `window()`, en qué
coordenadas y cuántas peticiones cuesta— estaba contestada por lectura en el §1, y ejecutarlo estaba
bloqueado porque nada publicado traía `openCorpus`. **Se tomó la salida (a)**: `link:` al checkout
hermano. `openCorpus` abre con sus cuatro miembros, los dos contenedores de tesela se leen desde los
dos lados y las respuestas coinciden. Las tres salidas quedan escritas porque el bloqueo se repetirá
en cuanto haga falta una API suya que no esté publicada:

- **(a) Depender del checkout hermano** (`link:` a `../rmlext/packages/graph`) para el spike. Corre
  hoy; no es commiteable como dependencia real, y hay que acordar que el spike vive con esa marca.
- **(b) Pedir un alfa con la mitad de corpus dentro.** Es una publicación, no trabajo de diseño, y
  desbloquea F2 de verdad.
- **(c) Adelantar el diseño de F2 contra la fuente leída** y cablearlo cuando exista el paquete. El
  riesgo es escribir contra una API que aún se mueve — aunque su cabecera dice que la forma está
  cerrada en cuatro miembros.

**F2 · Adoptar en un solo sitio. PARADA el 26 — ver §1.6.** El `BoundedSource` que la canvas consume
pasa a apoyarse en el direccionamiento de fossil. Sabremos que salió bien cuando **la mitad que
desaparece de `duck-source.ts` sea la que sabía de prefijos**: están identificadas y son ~120 de las
1.216, más el `container` que hoy no sabemos leer. No se puede ejecutar sin una publicación —
importar `@fossil-lang/graph` desde un `package.json` nuestro es una dependencia real, y la que hay
en npm no trae la mitad de corpus. **Y la pieza es `resolveCorpus`, no `openCorpus`**, que es lo
único de este plan que estaba mal nombrado.

**F3 · Los borrados que ya estaban pendientes**, y que esta adopción hace baratos: `memorySource`,
`duckBoundedSource`, la lápida de `IdSetClient` — el «paso 10» del plan anterior. **Su lista de
trabajo es `ONE-SOURCE.md` §4**, que enumera los cinco sitios que rompe y lo que cada borrado debe
mudar antes de irse; ejecutar F3 sin ella es descubrirlos de uno en uno con `smoke` en rojo.

> **No corrió el 26, y no está bloqueada: es independiente de F2** —la decisión «una sola fuente y es
> la del corpus» es de Ángel y no depende de quién direccione por dentro, porque nuestro `openCorpus`
> ya existe y responde. Lo que la paró fue el presupuesto de una sesión: el borrado toca
> `packages/graph/{index.ts,index.test.ts,memory-source.ts,duck-source.ts}`,
> `packages/ui/src/documented-exports.test.ts` (dos entradas), `scripts/smoke-install.mjs` (su única
> aserción de comportamiento, que **cambia** y no desaparece), tres `.mdx` con la tabla «tres fuentes,
> tres trabajos», tres ejemplos de `docs/examples/graph/`, `docs/lib/sightings-graph.ts` y el
> changeset — y detrás la cadena entera. Dejarlo a medias en un checkout que comparten otras sesiones
> es peor que no empezarlo. Los tamaños, para dimensionarlo: `memory-source.ts` son **282 líneas**
> enteras, y `duckBoundedSource` más `DuckSourceOptions` son **~120** (49–101 y 188–255) de las 1.216
> de `duck-source.ts`. Recuerda que la línea que condena `explore` está **revertida**.

**F4 · Las tres rutas**, ya sobre una API que no se mueve: teselado y zoom (la que enseña),
larger-than-RAM, y benchmarks (el `graph-bench` que hoy no tiene página, sólo
`/view/showcases/graph-bench`). **Lo que hay que escribir para cada una está en `ONE-PATH.md`**,
pasos 3, 6 y 10 — y el paso 10 trae la condición de aceptación de toda la API: si el workspace no
baja a decenas de líneas más sus paneles de producto, no está terminada. De la ruta
larger-than-RAM: dos de las tres costuras del escritor están refutadas por medición y sólo queda
`GraphArData`; `BENCHMARKS.md` todavía lista las tres.

**Lo que NO se muda, y es la línea que protege «fossil no envía visor»:** caché de teselas,
debounce, cancelación por supersede, el `MosaicClient` con el predicado del crossfilter, `Resident`
y los buffers, la política de cuándo muestrear, y cosmos.gl entero.

## 3 · Lo que sobrevive y no debería

- ~~El renombre aprobado el 19 y nunca hecho.~~ **Hecho el 25, `b6f3073`.** Coste registrado: en los
  seis días de espera el nombre viejo ganó un segundo fichero de test, así que renombrar dos ficheros
  fue renombrar cuatro, y las citas eran de cuatro registros y no de tres.
- **`adaptive()`**: exportado, **cero llamadas** (medido el 19). El repo tiene un registro que se
  llama `an-export-needs-a-second-call-site`.
- ~~**`.planning/` miente por partes.**~~ **Hecho el 26.** De 34 ficheros quedan 9 y un índice:
  11.887 líneas borradas, 2.530 conservadas. Cada superviviente lleva su fecha y su estado
  verificado contra el árbol, y `README.md` dice bajo qué regla se queda cada uno y qué se rescató
  de los que se fueron. La auditoría del lector contra las cinco convenciones también se fue, ya el
  26: sus dos mediciones se mandaron a rmlext, que es a quien se le debían.

## 4 · Del diseño de fossil, tres cosas que preguntaría

No son defectos observados; son preguntas con su evidencia, para hacerlas antes de construir encima.

1. **Dos superficies públicas a dos niveles.** `resolveCorpus` (direcciones) y `openCorpus`
   (referencia). Si las dos son públicas, alguien construirá un segundo lector sobre la de abajo y
   el corpus de conformidad sólo comprueba una — que es la forma del problema que borrar `viewport`
   resolvió. ¿Es `resolveCorpus` público o interno?
2. **El índice de identidad.** Cerró un hueco real, pero `addressing.mdx` presumía de *«no hay
   directorio que traer, ni índice que descubrir»*. Si el índice es un fichero que hay que traer
   entero, esa frase deja de ser cierta y conviene que la página lo diga.
3. **El suelo de zoom sigue sin dueño, y es el techo real.** El corpus de cinco millones no se puede
   encuadrar: cosmos.gl corta en 1e−3 y hacen falta 1,51e−4 — **6,61× corto**, 15% del ancho
   alcanzable. Ahora que *«the coordinate box is the corpus's extent»* es de ellos, **normalizar esa
   extensión al escribir** es una política de una línea que quita el techo. Es la mejora de diseño de
   más valor que sé nombrar, y no es del lector.

## 4.5 · Los seis rojos eran el reloj, no el tema — cerrado el 25

El diagnóstico que había aquí («la refundación del tema, `data-theme` sustituyendo a
`data-palette`») **era falso**, y lo desmiente la propia forma del fallo: los seis decían
`Test timed out in 5000ms`, ninguno falló una aserción.

Lo medido:

- Cada uno de los cinco ficheros **pasa en solitario**: `code-editor-search` en 669 ms, los cinco
  juntos en 21 s, y el más lento de todos —*Preferences, «wears a side by pressing its Colour
  card»*— en **2,83 s**, a un pelo del límite por defecto de 5 s.
- La suite entera de `ui` pasó **586/586 en 38,9 s** con la máquina tranquila, sin tocar nada.
- Con `pnpm test` en la raíz, que arranca `theme` y `ui` a la vez sobre 14 núcleos, salieron
  **siete** rojos y **el conjunto cambió**: entraron *«writes the choice to `<html>`»* y *«retracts
  the filter when the last value is unticked»*, y salió *«stands aside while a freeform answer is
  being typed»*. Un conjunto que se mueve entre ejecuciones es contención, no una regresión.

La causa es la sobresuscripción: dos paquetes × (núcleos − 1) forks, cada uno con su jsdom, más
las otras sesiones que compilan en este mismo checkout. La suite completa cuesta 39 s en reposo y
146 s bajo carga — casi 4×.

**Arreglo:** `testTimeout: 15_000` en `packages/ui/vite.config.ts`, con la medición en el
comentario. Cinco veces el test honesto más lento; los 5 s eran el defecto de Vitest, no un
presupuesto que eligiera nadie aquí. Deliberadamente **no** se limita la concurrencia: eso
ralentizaría todas las ejecuciones para protegerse de una condición que también provocan sesiones
ajenas, y contra esas un tope de forks no puede nada.

**Verificado:** `pnpm test` en la raíz, con la máquina a carga 12–14, verde de punta a punta —
891 tests en `theme` (71), `ui` (586), `graph` (86), `ai` (96) y `docs` (52). `lint` verde.

## 5 · Verificación, en este orden

`pnpm build`, `typecheck`, `lint`, `check:generated`, `test`, `size`, `smoke`, y
`pnpm --filter @kanzo-tech/docs build`. Más la comprobación viva: abrir la ruta, mover la cámara y
**asertar sobre el DOM** (peticiones, bytes, marcas dibujadas frente a `n`), nunca sobre una captura.

## 6 · Coordinación

Otras sesiones escriben en este mismo checkout. Atribuir antes de actuar, commitear por rutas
explícitas, y avisar por `SendMessage` antes de entrar en `packages/graph` o en
`docs/showcases/workspace/*`, que es donde tres sesiones se cruzaron el 19.
