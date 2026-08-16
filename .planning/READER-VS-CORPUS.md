# El lector contra las cinco convenciones — auditoría, 2026-08-14

Trabajo A de `.planning/ANALYTICS-AND-GRAPH.md`. Lectura pura: `conventions/{identity, addressing,
adjacency, order, payload}.mdx` de `rmlext/apps/corpus` contra `packages/graph/src/{bounded,
duck-source, resident, memory-source}.ts`, más el único sitio que abre un corpus de verdad,
`docs/showcases/graph-bench/measure-bounded.ts`.

Nada aquí se ha ejecutado. Todo son lecturas de fichero, y donde una afirmación depende de correr
algo se dice.

---

## 0 · El resultado en una frase

**No hay un lector direccionado.** Lo que existe es un `BoundedSource` sobre dos relaciones de DuckDB
que expresa la ventana como un `WHERE`, que es exactamente la línea que `without-fossil.mdx` §3
marca en un callout de aviso: *«Pruning is not a predicate. It is a choice of what to read.»*

De las cinco convenciones, **una la cumplimos y la derivamos por separado** (identity, en su mitad
de anchura), **una la contradecimos de frente** (addressing), **una la contradecimos en un detalle
medido** (payload, `x`/`y` intercalados), y **dos no nos aplican todavía** (adjacency, order) porque
el camino que las usaría no está escrito.

Y hay una constante caducada que, si alguien construye los corpus hoy y corre el sweep, **no falla:
lee el 3,7% del corpus y publica un número rápido**. Está al final, en §6.

---

## 1 · Identity — coincide en lo estructural, difiere en lo que es una identidad

| afirmación de la página | nosotros | |
|---|---|---|
| `dense_id` es un `0..V−1` sin huecos por tipo | `DuckSourceOptions.idField` lo exige y lo documenta | coincide |
| Cruzar a JS es `BigInt`, un `Number` es incorrecto | `VertexId = bigint & marca`; `resident.ts` cita rmlext ADR-0045 y el mismo caso `node-s2` | coincide |
| `>>` significa tres cosas distintas entre capas | documentado en `resident.ts`, y el empaquetado no se puede escribir sobre `number` | coincide |
| Un `dense_id` solo no identifica: numera dentro de un tipo | `vertexId(type, dense)`, y `SUPERNODE = 0xffff` para que un grupo no sea un vértice | coincide |
| Un visor que sigue la selección **por índice de buffer** ha guardado una dirección dos veces | `residentOf` re-resuelve por identidad en cada respuesta; los índices nunca sobreviven a una respuesta | coincide, y derivado aparte |
| **La identidad es la IRI del sujeto**, columna `subject`, y todo lo que vive fuera del corpus llavea por ella | **no leemos `subject` en ningún sitio.** No hay `subjectField` en `DuckSourceOptions`, ni hueco en `Slice` | **difiere** |
| Un `dense_id` puede llevar más de 53 bits | `DENSE_MASK = 0xffff_ffff`: asumimos `UInt32`, y `denseOf` devuelve `number` | **difiere (más estrecho)** |

### El `subject`, que es el hallazgo

La página distingue *dónde está* un vértice de *cuál* es, y dice que rehacer el layout renumera
todo: un `dense_id` guardado fuera del corpus nombra otro vértice tras la siguiente escritura.
Nuestro `VertexId` es el par `(type_idx, dense_id)` — es decir, **una dirección con dos campos**, no
una identidad.

Lo que salva la mitad del caso: la misma página dice que la tesela de dibujo lleva direcciones y que
la IRI se busca cuando algo hay que *nombrarlo*, medido a 1,87× la tesela. Nuestro camino de pintado
es correcto por esa regla. Lo que no tenemos es el otro lado: **no hay ninguna forma de nombrar un
vértice.** Una selección sobrevive a un `pan` y no sobrevive a un recompilado, y un marcador hacia
fuera —un enlace, una fila en la base de datos de otro— no se puede escribir.

Consecuencia concreta para keasy: cualquier cosa que se guarde de una sesión de exploración caduca
con el siguiente `fossil run`, en silencio.

### Los 32 bits

La página dice «unsigned que puede llevar más de 53 bits» y publica vectores en 2³¹ y 2⁵³
precisamente porque ahí es donde una implementación equivocada todavía acierta. Nosotros fijamos el
dense a 32 y el tipo por encima. Además el dense pasa por un `Float64Array` en `duck-source.ts:295`
(`fillColumn` escribe `Number(…)`), exacto hasta 2⁵³ y por tanto correcto **mientras el dense sea de
32 bits** — que es una hipótesis nuestra, no de la página.

Decisión pendiente: o declaramos el `UInt32` como contrato nuestro (y entonces el `type_idx` se
queda con 32 bits que no necesita), o el par se re-empaqueta. No urge; sí hay que declararlo.

---

## 2 · Addressing — difiere de frente

| afirmación | nosotros | |
|---|---|---|
| `tile = dense_id >> 12`, y el lector calcula toda URL antes de emitir la primera | no calculamos ninguna tesela en el paquete | **no implementado** |
| El podado **no es un predicado**; es elegir qué bytes leer | `bboxSql()` construye `x >= … AND x <= … AND y >= …`, y `visibleCte` lo mete en un `WHERE` | **difiere** |
| La estadística de row-group del footer dice qué teselas cortan la ventana | `parquet_metadata` no aparece en `packages/`; solo en un script de medición offline | **no implementado** |
| `chunk_size` es potencia de dos o el corpus no tiene dirección | el fixture lee con `CHUNK_SIZE = 122_880` | **difiere — ver §6** |
| Dos contenedores, nunca los dos a la vez | el fixture usa un fichero por tesela para vértices y un fichero único para aristas | difiere del recomendado |

Esto no es un descuido: `duck-source.ts` lo dice de sí mismo en su cabecera — *«el verbo para el que
se escribió nunca aterrizó: `viewport` se cayó y GraphAr con él, porque la cámara se direcciona en
vez de consultarse. Lo que lo sustituye es una tesela traída por URL calculada, que es otra
fuente.»* La fuente direccionada está reconocida como pendiente y no escrita.

**Lo que sí hacemos bien por accidente:** el `JOIN` liso contra el CTE visible es exactamente el plan
que la página mide en 5 ms y prefiere a las dos formas de pedir los runs (237 ms y 189 ms/2,3 s de
CPU). No estamos lentos; estamos en el lado equivocado de la distinción.

**Y hay un tercer coste que la página no cubre y nosotros pagamos:** `detail()` lanza
`SELECT count(*) FROM nodes WHERE bbox` en cada slice, para poder decir «hay más de lo que enseño».
Es la única consulta del camino que escala con el corpus y no tiene nada que podar.

---

## 3 · Adjacency — no aplica hoy, y una limitación coincide

| afirmación | nosotros | |
|---|---|---|
| `by_source` es CSR y `by_target` CSC, ambas en disco | el fixture solo abre `by_source.parquet`; el paquete no sabe de orientaciones | no aplica |
| Leer el fichero *como la CSR que ya es* evita el pre-paso de grados | hacemos un `JOIN` de hash contra el CTE; no escaneamos un run | no aplica |
| Una arista vive en la tesela de su origen: las teselas de la ventana son un superconjunto exacto | no teselamos aristas | no aplica |
| El orden secundario no se puede asumir | no lo asumimos | coincide |
| Una arista con un extremo fuera necesita la mitad CSC | la descartamos: *«an edge with one end off-screen has nowhere to land»*, en los dos sources | coincide en el hecho, difiere en la lectura |

Ese último punto es la refutación sin recoger del §3E del plan. La página la trata como una pregunta
distinta que el corpus **ya puede responder** (lleva la mitad CSC), no como algo indibujable.
Nosotros lo tenemos escrito como si fuese imposible. Cuando se recoja, la frase de los dos ficheros
es lo que hay que cambiar.

`memorySource` construye la adyacencia no dirigida (`adjacency[src].push(dst)` y al revés), que es la
unión CSR+CSC hecha en memoria. Consistente, sin conflicto.

---

## 4 · Order — no aplica, y la doctrina coincide

No calculamos Morton, no cuantizamos, no dependemos del orden espacial en ninguna línea del paquete.
La localidad que DuckDB nos da al podar row-groups la recibimos sin razonarla.

Lo que sí coincide, y llegó por separado: la cabecera de `bounded.ts` dice **«las posiciones son
autoridad, no sugerencia»** y «no re-maquetes un slice: si un layout está mal, está mal aguas arriba
y se arregla recompilando». La página de Order llega a lo mismo desde el otro extremo — rehacer el
layout renumera todo, luego el `dense_id` no puede ser la identidad. Dos derivaciones independientes,
misma conclusión.

Riesgo diferido: la aritmética de la cuantización es **binary32 por contrato**, incluida la
multiplicación por 65535 y el redondeo. El día que escribamos el lector direccionado, esa anchura es
la primera cosa que se copia mal.

Y una medición nuestra ya tocó la consecuencia sin implementar el código: en `measure-bounded.ts` la
ventana de `pan` pasó de una franja de altura completa a un rectángulo con la forma del canvas
porque la franja *«corta a través del orden Morton en que está escrito el corpus»* — 7 chunks de 9
frente a 4.

---

## 5 · Payload — difiere en una cosa, y creo que la página es la que se pasa

| afirmación | nosotros | |
|---|---|---|
| Parquet plano, row-groups de 4.096, una tesela es un row-group | no leemos row-groups | no aplica |
| Leer `min_value`/`max_value`, no `min`/`max` | no leemos estadística ninguna | no aplica |
| El page index no lo abre nadie | tampoco nosotros | coincide por omisión |
| Codificación por columna | es del escritor | no aplica |
| **`x` e `y` como arrays separados, nunca intercalados**, «para que suban a la GPU sin transformación» | `Slice.positions` es `[x0,y0,x1,y1,…]`, y `arrays()` los intercala al escribir con `stride` 2 | **difiere** |

El intercalado no es nuestro capricho: `graph.setPointPositions(slice.positions)` de cosmos.gl toma
un `Float32Array` intercalado, y es la única forma en que acepta posiciones. Así que la frase de la
página —*«suben a la GPU sin transformación»*— **es falsa para el consumidor de GPU que la página
cita como prueba**. Las columnas separadas son lo que Parquet hace de todas formas; el paso de
intercalado no se elimina por construcción, se mueve al lector.

Esto es lo que el plan preveía: un «difiere» donde la página es la que se corrige. La corrección
correcta es pequeña — decir que las columnas van separadas porque es lo que Parquet almacena y
porque deja al lector elegir el entrelazado que quiera su renderizador, no que no haya transformación.

---

## 6 · La constante caducada, que es lo único accionable hoy

`docs/showcases/graph-bench/measure-bounded.ts:170`:

```ts
const CHUNK_SIZE = 122_880;
```

`rmlext/crates/fossil-sinks/src/manifest.rs:214`:

```rust
pub const DEFAULT_CHUNK_SIZE: u64 = 1 << TILE_SHIFT;  // TILE_SHIFT = 12 → 4.096
```

El comentario que acompaña a nuestra constante predijo el fallo y **erró el síntoma**: dice que se
notaría como *«un 404 en el último chunk»*. No. Con 4.096 filas por chunk, un corpus de un millón
tiene 245 chunks; nosotros generamos `ceil(1e6 / 122880) = 9` URLs. Las nueve existen. La vista abre
los `dense_id` 0..36.863 — **el 3,7% del corpus** — y el sweep publica un primer pintado
estupendo sobre él.

Y `fossil` documenta que 122.880 era *su* valor antiguo, «el `ROW_GROUP_SIZE` por defecto de DuckDB,
elegido cuando se pensaba que un chunk era un row group», dominado por Pareto y no potencia de dos.
O sea: la constante no solo está desincronizada, es la que la otra parte ya retiró por escrito.

**Nadie lo ha sufrido todavía** porque `docs/public/bench/` está en `.gitignore` y no existe en este
árbol: los corpus no están construidos y el sweep acotado hoy da 404 en todo. El fallo silencioso
llega en el momento en que alguien los construya.

Segundo riesgo del mismo sitio, sin verificar: fossil documenta las teselas de arista como
`by_source/tile{k}.parquet`, y nuestro fixture abre un `by_source.parquet` plano. Si el escritor ya
no emite el fichero plano, la vista de aristas revienta en vez de mentir. Se comprueba construyendo
un corpus pequeño y mirando el árbol.

---

## 6 bis · Contrastado contra un corpus real, la misma tarde

La auditoría de arriba se hizo leyendo las páginas contra nuestro código. Después se construyeron los
cinco corpus con el `fossil` recompilado, y lo que sigue está medido sobre el de 200.000 con `duckdb`
en la línea de órdenes — no sobre la documentación.

| convención | lo que dice la página | lo que hay en el árbol |
|---|---|---|
| identity — `dense_id` sin huecos | `0..V−1`, sin huecos ni repeticiones | `min` 0, `max` 199.999, 200.000 distintos sobre 200.000 filas ✅ |
| identity — la IRI es la identidad | columna `subject`, no nula y única en su tipo | 200.000 `subject` distintos, 0 nulos ✅ **y nuestro lector no la abre** |
| identity — anchura | «puede llevar más de 53 bits» | el manifiesto declara `dense_id: uint32` — nuestro `DENSE_MASK` de 32 bits **coincide con el escritor**, aunque sea más estrecho que la página |
| addressing — `chunk_size` | potencia de dos, 4.096 | `chunk_size: 4096` en el manifiesto, y `ceil(V/4096)` chunks exactos en los cinco tamaños ✅ |
| payload — una tesela es un row group | 4.096 filas | `num_rows` = 4.096, un único valor distinto ✅ |
| payload — `min_value`, no `min` | los obsoletos van vacíos para una columna sin signo | `dense_id`: `min_value` sí, `min` **no**. `x`/`y`: ambos. Exactamente el aviso de la página ✅ |
| adjacency — las dos orientaciones | `by_source` y `by_target` | ambos ficheros escritos, más `by_source/tile{k}.parquet` ✅ **y solo abrimos el primero** |

Lo que esto cambia respecto a la auditoría de lectura: **nada se contradice y dos cosas se afilan.**
El techo de 32 bits es un acuerdo con el escritor de hoy y no una suposición nuestra; y el índice
del footer que nuestro lector nunca abre está ahí, escrito, correcto, y con la trampa del
`min_value` ya evitada por el escritor. Lo único que falta para el lector direccionado es el lector.

**El corpus del fixture no compilaba.** `bench.fossil` estaba escrito contra una gramática de fossil
retirada — `prefix`, CURIEs en posición de forma y propiedad, y la segunda ortografía de cadena con
backticks y `${…}`. 51 errores de tipado. Reescrito con `bench.shex` como documento de formas, y la
arista pasa a declararse `bench:linksTo @bench:Node ?` — una referencia de forma, porque un `.` la
convierte en una columna y la unión de las dos correspondencias revienta con «left has 5 columns
whereas right has 6». Es la misma deriva que `CHUNK_SIZE` y por la misma razón: este lado escribe a
mano lo que el otro lado posee.

---

## 7 · Qué decide cada «difiere»

1. ~~**`subject`** → nos movemos.~~ **Hecho.** `DuckSourceOptions.subjectField` y `Slice.subjects`,
   opcionales en ambos lados, más `MemoryGraph.subjects` para que las dos fuentes digan lo mismo. El
   segundo call site que la regla 2 pide es el benchmark, cuyo corpus sí lleva la columna.
2. **El podado como predicado** → nos movemos, y es la fuente direccionada que ya está reconocida
   como pendiente. Es trabajo grande y va después de la fábrica de Ark.

   **Y desde 2026-08-15 tiene precio.** Al reconstruir los corpus con el teselado nuevo, el primer
   pintado del millón pasó de 253 ms a 931 ms. Aislado sobre las mismas filas en tres contenedores
   —mismos bytes, misma consulta, mismo origen— el número de ficheros cuesta 1,7× y **el tamaño de
   row group cuesta 3,1×**, 5,3× juntos. El mecanismo es este mismo punto: un row group es la unidad
   que un lector *salta*, y saltar es para lo que sirve la estadística del footer. **Este lector no
   salta nada**, así que trocear más fino es metadato puro sin podado que lo pague. La medición y sus
   límites están en `BENCHMARKS.md`, «The same sweep after the tile size moved».
3. **`x`/`y` intercalados** → se corrige la página de rmlext.
4. ~~**32 bits de dense** → se declara.~~ **Hecho:**
   `decisions/a-dense-id-is-thirty-two-bits.md`. El techo es un acuerdo con el escritor, no una
   suposición: el manifiesto declara la columna sin signo de esa anchura.
5. **`CHUNK_SIZE = 122_880`** → se arregla ya. No es una convención, es una constante mal copiada.
