# Capas finas — Charts, DataTable, Forms

Contrato de diseño acordado 2026-07-25. Es el documento que los workstreams paralelos comparten:
si algo no está aquí, se decide en el hilo, no en el archivo.

---

## El principio

Shark no publica código de formularios. Publica `Field` (presentación) y **guías de integración**
por librería (`formisch`, `tanstack-form`, `react-hook-form`), cada una con demo, anatomía, modos
de validación, errores, reset, field arrays y wiring por cada tipo de control.

Trasladado a nuestro caso, el patrón tiene dos mitades y hay que aplicarlas donde toca:

| Motor | Qué falta | Respuesta |
|---|---|---|
| Mosaic / vgplot | una API fina y componible; hoy hay 5 componentes con `vg.plot(...)` hardcodeado | **código**: capa fina |
| TanStack Table | composición; hoy es un monolito de props | **código**: capa fina |
| TanStack Form + zod | nada — `Field` ya es suficiente | **docs**: guía + galería |

La diferencia no es capricho: en charts y tabla el motor es *imperativo o headless* y sin capa fina
no se puede componer. En forms el motor ya compone bien con `Field`; lo único que falta es enseñarlo.

---

## 1. Charts — capa fina sobre Mosaic

### El problema

`bar-chart.tsx`, `bar-series-chart.tsx`, `line-chart.tsx`, `histogram.tsx`, `scatter-plot.tsx` son
cinco implementaciones paralelas del mismo `vg.plot(...)`, cada una con props solapadas
(`table`/`column`/`selection`/`height`/`limit`). Una línea y unas barras en el mismo plot no se
pueden expresar. Cambiar `toggleX` por `intervalX` obliga a forkar el componente. vgplot es una
gramática (≈40 marcas, 19 interactores, ~250 atributos) y la estamos exponiendo como cinco fotos.

### La forma

Dos tipos de hijos, y se documentan como tales:

| | Qué son | Idioma |
|---|---|---|
| marcas, interactores, ejes | descriptores **inertes**, sin DOM; `ChartRoot` los compila a `vg.plot(...)` | Recharts / Observable Plot |
| `ChartRoot`, `ChartLegend`, y los inputs (`ChartMenu`/`ChartSearch`/`ChartSlider`) | DOM real, `ark.*`, `data-slot`, `asChild` | Ark / nuestro |

Las marcas **no pueden** ser partes de Ark: vgplot pinta un SVG imperativamente
(`host.replaceChildren(vg.plot(...))`), así que no hay DOM que una parte pueda poseer. Lo que sí es
genuinamente Ark es `ChartRoot` + `useChart()` (escalón 4 de la escalera de `DESIGN.md`): contexto
con config, selección y coordinator, para montar una leyenda o un tooltip propios sin forkar.

### Anatomía

```tsx
<ChartRoot table="telemetry" config={config} height={220}>
  <ChartBarY x="host" y={count()} fill="host" tip />
  <ChartRuleY at={0} />
  <ChartAxisX tickRotate={45} />
  <ChartAxisY grid />
  <ChartToggleX />
  <ChartLegend />        {/* DOM real: lee el config del contexto */}
</ChartRoot>
```

> **Corregido tras la implementación.** El borrador de esta anatomía llevaba un `<ChartTip />`:
> no existe tal directiva en vgplot, el tooltip es una **opción de marca** (`tip: true`), así que es
> una prop común (`<ChartBarY tip />`). `ChartTitle` y `ChartEmpty` se caen de la tabla de partes
> DOM: el primero duplica el `title` de `ChartCard` y el segundo necesitaría contar filas, que es
> una query al coordinator y no DOM. `ChartHighlight` lee una selección con `by` en vez de publicar
> con `as`, y `ChartPanZoom` no lleva selección; `ChartAxisY.anchor` es `"left" | "right" | null`.

### API

**`ChartRoot`**

| prop | tipo | nota |
|---|---|---|
| `table` | `string` | la relación registrada en el coordinator |
| `filterBy` | `Selection \| null` | por defecto el crossfilter del `MosaicProvider`; `null` = sin filtrar |
| `as` | `Selection` | destino de los interactores hijos. **Por defecto, una selección propia de ESTE root**, relayada al provider — no la compartida. Ver abajo: es lo que evita el binder error del highlight |
| `config` | `ChartConfig` | serie → `{ label, color, icon }` |
| `height` | `number` | 200 por defecto; el ancho se mide del contenedor |
| `margin` | `number \| {top,right,bottom,left}` | |
| `aspectRatio` | `number` | |
| `attributes` | `unknown[]` | escotilla: cualquier `vg.*` que no envolvamos |
| `className` | `string` | |

**`ChartConfig`** — `Record<string, { label?: ReactNode; color?: string; icon?: ComponentType }>`.
`color` acepta `var(--chart-1)`, `--primary`, hex o `rgb()`. Todo lo que sea token se resuelve con
`resolveTokenColor` a `rgb(...)` en el mount y en cada cambio de tema (Plot rechaza `oklch`,
`color-mix` y `color(srgb …)` — ver `theme.ts`). Un config no vacío genera `vg.colorDomain(keys)` +
`vg.colorRange(colors)`, y alimenta a la vez marcas, `ChartLegend` y tooltip.

Los tokens `--chart-1..5` ya existen en `packages/theme/tokens.css` (vendorizados de Shark). La
paleta validada de 8 hues (`CHART_CATEGORICAL`) sigue siendo el default cuando el config no fija
colores.

**Marcas** (props = opciones de la marca de vgplot + azúcar común `filterBy`, `table`, `data`, `tip`):

Se envolvieron **59** de las ~65 que trae vgplot — las seis que faltan (`axisX/Y/Fx/Fy`,
`gridFx/Fy`) son decoradoras de eje y llegan por `ChartRaw`. La lista viva está en
`packages/ui/src/analytics.ts`; repetirla aquí solo sirve para que envejezca.

`table` por marca se añadió después: un node-link dibuja nodos de una relación y aristas de otra,
filtradas por la misma selección, y sin eso las aristas tenían que colarse por la escotilla.

**Interactores:** `ChartIntervalX` `ChartIntervalY` `ChartIntervalXY` `ChartToggleX` `ChartToggleY`
`ChartToggleColor` `ChartHighlight` `ChartNearestX` `ChartNearestY` `ChartPanZoom` `ChartRegion`

**Ejes:** `ChartAxisX` / `ChartAxisY` con el subconjunto usado de verdad — `label`, `ticks`,
`tickFormat`, `tickRotate`, `tickSize`, `grid`, `line`, `domain`, `scale`, `nice`, `reverse`,
`zero`, `percent`, `inset`, `padding`, `anchor` (`"top" | "bottom" | null`). Todo lo demás, por
`attributes`.

**Leyendas:** `ChartLegend` (DOM nuestro, del config) y `ChartColorLegend` (la de vgplot,
interactiva, publica en la selección).

**Agregados** re-exportados desde `analytics.ts` para no importar `@uwdata/*` en el consumidor:
`count` `sum` `avg` `min` `max` `median` `quantile` `stddev` `mode` `bin` `sql` `Fixed`.

### Mecanismo

`ChartRoot` parte los hijos en dos: los que llevan un estático `__chart` (descriptores) y el resto
(DOM). Los descriptores se compilan dentro del `render` de `TokenizedPlot`, que ya aporta colores
resueltos y ancho medido. La compilación es **una función pura** y se testea sin coordinator vivo;
el render en jsdom es un smoke aparte.

`__chart` devuelve **datos planos**, no directivas de vgplot: `{ kind: "mark", mark: "barY",
source, options }`. `chart-root.tsx` los mapea a `vg.*` en un único `switch`, y así `chart-spec.ts`,
`chart-marks.tsx`, `chart-interactors.tsx` y `chart-axes.tsx` no importan `@uwdata/vgplot` ni para
tipos. Es lo que hace la gramática testeable de verdad.

Dos escotillas, porque envolver 25 marcas de las ~40 debe ser comodidad y no cárcel (la lección de
Chakra, que no envuelve ninguna): `attributes` en el root, aplicado al final, y `<ChartRaw spec={…}>`
para colar una directiva cruda en su posición de origen.

**Los ejes compilan a atributos, no a marcas.** `vg.axisX` es una marca decoradora y un interactor
se engancha a *la última marca añadida*, así que un eje-marca le robaría el binding al interactor
siguiente. `ChartFrame` / `ChartGridX` / `ChartGridY` sí son marcas y sí lo desplazan: está
documentado en el código.

Fragmentos y arrays se aplanan; `null`/`false` se ignoran (condicionales funcionan). Un descriptor
envuelto en un componente propio **no** se ve — misma limitación que Recharts, y se documenta.

### Los tres de dashboard — decidido y **ejecutado** 2026-07-25

La librería se contradecía a sí misma: `MetricCard` fue **retirado** a propósito ("una tarjeta de
métrica es una composición, no un componente"; su página de docs enseña el copia-pega), mientras
`StatTile` hacía el mismo trabajo *y era componente* — y encima vivía en `/charts` sin usar Mosaic
para nada.

Se resuelve al revés de como se resolvió `MetricCard`, porque `StatTile` sí tiene lógica que aquél
no tenía: formateo compacto del contrato dataviz, semántica de delta (`goodWhenUp` decide si subir
es verde o rojo) y una sparkline calculada.

| pieza | destino | por qué |
|---|---|---|
| `StatTile` | **barrel raíz** | presentacional, recibe un número, no toca Mosaic — estaba mal colocado. La página de `MetricCard` deja de enseñar un copia-pega y apunta aquí |
| `ChartStat` (nuevo) | **`/analytics`** | lo que el dueño quería de verdad: recibe tabla + agregado, se suscribe al crossfilter, consulta y pinta un `StatTile`. Un KPI que **reacciona al brush** — eso sí es comportamiento, y sí pertenece al subpath |
| `ChartCard`, `DashboardGrid` | **showcases** | 37 y 31 líneas de tarjeta y rejilla, cero comportamiento. Escalón 5 de la escalera de `DESIGN.md` no se alcanza |

Con eso el subpath queda con una frontera defendible: **la gramática de Mosaic y lo que se conecta a
ella, nada más.**

Ejecutado tal cual, más una pieza que no estaba prevista: **`useChartQuery`**, el hook sobre el que
`ChartStat` está construido. Salió de que dos showcases distintos reportaran la misma carencia — un
dashboard siempre tiene algo que no es un plot (un KPI, una lectura, una tabla) y hacerlo con un
`coordinator.query()` suelto en un efecto da totales **sin filtrar** al lado de gráficos filtrados,
que se lee como un crossfilter roto.

Y el subpath pasó a llamarse **`/analytics`**: se nombra la capacidad, no el motor, igual que
`/editor` no es `/codemirror`. Dejó de ser solo gráficos hace rato — tiene los controles que los
filtran y las cifras que leen la misma relación. Los componentes siguen siendo `Chart*`.

### Qué desaparece

`BarChart`, `BarSeriesChart`, `LineChart`, `Histogram`, `ScatterPlot` se **borran** del barrel. Los
cinco reaparecen como ejemplos copiables en los docs, escritos con la capa fina (que es la prueba de
que la capa es suficientemente expresiva). `MosaicProvider`, `TokenizedPlot`, `theme.ts`,
`StatTile`, `ChartCard`, `DashboardGrid` se quedan.

Consumidores a migrar: `docs/content/docs/data-display/charts.mdx`, los showcases que los usen y el
panel de Analysis de discovery.

---

## 2. DataTable — capa fina sobre TanStack Table

Mismo principio: hoy `DataTable.tsx` es un componente de props que decide por el consumidor. Se
desmonta en un hook headless + partes componibles, y el componente actual pasa a ser un preset.

```tsx
const table = useDataTable({ data, columns, pageSize: 20 })

<DataTableRoot table={table}>
  <DataTableToolbar>
    <DataTableSearch column="name" />
    <DataTableFacetFilter column="status" options={statuses} />
    <DataTableViewOptions />
  </DataTableToolbar>
  <DataTableContent onRowClick={...} />
  <DataTablePagination />
</DataTableRoot>
```

| pieza | qué hace |
|---|---|
| `useDataTable` | `useReactTable` con los row models ya cableados, `pageSize`, orden/filtros/visibilidad/selección iniciales, y modo `manual*` para servidor |
| `DataTableRoot` | contexto + contenedor; `useDataTableContext()` para partes propias |
| `DataTableToolbar` | fila de controles; `DataTableSearch`, `DataTableFacetFilter`, `DataTableViewOptions` y lo que meta el consumidor |
| `DataTableSearch` | `column` → filtro de columna; sin `column` → filtro global |
| `DataTableFacetFilter` | multi-selección sobre valores facetados, con recuentos |
| `DataTableViewOptions` | visibilidad de columnas |
| `DataTableContent` | `<Table>` + header/body/footer, `onRowClick`, `empty`, estado `selected` |
| `DataTablePagination` | Ark `Pagination` + selector de tamaño de página + recuento de selección |
| `selectColumn()` | helper para la columna de checkbox |
| `sortableHeader` | se queda como está |
| `DataTable` | preset con la API de hoy, reescrito con las partes |

El bug memorizado en `DataTable.tsx` (identidad de `columnFilters` → bucle infinito que congela la
pestaña) es propiedad del motor, no del componente: se conserva la memoización y el comentario.

---

## 3. Forms — guía, no código

Réplica del patrón Shark, sin añadir dependencia a la librería.

`docs/content/docs/forms/tanstack-form.mdx`, con la misma estructura que Shark:
demo · approach · anatomía · schema zod · setup · build · validación (cliente y modos) · errores ·
**wiring por tipo de control** · reset · field arrays (estructura, anidados, añadir, quitar,
validación de arrays).

Los controles a cubrir son los nuestros, y ahí está el valor real: los de Ark usan
`onValueChange`/`details`, no `onChange`, así que el wiring no es obvio — `Input`, `Textarea`,
`NativeSelect`, `Select`, `Checkbox`, `RadioGroup`, `CardRadioGroup`, `Switch`, `NumberInput`,
`Slider`, `Combobox`, `DatePicker`, `DateField`, `PinInput`, `Rating`, `TagsInput`, `FileUpload`,
`ColorPicker`, y un formulario complejo.

`@tanstack/react-form` y `zod` entran como dependencias **de `docs/`**, nunca de `packages/ui`.

`FORMS-DECISION.md` se mantiene: la librería muestra errores, el producto los produce. Esta guía es
el punto 1 de su "qué hacer en su lugar" (adoptar), por fin escrito.

---

## Reparto y orden — histórico

> Ejecutado el 2026-07-25. Se conserva porque explica por qué el trabajo se dividió así, no porque
> quede nada por hacer.

Fase 1 (paralelo, ficheros disjuntos):
- **A** — `packages/ui/src/charts/*` salvo el barrel.
- **B** — `packages/ui/src/table/*` salvo el barrel.
- **C** — `docs/content/docs/forms/tanstack-form.mdx` + `docs/examples/form/tanstack/*`.

Fase 2 (tras A y B): docs y galería de charts y de data-table, borrado de los cinco presets,
barrels (`charts.ts`, `table.ts`, `index.tsx`, `index.test.ts`), changesets, build y verificación en
navegador (`next dev --webpack`, un coordinator por ruta — ver memoria).

Los barrels, `package.json` y los borrados los toca **solo el orquestador**, para que el árbol
compile durante la fase paralela.

---

## Lo que la ejecución enseñó, y que no estaba en el contrato

Cinco cosas que solo aparecieron al escribir código y documentación reales. Se registran porque
todas son del tipo que vuelve a morder si nadie las escribe.

1. **Un fallo que se pinta bien es peor que uno que revienta.** Tres de los defectos más caros del
   día eran silenciosos: el apilado que apilaba cada fila sobre la anterior, el token fuera de gama
   que Plot leía como nombre de columna, y el highlight sobre una marca agregada que mata la
   consulta y deja el plot **congelado en su render anterior**. Ninguno se cae; los tres mienten. De
   ahí que `ChartRoot` avise en desarrollo y que la regla sea verificar en navegador, no en el
   editor: un test unitario no puede ver un `Binder Error` de DuckDB.

2. **Escribir la documentación honesta es lo que encuentra los defectos.** La guía de TanStack Form
   destapó cinco fallos en nuestros controles; montar dos pantallas realistas destapó ocho
   carencias más. Ninguno salió de leer el código.

3. **"Seguimos a Shark" responde a quién decide el aspecto, no a si el código es correcto.** Cuatro
   de esos cinco defectos eran suyos, vendorizados verbatim — nuestros ficheros eran idénticos a los
   suyos salvo rutas de import. Seguir la referencia en *gusto*; verificar contra la anatomía de Ark
   y la validez del HTML en *corrección*.

4. **Envolver un motor es comodidad, nunca cárcel.** Chakra no envuelve ni una marca de Recharts.
   Nosotros envolvemos 59 porque la ergonomía lo merece, pero `ChartRaw` y `attributes` existen para
   que nadie se quede fuera — y las carencias que aparecieron (una marca con su propia relación, la
   leyenda por canal) se arreglaron ampliando la gramática, no añadiendo componentes.

5. **Un presupuesto de tamaño mide lo que mide.** El del barrel raíz mide la librería entera y no lo
   que descarga nadie; confundirlos casi lleva a mover código a un subpath para arreglar un número
   sin cambiar un byte para ningún consumidor. El termómetro que importa es el de un import con
   tree-shaking: `{ Button }` son 1,08 kB.
