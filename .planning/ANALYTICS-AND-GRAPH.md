# Analytics y graph — el repaso, 2026-08-14

Dos capas y una pregunta común: **acercarlas a la semántica de Ark**. Y una segunda, sólo del grafo:
**qué le debe nuestro lector al corpus** ahora que rmlext lo ha hecho un producto con documentación
propia.

Este documento no decide nada todavía. Ordena, y separa lo medido de lo que hay que ir a medir.

---

## 0 · Lo que ya no es una corazonada

`rmlext/apps/corpus/content/docs/reading/without-fossil.mdx` **nos cita por nombre**:

> «*This is not an aspiration about the format — it is how it is already read. `kanzo-ui` reads
> fossil-written corpora with no `@fossil-lang/*` dependency at all, reimplementing the read shape
> against DuckDB and Mosaic.*»

Eso cambia el encuadre. `@kanzo-tech/graph` no es un consumidor entre otros: **es la prueba de
existencia de una afirmación que el otro repo publica.** Si nuestro lector se desvía de una
convención, la que queda falsa es esa página.

El corpus documenta cinco convenciones —`identity`, `addressing`, `adjacency`, `order`, `payload`—
más `guards`, `reading/{verbs,mcp,without-fossil}` y `scale/{larger-than-ram,streaming}`.

**Sin verificar, y es el primer trabajo:** nadie ha comparado nuestro camino de lectura contra esas
cinco páginas desde que existen. Sabemos que coincidimos en identidad (`vertexId(type, dense)` como
`bigint`) porque lo derivamos a la vez y por separado, y que coincidimos en la unidad de tesela
(4.096 filas) por la misma vía. **De las otras tres no sabemos nada**, y afirmarlo sería justo el
error que este repo lleva todo el día corrigiendo.

---

## 1 · Ark: las dos capas tienen la misma pieza rota

Ark v5 son cuatro cosas y nosotros tenemos dos:

| | Ark | analytics | graph |
|---|---|---|---|
| fábrica de la api | `useAccordion(props) → api` | — | — |
| proveedor externo | `<AccordionRootProvider value={api}>` | — | — |
| atajo que la crea | `<AccordionRoot {…}>` | `ChartRoot` | `GraphCanvas` |
| lectura desde partes | `useAccordionContext()` | `useChart()` | `useGraphCanvas()` |

**Y hay un nombre ocupado.** En Ark `useX()` **crea** y `useXContext()` **lee**. Nuestro `useChart()`
es el lector con el nombre de la fábrica, así que quien llegue de Ark leerá lo contrario de lo que
hace. `useGraphCanvas()` al menos no miente, pero tampoco sigue la convención.

**La pieza que falta no es cosmética: es la que bloquea un host real.** Medido al intentar migrar el
workspace a `GraphCanvas` — `useGraphOverlays` y el bloque `events` viven *por encima* del elemento,
donde el contexto todavía no se lee, y las salidas de overlays se consumen en **30 sitios que cruzan
la frontera**. La respuesta de Ark a exactamente eso es `useX()` + `RootProvider`.

Lo que le puse hoy —`graphRef` y `residentRef` como props «dados en vez de devueltos»— es un apaño a
medida para un problema que la referencia resuelve en general, y `CONVENTIONS.md` dice que la
referencia gana. **Esos dos props se borran cuando entre la fábrica.**

### Hasta dónde se puede copiar, y dónde no

La api de Ark es la de una máquina de zag, y su valor son los *prop getters* que reparten props
entre muchas partes. Aquí no hay partes: un canvas es **un** elemento DOM, y las marcas de un chart
no son elementos sino descriptores que Plot consume. Así que se copia **la estructura** —fábrica,
proveedor, raíz, contexto—, que es lo que resuelve la circularidad, y **no la sustancia**. Inventar
`getRootProps()` para tener el mismo aspecto sería cargo cult, y esa decisión se toma en la sección
de `CONVENTIONS.md` que dice qué gana a la referencia, no aquí.

---

## 2 · El orden, y por qué

1. **El grafo primero.** Es donde la falta está *demostrada* con un host que no se pudo adoptar, no
   deducida. Los charts tienen la incoherencia de nombres y ningún host bloqueado; empezar por ellos
   sería rediseñar la capa que no duele.
2. **Los charts después, con lo aprendido**, y con una pregunta que hay que contestar antes de
   escribir nada: **qué devuelve de verdad `useChart(props)`**, porque la mitad del estado de un
   chart vive en el coordinador de Mosaic y no en un objeto nuestro. Si la respuesta es «un objeto
   que sólo reenvía al coordinador», la fábrica no compra nada y sólo queda el renombrado.
3. **El renombrado `useChart()` → `useChartContext()`** puede ir suelto y antes que todo, porque no
   depende de que la fábrica exista y libera el nombre. Rompedor, con página propia
   (`hooks/use-chart.mdx`), y nada está publicado.

---

## 3 · El trabajo, en orden de lo que desbloquea

> **Estado, 2026-08-14 tarde.** A, B y C hechos. Queda D (analytics) y E.
> A está en `.planning/READER-VS-CORPUS.md`; B y C están en el árbol y verificados en vivo.

### A · Auditar el lector contra las cinco convenciones — **grafo**, ~~sin verificar~~ **hecho**

Leer `conventions/{identity,addressing,adjacency,order,payload}.mdx` y comparar contra
`bounded.ts`, `duck-source.ts`, `resident.ts` y `memory-source.ts`. La salida es una tabla de
coincide / difiere / no aplica, y cada «difiere» es una decisión: o nos movemos o la página se
corrige. Barato y desbloquea lo demás, porque el resto asume que el lector es correcto.

### B · `useGraph` + `GraphRootProvider` — **grafo**, **hecho**

La forma de Ark, sin los getters. Borra `graphRef`/`residentRef` de `GraphCanvasProps`. Reabre
`decisions/a-canvas-component-owns-the-three-that-never-differ.md` — el `Reversed by` de hoy dice
«un prop que codifique la política de un host», y lo que ha pasado es distinto y más útil: **el host
no puede leer el contexto donde lo necesita**, que es un defecto de forma y no de alcance.

### C · Migrar el workspace — **grafo**, **hecho**

Lo que la migración enseñó y el plan no preveía: el host **sigue necesitando una indirección**, pero
una en vez de cuatro. `useGraphOverlays` necesita `getGraph`/`getResident`, y los eventos del grafo
le deben un repintado; `applyPins`, `unfocus` y `commit` tocan el renderer y son argumentos de
`useGraph` por la vía de `events`. La dependencia es mutua de verdad, así que algo tiene que ser el
punto fijo. Son dos refs (`apiRef`, `overlaysRef`) contra los cuatro trozos a mano de antes, y la
ordenación entre construcción del renderer, primer slice y mapa de identidad deja de ser del host.

También destapó un fallo latente: `refresh` volvía del bucle y el único que lo usaba era `onZoom`,
que ahora hace `useGraph` — así que el binding quedó sin usar. Lo que costaba era `reveal`: fijar un
nodo lejos de la cámara es cómo se le hace llegar, y sin nada que re-preguntase solo llegaba en el
siguiente pan. `applyPins` lo llama ahora, que es lo que `useBoundedGraph` documenta.

Es lo que da el segundo call site que la regla 2 pide, y lo que convierte `GraphCanvas` de «forma
probada contra un host» en algo admitido. Con B deja de ser un reestructurado del showcase.

### D · `useChartContext` y la pregunta de la fábrica — **analytics**, **hecho**

§2.3 hecho: `useChart` → `useChartContext` y `useChartOptional` → `useChartContextOptional`, con las
dos páginas, los dos directorios de ejemplo, `meta.json` y los enlaces.

§2.2 **contestado, y la respuesta es que no hay fábrica** —
`decisions/a-chart-needs-no-factory.md`. Lo que forzó la del grafo fue específico y medido: dos
hooks que se llaman *por encima* del elemento y necesitan `getGraph`/`getResident`. En analytics no
existe esa forma: `useChartQuery`, `useCrossfilter`, `useSelected` y `useChartCapacity` leen todos
`useMosaic()`, que es el **proveedor**, no la raíz. No hay circularidad que romper, y lo que
`useChart(props)` devolvería es `ChartContextValue`, que ya existe y ya se publica.

Y el proveedor externo tampoco falta: el prop `as` **es** esa vía, en la forma que esta capa ya
tenía, probado por los dos lados.

### E · Lo que ya estaba abierto y no cambia

Reescribir §3 del diseño de direccionamiento (hoy es trabajo de rmlext, su contenido vive en
`addressing.mdx`), el formato del *payload* de la tesela, y la refutación sin recoger de que **una
arista entre tipos nunca es dibujable desde una ventana**. Ver `.planning/ROADMAP.md` §2.

---

## 4 · Lo que este plan no toca

- **La capa de color**, cerrada hoy.
- **Los hooks del grafo como superficie.** Ninguna de estas fases los retira: `useCosmosGraph`,
  `useBoundedGraph`, `useGraphLook`, `useGraphOverlays` y `useGraphSelection` siguen siendo la
  escotilla, que es la relación que `ChartRoot` tiene con `useChart` y la razón de que la fábrica
  quepa sin romper a nadie.
- **`@kanzo-tech/ui`.** La regla 1 de admisión excluye grafos por nombre; nada de A–C entra ahí.
