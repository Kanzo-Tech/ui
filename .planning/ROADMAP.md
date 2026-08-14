# El plan, los dos repos — 2026-08-14

`rmlext` escribe el corpus y `kanzo-ui` lo lee. Ya hay un roadmap para la mitad del grafo
(`.planning/GRAPH-ROADMAP.md`) y un plan de fases para el compilador
(`~/.claude/plans/tidy-bouncing-iverson.md`); **ninguno de los dos sabía del otro**, y los dos
estaban desfasados respecto del árbol. Esto los reconcilia contra lo que hay hoy en los dos
checkouts.

Regla de este documento: **cada fase se juzga por la prueba que ella misma declaró**, no por si
existe un ADR. Este repo tiene precedente de dar algo por terminado porque estaba documentado, y la
sección 1 tiene un caso en el que la prueba falla y está bien que falle.

---

## 0 · Seis ramas que parecen trabajo y no lo son

Esto va primero porque es la respuesta a «no quiero mil caminos»: **no hay mil caminos, hay un
tronco y seis ramas de adorno.**

**`rmlext`.** El tronco es `feat/pg-canonical-mir` (+202 sobre `main`, activo hoy). `main` **no se
mueve desde el 2026-06-08** — más de dos meses. Las demás:

| rama | qué es en realidad |
|---|---|
| `f3-descriptor-cache` | **ya en el tronco**, como ADR-0053 |
| `f6-salsa-shrinks` | **ya en el tronco**, como ADR-0052 |
| `f7-writer-measurement` | **ya en el tronco**, como ADR-0056 |
| `rdf12-base-direction` | **ya en el tronco**, como ADR-0051 |
| `feat/fossil-graph-w1` | 28 commits **por detrás** de main, 0 propios |
| `feat/w0-subprocess` | 2 commits por detrás, 0 propios |

Verificado por contenido y no por el nombre del fichero: entre
`f7-writer-measurement:decisions/0054-el-footer-es-el-indice.md` y
`feat/pg-canonical-mir:decisions/0056-el-footer-es-el-indice.md` la **única** diferencia son dos
líneas, y son el número en el título. Las cuatro se rebasaron al tronco y se renumeraron, que es por
lo que no figuran como ancestros y parecen trabajo abierto.

**Acción:** el tronco a `main`, y las seis se borran. No hay nada que rescatar en ellas.

**`kanzo-ui`.** `graph-tiles` está traído a `main` hoy (`35da59d`, fast-forward, todo verde).
`ds-colour-role-cut` está fusionada y es borrable. Queda un solo camino.

---

## 1 · fossil: dónde está de verdad el motor

El plan F1–F8 se escribió el 2026-08-07 y el tronco lo ha adelantado. Contra la prueba de cada fase:

| fase | qué pedía | ADR | estado |
|---|---|---|---|
| **F1** | una sola función xsd→`Primitive` | 0047 | ADR presente — *prueba sin verificar aquí* |
| **F2** | `call`, `comparison`, `conditional`, `pipeline` bajadas a MIR | 0049, 0050 | `HirExpr::Call` en `lower.rs` (6 sitios), `check.rs`, `stdlib.rs` |
| **F3** | caché por URI, `content_hash` poblado | 0053 | ADR presente — *prueba sin verificar aquí* |
| **F4** | el descriptor de salida llega al typecheck | 0055 | ADR presente — *prueba sin verificar aquí* |
| **F5** | `where`/`select` compilan; `rewrite.rs` no existe | 0054 | la decisión de `join` está tomada — *resto sin verificar* |
| **F6** | salsa fuera de `fossil-engine` y `fossil-df-wasm` | 0052 | **CANCELADA por medición**, ver abajo |
| **F7** | `arrow-rs` en vez de `COPY`, row groups de 4.096 | 0056 | `ArrowWriter` en `files.rs`, `examples/tile_layout.rs` presente |
| **F8** | 24 crates → 5–8 | — | pendiente, bloqueada por todas **a propósito** |

**F6 es el caso que justifica juzgar por la prueba.** `salsa` sigue en diez `Cargo.toml`, incluidos
los dos que la fase prohibía. No es deuda: ADR-0052 dice *«detiene F6 §§1–2»*. Se midió el antes y
el antes contestó — una consulta `#[salsa::tracked]` que no computa nada cuesta 72–76 ns, lo que pone
un **techo del 3,8 %** a lo que puede devolver salir de salsa, sobre un compile que es el 0,2 % del
mandato. El −52 % era de Apollo y sigue siendo suyo. **Una fase cancelada por una medición es un
resultado, no una tarea pendiente**, y el plan viejo la sigue listando como trabajo.

**El tronco además va por delante del plan**: ADR-0057 (`el nombre de una clase no es una cadena`),
0058 (`una identidad por tipo y el programa la declara`) y 0059 (`el punto es miembro-de y el tipo
decide qué hay`) no corresponden a ninguna fase F. El plan de fases ya no describe el trabajo.

**Lo que queda por verificar antes de fiarse de esta tabla:** las pruebas de F1, F3, F4 y F5 no se
han ejecutado en esta sesión. Son cuatro comprobaciones baratas y cada una está escrita en el plan
original; hasta entonces, «ADR presente» es todo lo que esta tabla afirma de ellas.

---

## 2 · El grafo: lo que ya está medido, y el rescate

De `GRAPH-ROADMAP.md`, medido el 2026-08-05:

- **Cerrado.** La unidad de tesela es un rango de **4.096 filas**, con las dos curvas medidas —
  bytes tocan fondo entre 1.024 y 8.192, peticiones caen monótonas, así que no hay óptimo común y
  la elección es `λ·β`. La identidad es `vertexId(type, dense)` como `bigint`, con el `Resident`
  como único mapa, verificado en vivo. El grafo de conocimiento transfiere tres de cuatro
  afirmaciones.
- **Abierto y barato: reescribir ADR-0042 §3.** Su premisa («una tesela es una comunidad») se cayó:
  las tiras son la curva de Morton. Quedan dos cosas en papel — dónde vive una arista (CSR, que es
  lo que describen las medidas, frente a LCA, que hace reaparecer el término no plano) y si hay
  árbol encima de la tesela. **Bloquea al emisor.**

**El rescate.** El roadmap del canvas da el ítem 5 (formato de la tesela) por bloqueado y discute
Parquet contra Arrow IPC. **Dos días después, el 2026-08-07, ADR-0056 lo contestó desde el lado del
escritor y nadie lo trajo de vuelta**, porque vivía en una rama aparcada:

> Un fichero con row groups de 4.096 domina un fichero por tesela **en todos los ejes**: 5,6
> peticiones de rango por ventana contra 22,3 — las 22,3 teselas seleccionadas coalescen en 5,6
> tiras de row groups consecutivos y sólo una frontera de fichero lo impide. Footer de 496.373 bytes
> contra 1.150.490. Y los mismos bytes: 75,81 MB contra 76,46, donde la diferencia son 1.220 footers
> que dejan de existir. La estimación de 566 kB era un 14 % alta.

**Las dos mitades coinciden en 4.096 habiéndolo medido por separado y desde extremos opuestos**, que
es la clase de acuerdo que no se fabrica. Y mata la pregunta «¿un fichero por tesela?» antes de que
llegue al emisor.

Queda abierto de verdad, y esto sí es diseño: el ítem 5 pregunta si el *payload* es Parquet o Arrow
IPC — §1 pide nada de DuckDB en el camino de dibujo y §3 pide `x`/`y` subiendo crudas a la GPU, y
Parquet no da ninguna de las dos sin decodificador. ADR-0056 decide el **layout**, no el formato.

**Y una refutación sin recoger:** una arista entre tipos **nunca es dibujable desde una ventana** —
0 de 240.000, todos los tamaños, contra el 91 % de las aristas internas. Más `place_after`
desperdiciando 6,6–17 % de la caja y creciendo con N. Eso todavía no es una decisión en ninguna
parte.

---

## 3 · El hueco que no está en ningún plan

**El paquete del grafo no es plug and play, y nadie lo había escrito.** La comparación con la capa
de charts es exacta:

```
charts   <ChartRoot><ChartBarY/></ChartRoot>      el consumidor no construye nada
graph    new Graph(...) + 5 hooks + ~700 líneas   el consumidor construye la instancia
```

`@kanzo-tech/graph` importa cosmos.gl **sólo como tipo**: recibe el `Graph`, no lo crea. Por eso los
dos showcases hacen `import { Graph } from "@cosmos.gl/graph"` — es la forma del paquete, no un
descuido suyo. Falta un `<GraphCanvas>` dueño de la instancia, con los hooks quedándose como
escotilla: la relación que `ChartRoot` tiene con `useChart`.

No depende de la tesela ni del formato. Se puede hacer en paralelo con todo lo anterior.

---

## 4 · Pendiente en kanzo-ui, de la línea de color

De `COLOUR-HANDOFF.md` §5, vivo:

- **La sección Graph en Preferences** — Look + Display; Layout y Camera se quedan en el dock, porque
  la gravedad de una simulación no es apariencia y `a-section-brings-measurable-obligations` traza
  ahí la línea.
- **El `AppearanceToggle` suelto fuera de los showcases**: `PreferencesPanel` ya lo lleva en su
  cabecera, así que el que está al lado de «Customize» es el segundo.
- **La primitiva de fila pulsable y densa** que cumpla 2.5.8 por construcción. `Item` es una tarjeta
  (~2,5× la altura), `SidebarMenuButton` está acotada, `Listbox`/`Command` traen roles ARIA que una
  lista estática no quiere. El hallazgo no fue descuido: la primitiva no existe.
- **`target-size` de `Button size="xs"`**: 21 px en compact. Ningún call site medido falla por él.
  Arreglarlo o documentarlo, pero decidirlo.

---

## 5 · El orden

Lo que bloquea a más cosas, primero; lo independiente, en paralelo.

1. **Borrar las seis ramas y subir el tronco de rmlext a `main`** (§0). Es media hora y es lo que
   hace que las otras preguntas tengan un solo sitio donde contestarse.
2. **Reescribir ADR-0042 §3** (§2), con ADR-0056 ya en la mano. Es papel, es barato, y desbloquea el
   emisor de teselas.
3. **Decidir el formato del payload** (§2). Depende de 2.
4. **`<GraphCanvas>`** (§3) — en paralelo desde ya, no depende de nada.
5. **Verificar las pruebas de F1, F3, F4 y F5** (§1) y reescribir el plan de fases, o retirarlo: ya
   no describe el trabajo, y un plan que va por detrás del árbol se lee como si faltara lo que
   sobra.
6. **La línea de color** (§4), que es trabajo acotado con su propio ciclo.

Fuera del orden, porque no bloquea a nadie y hay que decirlo en voz alta: la deuda que el plan de
fases lista al final —`cargo fmt` rojo, destinos cloud rechazados, `timeout_ms` sin aplicar, los
quads fuera del esquema, y un lector tercero que no puede derivar la URL de una tesela de aristas
del manifiesto— sigue ahí y ninguna de estas fases la toca.
