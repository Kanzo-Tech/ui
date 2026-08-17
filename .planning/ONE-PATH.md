# Un solo camino — la arquitectura de referencia, 2026-08-17

Decisión de Ángel: *«quiero uno con sus hooks, providers, una API sólida de principio a fin; API de
corpus (rmlext), API de grafo aquí, capaces de hablarse, y en pocas líneas generar lo que tenemos en
el showcase de workspace»*. Y el listón: **elegante, sólido, de referencia, sin hacks**.

Este fichero es la arquitectura y el orden. `ONE-SOURCE.md` sigue siendo el corte de «una sola
fuente» y no se contradice con éste — pero **una de sus decisiones se revierte aquí**, y está dicho
abajo con su razón.

---

## Qué es «de referencia» aquí

**No existe** una implementación de referencia de *grafo en GPU acotado sobre un corpus columnar*.
Las que hay cubren cada una una mitad:

| referencia | cubre | qué le tomamos |
|---|---|---|
| deck.gl `TileLayer` | lectura acotada por dirección | `resolve`/`fetch`, caché, refinamiento |
| Mosaic `MosaicClient` | consulta coordinada y crossfilter | `fields`/`query`/`queryResult`/`filterBy` |
| Observable Plot | codificación | canales por marca (`fill`, `r`, `title`) |
| Ark UI | composición en React | `useX → api` + provider + partes |
| cosmos.gl | layout y pintado en GPU | el renderizador, y nada más |

Ser de referencia es **componer sus formas correctamente**, no copiar una. Cosmograph queda donde
Ángel lo dejó el 2026-07-30: referencia, nunca dependencia.

## Las tres capas, y qué sabe cada una

| capa | dónde | sabe de | expone |
|---|---|---|---|
| **corpus** | fossil/rmlext + `openCorpus` | Parquet, GraphAr, teselas, layout | vistas, macros, propiedades, extent |
| **fuente** | `@kanzo-tech/graph/duckdb` | SQL, Mosaic, el crossfilter | las interfaces de lectura |
| **render** | barril raíz | píxeles | `useGraph`, `GraphCanvas`, cromo |

`@kanzo-tech/ui` no aparece y no debe aparecer: la primera regla de admisión de `DESIGN.md` excluye
los grafos por nombre. Y el renderizador **no aprende un formato de almacenamiento** — hoy es verdad
y todo lo de abajo la mantiene.

**La puerta de un solo sentido:** Mosaic es peer *opcional* de `@kanzo-tech/graph`, y `smoke` lo
vigila («graph root barrel imports with only non-optional peers»). Por eso **la fuente es cliente de
Mosaic y el lienzo no**, y por eso el lienzo no puede ser una marca de vgplot por atractivo que sea.

---

## El objetivo es la escala, y aquí es donde se rompe hoy

Ángel: *«pero yo quería larger than RAM… o al menos grafos muy grandes en cliente web»*. Son dos
mitades y sólo una es del navegador.

**En el cliente ya es cierto en el sentido que importa**: nunca se sostiene el corpus. Lo que se
dibuja y lo que se transfiere siguen a la ventana y son **planos a cualquier N** — `total()` 7–9 ms
(metadata de Parquet), subida a GPU 23 ms (la rebanada está topada en 20.000 marcas), techo de
redibujado en miles de fps.

**Lo que no es plano es lo que se escanea.** *Bounded rendering, unbounded querying:*

| | 200k | 1M | 5M |
|---|---|---|---|
| Primer pintado | 97 ms | 240 ms | **1.006 ms** |
| Pan | 41 ms | 93 ms | 331 ms |
| Actualizaciones/s | 24,2 | 10,7 | **3,0** |

Cinco veces el corpus cuesta 4,6× la rebanada: lineal. El predicado de la caja y el join de aristas
son O(N) y ningún límite sobre la respuesta abarata *encontrarla*.

**Y a 5–10M el término que sigue a N son las peticiones, no los bytes:** 55 peticiones por ventana
fría a un millón, 208 a cinco (18,9× de sobre-lectura), 376 a diez — de las cuales 28, 124 y 247 son
HEAD. Dos de seis pasos de arrastre a diez millones **transfieren cero bytes y cuestan 247 peticiones
cada uno**. Una caché de payload no toca eso: lo tocan **teselas más grandes** (4.096 filas → 78
peticiones y 1,48 MB donde hoy hay 208 y 12,12) *y* la caché, en ese orden.

**La mitad que falla de verdad es la escritura, y vive en rmlext.** Diez veces el corpus, cuatro
veces el pico: 9,87 GiB a diez millones bajo un presupuesto de 4 GiB, porque tres costuras nuestras
retienen el valor entero en vez de transmitirlo — `GraphArData` guarda cada lote, `to_files()`
codifica cada Parquet antes de tocar disco, y el paso de layout mete la lista de aristas completa en
un `Vec` mientras Louvain sostiene estado O(n). El motor transmite; nuestras costuras coleccionan.
A 100M, con estos números, la respuesta es no.

**Y una premisa del teselado está muerta: una tesela no puede ser una comunidad.** A cinco millones
`cluster_id` da 15.310 grupos con **mediana de un vértice** y `community` da ocho, cada uno roto en
5.461 tramos de ids. Lo que hace barata una ventana es **la curva de Morton** —un rectángulo sobre
orden Morton son O(√n) tramos— y no la jerarquía. La pirámide es rangos Morton. Lo que queda abierto
es si la jerarquía sirve para que una vista alejada *signifique* algo, que es otra pregunta y está
sin medir.

## Los pasos

Abajo están escritos en el orden en que se descubrieron; **el orden en que se hacen es esta tabla**, y
lo manda la escala, no la pulcritud:

| | paso | por qué ahí |
|---|---|---|
| ~~1~~ | dirección + caché + tamaño de tesela · **hecho** 2026-08-17 | la tesela de 4.096 **ya estaba**; la caché es lo que faltaba |
| 2 | ~~trocear aristas~~ **hecho** · `by_target` teselado 2026-08-17 · queda **una** costura del escritor | el join O(N), y la otra mitad del larger-than-RAM |
| 3 | multi-tipo por vecindad | sin esto un grafo de conocimiento no dibuja **ni una** arista cruzada |
| 4 | `explore` implementado **por direcciones** | intentado con CTE recursiva y **cuelga la conexión**: ver BENCHMARKS |
| 5 | la vista alejada | la mitad de la experiencia a diez millones, y sin diseñar |
| 6 | la capa de aristas (CSC + densidad) | corrección primero, niebla después |
| ~~7~~ | ~~la fuente pasa a `MosaicClient`~~ · **hecho** 2026-08-17 | mueren los dos hacks; los −40 ms **no existían** — ver abajo |
| ~~8~~ | ~~encuadre desde el extent~~ · **hecho** 2026-08-17 | quedan las constantes: `fixed`, `fill = "community"`, `lodThreshold` |
| ~~9~~ | ~~que la imagen se lea~~ · **hecho** 2026-08-17 | era el mezclado aditivo, no la opacidad |
| 10 | el cromo sube, y el workspace reescrito es la prueba | cierra la API y absorbe lo que queda de `ONE-SOURCE.md` |

Los baratos —8 y 9— se hicieron primero, fuera de turno, porque eran lo único que el lector notaba y
costaban una tarde. El 7 se hizo después por la misma razón y por una segunda: la mitad de su premisa
era falsa y sólo se sabía midiéndola. Entre los grandes, que quedan todos: **1 → 2 → 3**.

### La dirección entra en el contrato — con caché y tamaño de tesela

`decisions/a-tile-is-an-address-not-a-verb.md` ganó el argumento —la cámara se **direcciona**, no se
consulta— **y la conclusión no llegó al contrato**: `openCorpus` direcciona por dentro (cajas de
tesela, aritmética pura, cero peticiones entre que la cámara se mueve y una URL es calculable) pero
por fuera recibe un `Viewport` y devuelve una `Slice` entera.

Las consecuencias, todas medidas o evidentes:

- **No puede haber caché, y la forma de la interfaz es lo que lo impide.** Un rectángulo es una clave
  de caché continua; una dirección de tesela es discreta. `BENCHMARKS.md` tiene la caché en la lista
  de arreglos con la nota de que es **lo único que ninguna optimización de consulta sustituye** — y
  hoy es inconstruible, porque el framework nunca ve el direccionamiento.
- **No hay refinamiento ni continuidad.** Cada respuesta reemplaza a la anterior; deck.gl mantiene la
  tesela padre visible mientras carga la hija.
- **`limit` trunca arbitrariamente.** `n` confiesa cuántos coincidieron, pero *cuáles* vuelven lo
  decide un `ORDER BY id`. Una ventana truncada se ve exactamente igual que una completa.

La forma:

```ts
interface Addressable {
  /** Puro: de una pregunta a direcciones. Ni una petición. */
  resolve(question: Region | Neighbourhood): Address[];
  /** Una dirección, un trozo. Cacheable, abortable, reusable. */
  fetch(address: Address, signal: AbortSignal): Promise<Chunk>;
}
```

Caché, aborto, prefetch y refinamiento se escriben **una vez, en el framework**, y sirven a los dos
tipos de pregunta.

**La caché ya está, y midió mejor de lo esperado.** Una tesela se trae entera y se registra como
fichero en DuckDB-WASM, así que una ventana que vuelve lee de memoria. Contra `/bench/1000000`, una
ventana de 20.000 marcas: **82 ms en frío, 3 ms al repetir, 41 ms en un pan solapado** — y la línea
base registrada para ese corpus era 210 ms de primera rebanada y 93 ms de pan. El frío *mejora*
porque un puñado de teselas de 74 KB en paralelo bate a los viajes de metadatos que sustituye.

La primera versión guardaba **todas** las teselas y eso costó **17.979 ms** en frío: registrar una
tesela es bajarla entera, y las de aristas son enormes. De ahí la regla, que es del propio dato y no
un flag: **una tesela se guarda cuando es barata de traer entera** (256 KB). Y hace que el cambio del
corpus pague dos veces — a 4.096 filas por tesela todas caen bajo la barra y el camino entero pasa a
ser cacheable sin tocar el lector.

**Lo que queda de este paso.** El tamaño de tesela (vive en rmlext) y meter `resolve`/`fetch` en el
contrato, que **hoy no hace falta**: la caché vive dentro de `openCorpus` porque es la única fuente
direccionada que hay. El contrato se parte cuando haya una segunda, y no antes — la regla de la casa
es no añadir una forma de expresar algo hasta que haya dos sitios que la expresen.

**Y aquí es donde entra la escala, no sólo la limpieza.** Este paso incluye las dos cosas que la
medición de peticiones exige, porque son la misma pieza:

- **Teselas de 4.096 filas** — 78 peticiones y 1,48 MB por ventana fría a cinco millones, contra 208
  y 12,12 MB hoy. Es el término que sigue a N.
- **Caché de direcciones**, que es lo que hace gratis *volver*. Cuidado con lo que promete: dos de
  seis pasos de arrastre a diez millones transfieren cero bytes y aun así cuestan 247 peticiones. La
  caché responde al payload; a la metadata responde el tamaño de tesela. Hacen falta las dos.

**La pirámide es de rangos Morton, no de comunidades** — medido, ver arriba.

**Lo que revertiría esto:** que una fuente real no pueda enumerar direcciones sin preguntar — es
decir, un origen sin manifiesto ni estadísticas, donde «qué toca este rectángulo» sólo lo sabe el
servidor. Ahí `resolve` deja de ser puro y el contrato de rectángulo era el honesto.

### La fuente pasa a `MosaicClient`

Hoy el lienzo consulta con `onceQuery` — un cliente de usar y tirar por consulta, un camino paralelo
al del resto de la página. Y el crossfilter se une por fuera: un `IdSetClient` calcula los
supervivientes y el lienzo los pinta con `highlightedPointIndices`.

Con `fields()`/`query(filter)`/`queryResult(data)`/`filterBy`:

- **muere `onceQuery`** y deja de haber dos caminos de consulta;
- **muere el greyout como apaño**: el predicado del crossfilter entra *en la consulta de la rebanada*,
  así que se dibuja lo que sobrevive en vez de pintar encima lo que no;
- el coordinador se encarga del ciclo de vida, la cancelación y la consolidación.

**Hecho el 2026-08-17, y el número que lo justificaba era otro.** Lo que este paso prometía —el
conector propio, ~95 ms a ~40 por pan— **no existe**: `probeConnectionOverlap` da a una conexión un
`ORDER BY` sobre 8M de filas y a otra un `SELECT 1` en el mismo tick, y el trivial contesta 0,1 ms
*después* del ordenamiento, cuatro veces de cuatro (511,8/511,7 · 462,9/462,8 · 454,8/454,7 ·
449,5/449,4). DuckDB-WASM es **un worker detrás de un puerto**: las conexiones hacen cola, no se
solapan. Otro conector compra un registro más y cero concurrencia.

Lo que sí se ahorra en consulta es pequeño y honesto: la tercera consulta desaparece —
`count(*) OVER ()` se evalúa antes del `LIMIT`, así que la lectura de puntos ya sabe cuántos
coincidieron— y el pan pasa de **29,0 ms a 25,1 ms** de consulta, con `matched` idéntico (28.424).

**El coste grande estaba en el otro lado, y ese sí se fue.** El greyout costaba, por cada cambio de
filtro a un millón: 377 ms de escaneo de supervivientes, 43 ms de empaquetado a identidades y 30 ms
de búsqueda — 450 ms para sombrear una imagen que nunca pasa de 20.000 marcas. El predicado en la
consulta cuesta lo contrario: la misma ventana midió **8,4 ms filtrada contra 12,0 ms sin filtrar**.
Ver `decisions/a-filter-is-a-predicate-not-a-mask.md`.

**Y el greyout no murió del todo, porque eran dos cosas.** *Qué sobrevive a los filtros* es la
consulta; *qué acabas de seleccionar* es un conjunto que el host ya tiene, y pintarlo con
`highlightedPointIndices` sin consulta ninguna es para lo que esa API existe. Lo que se fue es el
viaje de ida y vuelta. Y al dibujarse lo que sobrevive, el lienzo **recupera la exención** sobre su
propia cláusula: un lazo filtra los gráficos y deja el lienzo mostrando el lazo en contexto.

**Trampa que no se puede olvidar:** el consolidador difiere cada lote por `requestAnimationFrame`,
que no dispara en pestaña oculta. Puentearlo deja correr la tubería y **falsea las latencias**.

### `explore` se implementa — y **sale de la lista de borrado**

`ONE-SOURCE.md` §3 lo tenía condenado porque `memorySource` era su única implementación. **Se
revierte**: la razón por la que existía —*un rectángulo no puede expresar «dos saltos desde este
nodo»*— es exactamente lo que Ángel pide («obtén todas las aristas vecinas»), y es la costura por
donde entra el `expand` de fossil.

**Intentado el 2026-08-17 con una CTE recursiva sobre la relación de aristas, y descartado por
medición:** un salto desde una semilla sobre 6,9M de aristas no volvió en 45 s, y como Mosaic
serializa por una conexión en FIFO, se llevó por delante la pestaña entera — un `openCorpus` que
tarda 708 ms en caliente también expiró, encolado detrás. El término de adyacencia materializa 13,8M
de filas antes de empezar a recurrir, y ningún `limit` sobre la respuesta acota lo que cuesta
*encontrarla*.

La forma correcta es la que ya dice el plan: **un salto es direccionable**. Las aristas salientes de
un vértice están en la tesela `by_source` en la que cae su `dense_id`, y las entrantes en la de
`by_target`; un salto es leer esas dos teselas, filtrar sus filas y recoger los extremos — lecturas
de 74 KB que la caché de teselas ya sirve. Lo que falta para eso es que `by_target` esté teselado
como `by_source`, que es del lado del corpus. Seguir sólo las salientes no es media respuesta, es una
respuesta equivocada: «los papers de este autor» es una arista entrante.

La implementación no es una extensión de DuckDB en C++ compilada a WASM —eso es una cadena de
herramientas entera y un artefacto firmado por plataforma para expresar en SQL lo que ya se puede
expresar en SQL— sino **macros de tabla registradas al abrir el corpus**, junto a las vistas:

```sql
corpus_neighbours(seeds, depth)   -- CTE recursiva sobre by_source/by_target
corpus_edges_of(ids)              -- las aristas incidentes, sin salir a JS
```

Es la forma que ya tiene el otro lado: `fossil-mcp` se describe como *abrir un dataset, registrar
vistas sobre el Parquet, despachar un verbo*. Las macros son el tercer paso, hecho en SQL, y dejan el
vocabulario del grafo **dentro de la base de datos**, que es lo que hace que lienzo, gráficos y
verbos hablen el mismo idioma.

Y una vecindad es **la segunda clase de dirección** del contrato: su clave es `(semillas, profundidad)`.
La misma caché la sostiene.

*(Por comprobar, no dado por hecho: SQL/PGQ vía DuckPGQ es la referencia real para consultas de grafo
en DuckDB. Si estuviera disponible en WASM sería literalmente «la extensión de grafos».)*

### Las constantes que posee el otro lado salen del manifiesto

La regla: **una constante es legítima cuando este lado posee el hecho.** Cuando lo posee el otro hay
dos mecanismos honestos y el repo ya tiene los dos — leerlo en ejecución (como `openCorpus` hace con
`type`, `prefix` y `chunk_size`) o generarlo (`check:generated`). La mitad del grafo no usa ninguno.

Lo que queda vivo:

- **`SPACE = 4096` está escrito tres veces**: `packages/graph/src/graph-model.ts:26`,
  `docs/showcases/graph-bench/corpus/build-corpus.mjs:43` y `build-kg-corpus.mjs:48`. El que escribe
  las coordenadas y el que las dibuja declaran cada uno la caja, y nadie comprueba que coincidan. Si
  divergen, parte del corpus cae fuera del espacio del renderizador y **el modo de fallo es que hay
  nodos que no se dibujan**: no salta nada, la imagen sólo empeora. Es `CHUNK_SIZE` con otro nombre —
  y aquél leyó una fracción del corpus en silencio y publicó un número rápido.
  **La caja pasa a ser el extent del corpus**, que ya se lee de los pies de tesela.
- **El bloque `fixed`** (`dense_id`, `subject`, `x`, `y`, `src_dense`, `dst_dense`) y el
  **`fill = "community"`** por defecto (`duck-source.ts:675`) los declara el manifiesto.
- **`lodThreshold = 0.5`** perdió su ancla y el fichero lo confiesa: igualaba al verbo `viewport` de
  fossil, que se borró. O se deriva, o se le escribe la razón de ser ese número.

**Y esto arregla la imagen que Ángel está viendo.** Medido en el navegador el 2026-08-17 sobre el
workspace: el archivo ocupa `x ∈ [1843, 2253]`, `y ∈ [1843, 2253]` de una caja de 4096 — **el 1% del
área** — y la cámara abre mirando la caja, no los datos. Los 1.543 puntos están en la GPU, sin NaN,
con tamaños de 2,2–9 px y alfa 1: **no falta ningún nodo, no se ven**. Encima, 4.280 enlaces curvos
con `linkBlending` aditivo a opacidad 0,45 sobre puntos que no escalan con el zoom
(`scalePointsOnZoom: false`) y `pointOcclusionCulling: true` descartando los solapados.

**Encuadrar deja de ser deber del host**: abrir un corpus enmarca la vista. `CorpusSource.extent()`
existe para eso y no lo llama nadie.

### El cromo que no difiere nunca sube al paquete

«Pocas líneas para reproducir el workspace» y «el paquete no lleva leyenda ni inspector» son
incompatibles. Se reabre `decisions/a-canvas-component-owns-the-three-that-never-differ.md` — que es
lo que la tercera constante de `CLAUDE.md` permite — con el **mismo listón que pasó el lienzo**: sube
lo que es idéntico en todo producto de grafo, se queda fuera lo que difiere.

- **Sube la leyenda**: es una función pura del canal `fill` y del corpus.
- **Sube la barra de comandos**: zoom, fit, pausa, unpin son comandos que el lienzo ya registra.
- **Sube el chip de selección**: `cursorChip` ya existe.
- **Sube la unión con el crossfilter**: publicar la selección como cláusula lo reescribe hoy cada host.
- **Se queda como hook el inspector** (`useGraphDetails`): el mecanismo es común, la maquetación no.

El objetivo:

```tsx
const corpus = await openCorpus({ dest: "/corpus/archive" });

<GraphProvider corpus={corpus} fill="kind" r="degree">
  <GraphCanvas>
    <GraphLegend />
    <GraphToolbar />
    <GraphInspector fields={ARCHIVE_FIELDS} />
  </GraphCanvas>
</GraphProvider>
```

**La prueba es el workspace reescrito encima.** Si no baja a decenas de líneas más sus paneles de
producto, la API no está terminada — y eso es una condición de aceptación, no una aspiración.

### fossil trocea las aristas

Lo único que ninguna elegancia de API sustituye. `BENCHMARKS.md`: los vértices se tesela­ron y las
aristas se dejaron enteras, y **las aristas son la mitad que escala** — `points` es plano (2 ms a un
millón, 2 ms a cinco) y `links` gasta 17 ms de CPU contra 45 porque une la tabla entera: 6,9M de
filas contra 35M, un fichero, sin orden espacial. Es el 77 → 256 ms del pan.

GraphAr **ya especifica el troceado** y el escritor no lo emite (ADR-0041). Vive en rmlext.

**Y en la misma casa, la otra mitad del «larger than RAM»: las tres costuras que coleccionan.**
`GraphArData` retiene cada lote antes de escribir un byte; `to_files()` codifica cada Parquet antes
de tocar disco (+0,58 GiB a diez millones); el paso de layout mete la lista de aristas entera en un
`Vec` mientras Louvain sostiene estado O(n) (+2,22 GiB). Las tres son costuras nuestras donde el
motor ya transmite — el mismo hallazgo que rmlext ADR-0043 alcanzó un piso más abajo con
`query_map` frente a `stream_arrow`. Sin esto, escribir un corpus mayor que la máquina sigue sin
estar probado, y a 100M la respuesta es no.

### Multi-tipo: una ventana **no dibuja ni una** arista entre tipos

Medido, y es el hallazgo que más cambia el diseño: de cada arista que sale de los vértices de una
ventana, las que caen dentro de la misma ventana son el **91%** si es del mismo tipo y el **0,00%**
si cruza tipos. Cero, a los tres tamaños, sobre todas las ventanas. *«Una ventana que contiene un
paper no contiene ni un solo autor, congreso o tema al que ese paper apunta.»*

No es una cola larga: es por construcción. `place_after` desliza cada tipo detrás del anterior, y
`self_edge_csr` filtra las adyacencias a `src_type == dst_type`, así que las relaciones cruzadas ni
siquiera entran en el layout. La mediana de una arista cruzada es **26.000× la mediana de una propia**
y mide media anchura del corpus — treinta anchuras de ventana.

**Consecuencia para keasy, que es el destino de la migración:** un grafo de conocimiento es
multi-tipo por definición, y el modelo espacial dibuja *sólo* la estructura intra-tipo. La única
forma de dibujar lo que cruza es **la segunda clase de dirección** — «los papers de este autor» es
una segunda ventana, en el espacio de `dense_id` de otro tipo y en otros ficheros.

Esto asciende `explore` de comodidad a **mecanismo obligatorio**, y le añade requisito: una
vecindad son *dos o más* búsquedas, y la identidad tiene que cruzar tipos — que ya lo hace,
`vertexId(type, dense)` es el par por esta razón exacta.

### La vista alejada no tiene diseño

Hoy, alejarse por debajo de `lodThreshold` agrega por la columna de categoría. A cinco millones
`community` tiene **ocho grupos**: una vista de todo es una imagen de ocho puntos. Y `BENCHMARKS.md`
lo deja abierto en una frase — *si la jerarquía sirve para que una vista alejada signifique algo es
otra pregunta, y está sin medir*.

Para «grafos muy grandes en cliente web» la vista alejada es la mitad de la experiencia, y ahora
mismo es lo único del camino acotado que nadie ha diseñado ni medido. Va después de que la pirámide
sea de rangos Morton, porque es lo que le da niveles.

### La capa de aristas, con dos agujeros

- **Las aristas con un extremo fuera de la ventana se descartan en silencio.** No es una
  imposibilidad: el corpus lleva `by_target.parquet`, la mitad CSC, precisamente para responder «una
  arista con un extremo fuera de pantalla». Lo que falta es la segunda pasada de direccionamiento y
  la decisión de renderizado (recortar el segmento contra la ventana). Un lector ve menos aristas de
  las que hay y nada se lo dice.
- **A partir de un millón, dibujar segmentos produce niebla.** Apenas sobreviven a la ventana, y
  gastamos el join en generarla. Ahí es donde entra la familia `raster`/`density` de Mosaic: la
  agregación ocurre en DuckDB y llega una imagen, con los puntos en cosmos.gl por encima. Componer
  las dos referencias en vez de elegir una.

### Que la imagen se lea, que no es lo mismo que encuadrarla

«Que salgan del manifiesto» encuadra; esto es lo que queda cuando ya está encuadrada, y es lo que Ángel está viendo:
4.280 enlaces **curvos con mezcla aditiva** a opacidad 0,45 sobre puntos de 2,2–9 px que **no escalan
con el zoom**, y `pointOcclusionCulling` descartando los solapados. La maraña blanca gana siempre.

Los defectos del `Look` son una decisión de diseño que nunca se probó contra un corpus denso. Es
barato y es lo primero que se nota.

---

## Lo que ya está hecho y sostiene esto

- **Los canales son cuatro y una vinculación no es un tema.** `fill`, `symbol`, `r`, `stroke` como
  props, con la regla de Plot —una constante CSS es constante, cualquier otra cosa es columna— así
  que el monocromo es `fill="var(--foreground)" symbol="kind"`. `Look` es forma y nada más;
  `gradeComposition` gradúa lo que el host compuso y **muerde** donde antes no reportaba nada. Cerró
  `decisions/a-look-is-form-and-a-channel-is-a-binding.md`, que otra sesión dejó abierta.
  Trampa que costó un render: con `fill` constante la consulta se queda sin columna categórica y cae
  al defecto del origen. La columna que se pide es **la primera vinculación que nombra una**.
- **El lienzo encuadra lo que hay.** `extent()` sube a `BoundedSource` como opcional, `duckBoundedSource`
  gana la suya, `CorpusSource` se borra, y el bucle encuadra **antes** de la primera pregunta.
- **Los enlaces dejan de sumarse por defecto** (`link.blend`). Era el defecto de cosmos.gl que nadie
  había elegido, y era la causa de que el archivo se viera como una nube blanca.

- **Los canales son props** (`fill`, `r`) de `useGraph` y `GraphCanvas`, verificado en el navegador:
  cambiar uno re-pregunta sobre los mismos bytes y **no recuenta el corpus**. Es la primera pieza de
  esta API y encaja sin cambios. Guard: `packages/graph/src/use-bounded-graph.test.tsx`.
- **`openCorpus`** devuelve las dos mitades —fuente para el lienzo, vistas registradas para las
  preguntas— que es la forma de `fossil-mcp` y la base del paso 5.

## Cómo entregar esto sin romper el repo

`decisions.test.ts` exige que el `Held by` de una decisión **cite un símbolo que exista ya** en el
fichero citado. Así que **ninguna decisión se escribe por delante de su código**: cada una aterriza
con su cambio, en el mismo commit. Este fichero es lo que va por delante.

Y el guard tiene un punto ciego que costó una tarde: busca el símbolo como **texto** en el fichero,
así que un comentario obsoleto lo mantiene verde. `a-tile-is-an-address-not-a-verb` estuvo en verde
citando `corpusSource` cuando ese símbolo ya no existía — sobrevivía sólo en un JSDoc.


---

## Lo que rmlext dejó listo, y lo que el lector tiene que escribir ahora

Cerrado el 2026-08-17 por el agente de rmlext, medido con `duckdb` nativo sobre los corpus de
`apps/corpus/guards/fixture.mjs` a 250k, 1M y 4M, doce semillas repartidas por el espacio de ids y
cada respuesta direccionada comparada fila a fila contra la escaneada:

- **`by_target` está teselado exactamente como `by_source`.** Cada orientación se corta por la
  columna por la que está ordenada, en el espacio de teselas **de su propio extremo** — la
  `by_target` de una arista entre tipos se corta por los rangos del destino, no por los del origen.
  La conformidad camina las dos orientaciones y añade una comprobación de salto: para cada vértice,
  las aristas que guardan las dos teselas que su `dense_id` nombra son exactamente las que guarda la
  relación entera. Pasa sobre un `fossil run` real; 15/15 guards, 17 mutaciones disparan.
- **Un salto lee 113,0 kB planos** a los tres tamaños, contra 6,9 / 27,5 / 110,2 MB de los dos
  ficheros de relación: 61× a **975×**, y la distancia crece con el corpus. En reloj, mediana:
  direccionado 8 / 2 / **1** ms; escanear la relación 5 / 5 / 16; `WITH RECURSIVE` un salto 4 / 7 /
  23. **A 250k el salto direccionado es el más lento de los tres** — está en sus documentos, y es la
  clase de dato que un informe cómodo se dejaría fuera. DuckDB nativo con todos los núcleos y
  fichero local es el caso fácil para los otros dos, así que esos milisegundos son el **suelo** de la
  diferencia; lo que se traslada a un lector WASM de un hilo sobre HTTP es la columna de bytes.
- **Cuesta la relación de aristas una cuarta vez en disco**: 57,2 MiB sobre un corpus de 247,1 MiB a
  4M vértices, **+23%**, y **cero** para un lector que sólo dibuja.

**Lo que este repo tiene que escribir, sin inventarse nada:**

- Fichero: `<dest>/edge/<Src>_<label>_<Dst>/by_target/tile{k}.parquet`, con `k = dst_dense >> 12`,
  filtrando `dst_dense = v`. Las salientes no cambian: `by_source/tile{v >> 12}.parquet`, `src_dense
  = v`. **Una tesela sin filas no se escribe: el 404 es la respuesta.**
- Manifiesto: cada entrada de `adj_lists` lleva ahora `prefix` (`by_source/` / `by_target/`) junto a
  `aligned_by`. El desplazamiento sale de `src_chunk_size` para la lista alineada por origen y de
  `dst_chunk_size` para la alineada por destino — en una arista entre tipos **son espacios de
  `dense_id` distintos**. No se codifican a mano los nombres de directorio: es exactamente la clase
  de constante que este plan lleva todo el día matando.
- **El camino de dibujo no cambia.** Una ventana sigue pidiendo sólo `by_source`.
- El corpus hay que reescribirlo para que existan las teselas de destino; el manifiesto gana el
  campo en cualquier caso.

**Lo que queda abierto del escritor:** dos de las tres costuras ya estaban cerradas antes de empezar
(`to_files` refutada por medición a 0,02 GB, y el `Vec` del layout a CSR en streaming, −1,71 GiB). La
tercera, `GraphArData` reteniendo cada lote, sigue abierta — y con una **hipótesis, no una medición**,
escrita en sus documentos: «escribe cada tabla y suéltala» no libera nada en el corpus donde se
midieron los 1,64 GiB, porque la mitad de vértices no se puede transmitir (la fase de aristas une
contra los mismos buffers Arrow registrados como `MemTable`). La mitad de aristas no la sujeta nadie
y es ~65% del límite por aritmética de filas: ahí debe apuntar el siguiente intento, con
`FOSSIL_MEM_PROBE=1` antes y después en sus criterios de aceptación.
