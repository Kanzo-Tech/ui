# La vista alejada y la capa de aristas — medido, 2026-08-17

Cierra las dos secciones que `ONE-PATH.md` deja abiertas: *«La vista alejada no tiene diseño»* (paso
5) y *«La capa de aristas, con dos agujeros»* (paso 6). Las dos se cierran **con medición**; ninguna
queda como recomendación sin respaldo, y lo que no se puede probar está en la última sección.

Nada de aquí es código. La entrega es este fichero.

> **EVIDENCIA. Revisado 2026-08-26.** No dirige nada: las dos secciones que cerraba están
> implementadas y su regla vive en `/docs/design/graph`. Se queda porque es *el trabajo* detrás de
> tres afirmaciones que el código cita por ruta —`packages/graph/src/bounded.ts` tres veces y
> `duck-source.test.ts` una— y ninguna de las tres se puede rederivar leyendo el código: el corte de
> 3 px (27,5–35,3% de las filas, 99,9–100% de los píxeles entintados), la mediana de arista por
> tamaño de corpus, y por qué el extremo lejano es el vértice y no un punto en el borde.

---

## De qué corpus salen los números, y qué pasa si se re-tesela

**Aviso de coordinación tomado en serio.** Otro agente está reescribiendo el escritor en `rmlext`.
Por eso cada número está anclado a su corpus, y hay una tabla explícita de **qué sobrevive a un
re-teselado y qué no**.

| corpus | escrito | qué es |
|---|---|---|
| `docs/public/bench/200000` | 2026-08-14 17:43 | 200.000 vértices, 1.373.249 aristas, 8 `community`, 1.439 `cluster_id` |
| `docs/public/bench/1000000` | 2026-08-14 17:44 | 1.000.000, 6.897.357, 8, 3.253 — 245 chunks |
| `docs/public/bench/5000000` | **reconstruido 2026-08-17** | 5.000.000, **34.974.279**, 8, **15.310** — 1.221 chunks |

El de cinco millones no estaba en disco (`BENCHMARKS.md` lo describe pero el directorio se había
borrado). Se reconstruyó con **el mismo binario** que escribió los otros dos —
`rmlext/target/release/fossil`, mtime 2026-08-14 11:18, anterior a la reescritura en curso — y
**reproduce exactamente** el corpus que `BENCHMARKS.md` registra: 34.974.279 aristas, 15.310
`cluster_id`, 8 `community`. Los tres son comparables entre sí.

Un dato que conviene saber antes de planificar sobre él: **estos corpus ya están a 4.096 filas por
tesela** (`chunk_size: 4096` en los dos manifiestos) y **`by_source` ya está teselado** — 245
ficheros a un millón, 1.221 a cinco. Lo que falta del lado del corpus es sólo `by_target`, que sigue
siendo un fichero plano. El punto 3 de «qué arreglar» de `BENCHMARKS.md` está hecho en el corpus, no
en el escritor que lo va a reemplazar.

Toda medición de aquí es **duckdb v1.5.3 nativo, 14 hilos, ficheros locales, M4 Pro**. No hay
navegador, no hay WASM, no hay HTTP: es deliberado, porque las dos preguntas son sobre *qué se ve* y
*cuánto trabajo hay*, no sobre latencia de red — y porque una consulta que tarda 300 s nativa no
necesita un navegador para saber que no sirve.

### Qué sobrevive a un re-teselado y qué no

| resultado | ¿sobrevive? | por qué |
|---|---|---|
| fracción de aristas perdidas por ventana (§2a) | **sí** | propiedad de la maquetación y de la topología; no toca un byte de frontera de fichero |
| distribución del alcance del extremo lejano (§2a) | **sí** | ídem |
| campo de densidad y sus estadísticos (§1) | **sí** | son las coordenadas, no los ficheros |
| las puntuaciones L1 de cada resumen (§1) | **sí** | ídem |
| la curva de niebla y el umbral en aristas/Mpx (§2b) | **sí** | píxeles y segmentos; el fichero no entra |
| la fracción de aristas sub-píxel (§2b) | **sí** | longitudes |
| que `lineDensity` multiplique filas ×39 (§2b) | **sí** | aritmética del rasterizado |
| los **segundos** de la consulta de agregado (§1) y del ráster (§2b) | **parcialmente** | el orden de magnitud sí; la cifra exacta cambia con el troceado de aristas |
| conteos de peticiones y bytes por ventana | **no medidos aquí, a propósito** | son justo lo que el re-teselado invalida; `BENCHMARKS.md` ya los tiene y ya quedarán obsoletos |

**Lo que sí invalidaría todo esto es un re-*maquetado*, no un re-teselado.** Si la reescritura mueve
posiciones —otro particionado para el layout, otro `place_after`, otro Morton— cada número de este
fichero muere. Si sólo mueve fronteras de fichero, todos siguen en pie. Merece la pena preguntárselo
al otro lado antes de implementar.

---

## 1. La vista alejada

### La métrica, antes que nada — porque sin ella esto es estética

Alejado del todo, un lector no puede percibir vértices: a cinco millones el corpus entero cae en
960.000 píxeles y **el 84,6% de la masa está en píxeles que contienen ocho o más vértices**. Lo único
que queda perceptible es *dónde está la masa*. Así que:

> **Una vista alejada «significa algo» cuando reproduce el campo de masa a la resolución en que se
> mira.** Se mide con el **L1 normalizado del campo de masa contra la verdad a resolución de
> pantalla, comparado en bloques de 8 px** — 0 idéntico, 2 disjunto.

Tres decisiones dentro de esa frase, todas por medición y no por gusto:

- **Por qué la masa y no la estructura.** El campo de masa es lo que el ojo integra en una imagen
  densa. Es lo que se puede medir; lo que *no* mide está en la última sección.
- **Por qué en bloques de 8 px y no por píxel.** A un píxel exacto la métrica mide *alineación*, no
  parecido: el mipmap a resolución de pantalla —visualmente idéntico a la verdad— puntúa 1,199 por
  píxel y 0,159 en bloques de 8, porque sus celdas no caen en la rejilla del píxel. Se reportan las
  seis escalas (1, 2, 4, 8, 16, 32 px) para que se vea el artefacto en vez de esconderlo.
- **Por qué hacen falta dos anclas.** Un L1 suelto no dice nada. El **nulo** es un campo uniforme
  sobre la caja del corpus —lo que sabe alguien que sólo tiene el extent— y el **techo** es el mipmap
  a resolución de pantalla. La regla de admisión, y es un guard escribible:

> **Un resumen es admisible si su L1@8px ≤ la mitad del nulo.** A cinco millones eso es ≤ 0,366.

### La verdad, a 1200×800 sobre el extent completo

| N | píxeles con tinta | ocupación | máx/píxel | p50 | masa en píxeles con ≥8 |
|---|---|---|---|---|---|
| 200k | 23.480 | 2,45% | 105 | 4 | 74,1% |
| 1M | 83.164 | 8,66% | 771 | 5 | **81,4%** |
| 5M | 340.217 | **35,44%** | 31.245 | 6 | **84,6%** |

Y la maquetación **llena su caja**: de nivel 4 a nivel 8 del cuadtree, entre el 78% y el 86% de las
celdas tienen algo. No hay huecos que dibujar; hay un campo.

### Lo que puntúa cada candidato

L1@8px, menor es mejor. `marks` es el número de marcas que cuesta (el tope del lector es 20.000).

| candidato | marcas 200k / 1M / 5M | L1@8px 200k / 1M / 5M |
|---|---|---|
| **`community` como punto — lo que hay hoy** | 8 / 8 / 8 | **0,998 · 1,000 · 0,999** |
| `cluster_id` como punto | 1.439 / 3.253 / 15.310 | 0,932 · 0,989 · 0,985 |
| *nulo uniforme* | — | *1,044 · 0,829 · 0,731* |
| `cluster_id` como caja de sus miembros | 1.439 / 3.253 / 15.310 | 1,018 · 0,737 · 0,591 |
| nivel 6 del cuadtree (área) | ~3.400 | 0,800 · 0,571 · 0,441 |
| muestra aleatoria de 20.000 | 20.000 | 0,349 · 0,382 · 0,387 |
| **muestra por zancada Morton de 20.000** | 20.000 | **0,167 · 0,240 · 0,269** |
| nivel 8 del cuadtree (área) | 16.407 / 54.498 / 51.070 | 0,413 · 0,334 · 0,214 |
| *nivel 10 — el techo* | *24.337 / 84.170 / 342.816* | *0,161 · 0,159 · 0,139* |

Tres lecturas, y la primera es la que decide el paso:

**Lo que hay hoy puntúa peor que no dibujar nada.** `community` como ocho super-nodos da 0,998–1,000
contra un nulo de 0,731–1,044. Literalmente: una caja gris uniforme transmite más sobre dónde está el
corpus que la vista alejada actual. `cluster_id` tampoco lo salva —0,985 a cinco millones— y ninguna
de las dos mejora al dibujarse como área en vez de como punto. **Ninguna columna de jerarquía de este
corpus pasa la barra de admisión, por ningún margen.**

**Lo que la pasa, y sin escribir una línea en el escritor, es una muestra.** 20.000 vértices tomados
por zancada sobre `dense_id` —que por estar en orden Morton es una muestra *espacialmente
estratificada*— puntúan 0,269 a cinco millones contra un límite de 0,366. Y baten a la muestra
aleatoria por 1,44×, que es exactamente lo que compra la estratificación.

**El mipmap de densidad es el techo y cuesta lo que parece.** El nivel 10 puntúa 1,9× mejor que la
zancada a cinco millones, y cuesta **17× las marcas** (342.816 contra 20.000). El nivel 8 está entre
medias: 0,214 con 51.070 marcas.

### Lo que cuesta hoy la vista alejada, que es la otra mitad del argumento

La rama de agregado emite dos consultas. La de puntos es un `GROUP BY` y es barata. La de enlaces une
**la tabla de aristas entera dos veces** contra la de vértices y hace `DISTINCT`. Cronometrada,
nativa, catorce hilos:

| | puntos | **enlaces** |
|---|---|---|
| 1M | 0,013 s | **390,5 s** |
| 5M | 0,035 s | **306,9 s** |

No es una curva —las dos están dominadas por vuelco a disco, `sys` de 170–179 s— es una consulta rota
a cualquier tamaño desde un millón. En DuckDB-WASM con un hilo es la pestaña colgada que
`BENCHMARKS.md` ya describe para la CTE recursiva: *«una consulta lenta aquí no es lenta, es una
pestaña colgada»*. **La vista alejada a un millón no es que se vea mal: es que no vuelve.**

Y no hay nada que salvar en ella, porque **a la escala alejada no hay aristas**. Con una muestra de
20.000 sobre cinco millones, el número esperado de aristas con los dos extremos muestreados es
`(20.000/5M)² × 35M = 0,56`. Menos de una.

### Recomendación

**La vista alejada es un campo de densidad, no un conjunto de super-nodos, y no tiene capa de
aristas.** En tres piezas, por orden de coste:

1. **Borrar la rama de agregado por columna categórica** — `aggregate()` en
   `packages/graph/src/duck-source.ts`, las dos consultas. No se degrada: puntúa peor que el nulo y
   su consulta de enlaces no vuelve. Es un borrado, que es la primera constante de `CLAUDE.md`.
2. **El nivel 0 de la pirámide es una muestra por zancada de 20.000, precalculada.** Precalculada y
   no computada al leer: el predicado `dense_id % s = 0` toca *todas* las teselas, así que como
   consulta es lo peor posible y como fichero son 20.000 filas × 4 columnas ≈ **240 kB, una
   petición**.
3. **La pirámide que merece precalcularse es una escalera de zancadas sobre `dense_id`, no niveles de
   Leiden ni una rejilla.** Nivel ℓ = `dense_id % 4^ℓ = 0`, cada uno **una relación propia con su
   propia numeración densa, teselada exactamente igual que el nivel de detalle**. Elegir nivel es
   aritmética: el que deja la ventana por debajo del tope de 20.000 marcas.

**Por qué esta forma y no otra:** porque no reabre `decisions/a-tile-is-an-address-not-a-verb.md`.
Su cláusula «Reversed by» dice *«un nivel de agregación cuyo conjunto de teselas no se pueda derivar
de lo que el lector ya tiene»*. El de un nivel de zancada **sí** se deriva — extent del manifiesto,
número de filas del nivel en el manifiesto, misma aritmética de tesela. Ni una petición entre que la
cámara se mueve y una URL es calculable. Una rejilla de cuadtree también lo cumpliría; la escalera de
zancadas se prefiere porque **es la misma relación con menos filas**, así que el lector no aprende un
segundo formato y el escritor no emite un segundo tipo de fichero.

**Lo que cuesta:**

- *Escritor:* un `COPY` con predicado por nivel. Para cinco millones, niveles a zancada 1, 4, 16, 64,
  256 son `N·(1/4+1/16+1/64+1/256) = 1,66M` filas extra, cuatro columnas de dibujo ≈ **15,6 MB sobre
  ~50 MB del lado de vértices, un 31% más**. Cero trabajo de layout: es una proyección de filas que
  ya están ordenadas.
- *Lector:* elegir nivel por zoom (aritmética), y **borrar** la rama de agregado. El camino de
  lectura no cambia: un nivel es teselas con el mismo nombre y la misma caja.
- *Manifiesto:* una entrada por nivel con su recuento de filas. Es lo que ya se lee para `chunk_size`
  y `prefix`.

**Si 0,269 se juzga insuficiente**, el techo medido está en el nivel 8 del mipmap (0,214 con 51.070
marcas) y el nivel 10 (0,139 con 342.816). Esa es una decisión de calidad contra bytes con las dos
cifras delante, no una incógnita.

### Qué evidencia revertiría esto

- **Un corpus cuya columna categórica sí describa el campo.** Aquí `community` son 8 grupos de 625k
  y `cluster_id` tiene mediana 1: es la salida de este Louvain, no una propiedad de las jerarquías.
  Un Leiden a nivel medio con cientos de grupos compactos y equilibrados podría batir a la zancada.
  **La prueba es la misma tabla**: L1@8px contra el nulo, antes de creérselo.
- **Una maquetación que deje de llenar su caja.** Con 78–86% de celdas ocupadas de nivel 4 a 8, el
  campo es denso y el muestreo gana. Si el layout se volviera disperso —islas separadas por vacío—
  un resumen por marcas volvería a ser suficiente y la pirámide sobraría.
- **Que el tope de 20.000 marcas suba mucho.** Es lo que hace que la muestra compita con el mipmap.
  Con 350.000 marcas permitidas, el nivel 10 gana y la escalera de zancadas es el diseño equivocado.

---

## 2. La capa de aristas, dos agujeros

Los dos se midieron sobre las **mismas ventanas**: k = 20.000 vértices, cuadrado de Chebyshev
alrededor de centros tomados por rango de `subject` — la definición de `measure-retention.mjs`
verbatim, para no sembrar la medición con `dense_id`, que es una propiedad de lo que se mide. Cinco
ventanas por tamaño para el conteo; la ventana 2 para el rasterizado.

*Comprobación cruzada:* el rasterizador reporta 124.688 / 112.749 / 120.089 aristas dibujadas en la
ventana 2, y el contador reporta `kept` = 124.688 / 112.749 / 120.089 para esa misma ventana. Dos
programas distintos, la misma ventana.

### 2a. Las aristas que se descartan en silencio

| N | incidentes | dibujadas | **perdidas** | % perdido | rango por ventana |
|---|---|---|---|---|---|
| 200k | 777.181 | 627.075 | 150.106 | **19,31%** | 15,8 – 21,9% |
| 1M | 906.337 | 616.885 | 289.452 | **31,94%** | 16,4 – 44,0% |
| 5M | 775.876 | 551.496 | 224.380 | **28,92%** | 17,0 – 39,9% |

**Entre un quinto y un tercio de las aristas que tocan una ventana no se dibujan, a los tres
tamaños.** No crece con N —es plano entre 1M y 5M— y la dispersión entre ventanas (16% a 44%) es
mayor que la diferencia entre tamaños, así que la media es una media y no una ley.

En marcas: por cada tres aristas dibujadas se descarta una. Y **7.930 de los 20.000 vértices de una
ventana a cinco millones** tienen al menos una arista descartada (5.196 a 200k, 6.842 a 1M). No es
una decoración rara: es un tercio a un 40% de los nodos en pantalla.

**La mitad de la respuesta ya está en los bytes que el lector ha traído.** Separando por qué extremo
cae dentro:

| N | origen dentro, destino fuera | origen fuera, destino dentro |
|---|---|---|
| 200k | 72.773 (48%) | 77.333 (52%) |
| 1M | 186.992 (65%) | 102.460 (35%) |
| 5M | 95.832 (43%) | 128.548 (57%) |

Las de la primera columna **salen de las mismas teselas `by_source` que la consulta ya lee**. No
falta un fichero: falta la posición del extremo lejano y una decisión de dibujado. Sólo la segunda
columna necesita `by_target` teselado, que es del lado del corpus.

**Dónde cae el extremo lejano**, en múltiplos de la semi-anchura de la ventana (1,0 = justo en el
borde):

| N | p50 | ≤1,25 | ≤2 | ≤4 | >4 | peor |
|---|---|---|---|---|---|---|
| 200k | 1,35 | 43,2% | 64,3% | 92,4% | 7,6% | 6,5 |
| 1M | 1,78 | 29,9% | 56,9% | 79,7% | 20,3% | 16,9 |
| 5M | 1,64 | 31,9% | 58,7% | 77,6% | 22,4% | **47,1** |

**Del 57% al 64% de las perdidas tienen su otro extremo a menos de dos semi-anchuras**, es decir a
menos de una anchura de ventana del borde: un segmento recortado apunta a algo que un desplazamiento
alcanza, y la dirección es información honesta. El 20–22% restante apunta a algo a más de cuatro
semi-anchuras, y hasta 47 — ahí el muñón dice la dirección correcta y **miente sobre la distancia**,
porque un lector no distingue un muñón que acaba a 1,1 ventanas de uno que acaba a 47.

#### Recomendación

**En dos escalones, y el primero no necesita al corpus.**

1. **Relajar el join a «origen en la ventana» y recortar el segmento contra el viewport.** La
   consulta de enlaces une `vis` por los dos lados; unirla sólo por el origen devuelve las mismas
   filas más las de la primera columna de arriba, **sin leer un byte más** — vienen de las teselas
   `by_source` ya direccionadas. Lo que hay que añadir es la posición del extremo lejano, que ya está
   en las teselas de vértices que la ventana toca o en la vecina. Recupera el **43–65%** del agujero.
2. **La segunda pasada por `by_target`** para el resto. Necesita `by_target` teselado como
   `by_source`, que es exactamente lo que el otro agente está haciendo. Es el mismo direccionamiento
   con otro prefijo.
3. **Y lo mínimo honesto, que cuesta un `count`:** publicar cuántas aristas de la ventana tienen un
   extremo fuera. Hoy una imagen incompleta se ve idéntica a una completa — el mismo fallo que
   `matched` arregló para los vértices, sin arreglar para las aristas.

**Sobre el dibujado, y sujeto a §2b:** los muñones son una tercera capa de tinta sobre una que ya
está saturada. 7.930 nodos con muñón a cinco millones, con la regla de niebla de abajo, significa que
**los muñones caen bajo el mismo umbral que los segmentos**: por encima de él no se dibujan, se
cuentan. Por debajo, se recortan contra el viewport y el alcance del extremo se codifica (opacidad o
longitud), porque sin eso el 22% de cola larga es una mentira sobre la distancia.

#### Qué evidencia revertiría esto

- **Que el escalón 2 mida caro.** Si con `by_target` teselado la segunda pasada más que duplica el
  pan, el escalón 1 —que es gratis— es toda la respuesta, y el resto se cuenta en vez de dibujarse.
- **Un corpus multi-tipo.** `BENCHMARKS.md` mide que las aristas entre tipos caen dentro de la
  ventana el **0,00%** de las veces, a todos los tamaños. Ahí «recortar contra el viewport» no
  recupera nada: todas serían muñones, la mediana mide treinta anchuras de ventana, y la respuesta es
  la segunda clase de dirección (una vecindad), no el recorte. Esta recomendación es para corpus de
  un solo tipo; para un grafo de conocimiento hay que volver a medirla.

### 2b. La niebla, y a partir de qué número

Rasterizado exacto en un contador por píxel (DDA, un impacto por píxel y segmento, sin alfa y sin
mezcla — la tinta antes de que el renderizador la empeore), sobre el lienzo que tiene el workspace,
1200×800 = 0,96 Mpx. Ventana 2, un millón, 112.749 aristas dibujadas:

| aristas | por Mpx | cobertura | sobredibujado | % píxeles con ≥2 | **tinta trazable** |
|---|---|---|---|---|---|
| 564 | 588 | 1,93% | 1,12 | 8,6% | **81,8%** |
| 1.127 | 1.174 | 4,01% | 1,18 | 11,5% | 74,9% |
| 2.255 | 2.349 | 7,23% | 1,29 | 18,1% | 63,4% |
| 5.637 | 5.872 | 14,57% | 1,65 | 33,2% | 40,4% |
| 11.275 | 11.745 | 21,62% | 2,13 | 44,6% | 26,0% |
| 28.187 | 29.361 | 33,07% | 3,53 | 61,5% | 10,9% |
| 56.375 | 58.724 | 40,88% | 5,60 | 72,5% | 4,9% |
| **112.749 (la rebanada entera)** | 117.447 | **47,94%** | **9,52** | **81,3%** | **2,0%** |

*Tinta trazable* es la fracción de la tinta que cae en píxeles por los que pasa **un solo** segmento:
lo que un lector podría, en principio, seguir.

**El umbral, medido a los tres tamaños.** La trazabilidad cruza el 50% entre 2.494 y 6.234 aristas a
200k, entre 2.255 y 5.637 a 1M, y entre 2.402 y 6.004 a 5M — interpolando, **3.600 / 3.900 / 3.100**.

> **~3.500 aristas por megapíxel es donde la mitad de la tinta deja de ser trazable.** Sobre un
> lienzo de 1200×800 son **~3.400 aristas**. El sobredibujado medio llega a 2 hacia las 11.000/Mpx.

Y traducido a lo que el lector sabe *antes* de emitir la consulta de enlaces: en este corpus una
ventana dibuja **5,6–6,2 aristas por vértice** (124.688/20.000, 112.749/20.000, 120.089/20.000). Así
que el umbral en vértices es:

> **~600 vértices en pantalla** sobre 1200×800. El tope actual de la rebanada es 20.000 — **33×
> por encima**.

Es decir: **con el tope de hoy la capa de aristas es un 98–99% niebla, y lo ha sido en todas las
mediciones que `BENCHMARKS.md` registra.** Cobertura 41–48%, sobredibujado 9,5–12,4, trazable
1,2–2,0%.

#### El dato que más cambia el diseño: la mayoría de las aristas no son segmentos

Longitud de la arista dibujada, en píxeles:

| N | p50 | p90 | p99 | **< 1 px** | < 2 px |
|---|---|---|---|---|---|
| 200k | 1,60 | 130 | 441 | 35,2% | 56,2% |
| 1M | 1,47 | 152 | 459 | 38,5% | 57,4% |
| 5M | **0,52** | 164 | 563 | **64,6%** | **72,0%** |

A cinco millones **dos de cada tres aristas dibujadas miden menos de un píxel**: son un punto encima
de sus propios extremos, que la capa de puntos ya dibuja. La niebla la produce la minoría larga.

Y se puede quitar la mayoría sin tocar la imagen. Descartando toda arista de menos de 3 px:

| N | filas enviadas | píxeles con tinta que quedan | son los mismos píxeles |
|---|---|---|---|
| 1M | **35,3%** de 112.749 | 99,9% | 99,9% |
| 5M | **27,5%** de 120.089 | 100% | 100% |

**Un 65–72% menos de filas por una diferencia de imagen del 0,1%.** Es un predicado sobre el
resultado del join, exacto, sin pirámide, sin escritor y sin decisión de arte.

#### ¿Encaja la familia `raster`/`density` de Mosaic? Sí existe, y no encaja aquí

`@uwdata/mosaic-sql` **sí** trae rasterizado de segmentos en base de datos: `lineDensity`, sobre el
trabajo de Moritz y Fisher (arXiv:1808.06019), que usa `DenseLineMark`. No hay que inventarlo. Lo que
hace es: binar extremos, formar pares `(x0,y0,dx,dy)`, hacer **CROSS JOIN contra un rango tan largo
como el segmento más largo**, quedarse con `i < |dx|`, y agrupar.

Escrita a mano contra la misma ventana, tablas ya en memoria, nativa, catorce hilos:

| | join de enlaces (lo que el lector emite hoy) | + `lineDensity` encima |
|---|---|---|
| 1M | 0,002 s | **0,175 s** |
| 5M | 0,002 s | **0,229 s** |

**Unas 87–115× el join sobre el que se monta.** Y la salida es más grande que la entrada:

| | segmentos | **celdas encendidas que devuelve** |
|---|---|---|
| 1M | 112.749 | **471.384** |
| 5M | 120.089 | **466.206** |

**4,1× más filas de las que sustituye.** El rasterizado en la base de datos, en el camino del pan,
cuesta más CPU *y* más bytes para producir la misma imagen — porque el join sigue siendo obligatorio
(hay que tener el segmento antes de poder binarlo) y el ráster se añade encima. Medido: la tinta son
**38,9 píxeles por arista de media**, así que binar 120.000 aristas es materializar 4,4M de filas.

**Dónde estaría el cruce, para que no haya que re-derivarlo:** el ráster empieza a ser el payload
menor cuando el número de aristas supera el de celdas encendidas, que satura hacia **~470.000**. Hoy
la rebanada devuelve 120.000. Estamos **4× por debajo** del punto en que la aritmética se da la
vuelta, y sólo subir el tope de vértices lo cruzaría.

#### Y no vale «quitar las aristas y dejar la densidad de puntos»

Era la salida barata y está **refutada**. Comparando el campo de tinta de las aristas contra el campo
de densidad de vértices de la misma ventana:

| escala de comparación | Pearson 1M | Pearson 5M | L1 1M | L1 5M |
|---|---|---|---|---|
| 4 px | 0,651 | 0,532 | 1,754 | 1,836 |
| 8 px | 0,647 | 0,488 | 1,612 | 1,687 |
| 16 px | 0,634 | 0,430 | 1,263 | 1,341 |

Correlación de 0,43 a 0,65 y L1 de 1,3 a 1,8 sobre una escala que llega a 2. **La tinta de las
aristas no está donde están los vértices**, porque la produce la minoría larga, que va justo entre
regiones densas y no dentro de ellas. La capa de aristas dice algo que la de puntos no dice, aunque
lo diga en forma de niebla.

#### Recomendación

**No meter `raster`/`density` en el camino del pan.** Está medido que ahí cuesta 87–115× el join y
devuelve 4,1× las filas. Lo que sí hay que hacer, por orden de coste:

1. **Predicado de longitud ≥ 2–3 px sobre el resultado del join.** 2,8–3,6× menos filas por el 0,1%
   de imagen. Ya.
2. **Aceptar que por encima de ~3.500 aristas/Mpx la capa de aristas es un campo de densidad, y
   dibujarla como tal.** Con 1,2–2,0% de tinta trazable no está comunicando enlaces, está
   comunicando densidad — y hoy lo hace con mezcla aditiva a opacidad 0,45 sobre curvas, que es la
   peor forma posible de comunicarla. Esto es una decisión de `Look` (no aditivo, alfa contra la
   densidad local), no una consulta nueva, y `ONE-PATH.md` ya la tiene señalada como *«que la imagen
   se lea»*. Es lo barato y es lo que se nota.
3. **Debajo del umbral, la capa de aristas es honesta y hay que dejarla en paz.** Por debajo de ~600
   vértices en pantalla la trazabilidad pasa del 50% y un segmento es un segmento.
4. **El ráster pertenece a la vista alejada, precalculado**, donde es el techo del §1 — y allí no hay
   aristas que rasterizar de todos modos (0,56 esperadas).
5. **Si un lector tiene que ver enlaces individuales a escala, la respuesta es menos marcas, no otra
   imagen:** una vecindad, que es la segunda clase de dirección del contrato, no un rectángulo.

#### Qué evidencia revertiría esto

- **Que el tope de la rebanada suba por encima de ~470.000 aristas.** Ahí el ráster pasa a ser el
  payload menor y la aritmética se invierte. Es el único número que cambia la conclusión de forma
  limpia.
- **Un corpus mucho más disperso.** El umbral está en aristas por megapíxel, así que un grafo de
  grado medio ≤ 2 mantendría la ventana por debajo de las 3.500/Mpx con el tope actual y no habría
  niebla que resolver.
- **Que `lineDensity` en WASM mida mejor que su versión nativa.** Es imposible por construcción
  —DuckDB-WASM tiene un hilo y la nativa tiene catorce— pero si alguien lo mide y no lo es, es que la
  consulta que se probó aquí no es la que Mosaic emite, y hay que rehacer la comparación con la
  marca de verdad en vez de con la transformación a mano.
- **Que el campo de tinta de aristas y el de vértices correlacionen alto en otro corpus.** Aquí es
  0,43–0,65 y por eso la capa no se puede borrar. Con 0,9 se podría, y sería el mayor ahorro de todos.

---

## Lo que esto no puede probar

- **Nada de aquí se midió en un navegador.** `duckdb` nativo, catorce hilos, ficheros locales. Los
  milisegundos son **razones entre alternativas**, no presupuestos: los 0,175 s de `lineDensity` y
  los 306 s del agregado son cotas inferiores de lo que costarían en DuckDB-WASM con un hilo.
- **Una familia de corpus.** Hiperbólico, un tipo de vértice, una relación. `BENCHMARKS.md` ya
  demuestra que el caso multi-tipo rompe cosas que el de un tipo no rompe (0,00% de aristas cruzadas
  dibujables), y §2a lo dice donde toca. El §1 no se ha medido sobre `kg.fossil` en absoluto.
- **Cinco ventanas por tamaño para la pérdida, una para la niebla.** La dispersión de la pérdida es
  16%–44% entre ventanas: la media es una media.
- **El rasterizado supone segmentos de un píxel, rectos, sin alfa.** El renderizador dibuja curvas
  mezcladas de anchura variable, que sólo pueden cubrir más píxeles. La niebla medida es una **cota
  optimista**.
- **La métrica del §1 es un campo de masa.** No mide si un lector puede *identificar* qué región está
  mirando —eso es etiquetado, y ningún L1 lo captura— ni si el color por categoría sobrevive al
  resumen. Un resumen con L1 bajo y sin la columna de categoría sería igual de inútil por otra razón.
- **No hay ninguna medición de re-maquetado.** Si la reescritura de `rmlext` mueve posiciones y no
  sólo fronteras de fichero, todo este fichero caduca. Es lo primero que hay que preguntar.
- **La reconstrucción a cinco millones usa un binario de fossil del 2026-08-14.** Reproduce el corpus
  registrado exactamente, lo cual dice que es el mismo escritor; no dice nada sobre el que viene.
