# Adoptar el corpus de fossil, y borrar el nuestro — plan, 2026-08-25

Escrito para sobrevivir a un `/clear`. Lo que hay aquí es estado medido el 25, no recuerdo.

## 0 · Dónde estamos, con evidencia

- **`@fossil-lang/graph@0.3.0-alpha.1` está publicado en npm.** Aquí no dependemos de él todavía.
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

## 1 · Dos incógnitas que hay que resolver ANTES de planificar fases

Deciden cuánto se borra, y no las he mirado:

1. **¿`window()` habla en coordenadas de mundo, y toma un presupuesto?** Un rectángulo no es una
   cámara: falta la escala, que es lo que decide el muestreo. Si `window` no toma un `limit`, la
   regla de la zancada sobre Morton se queda de este lado y su respuesta de completitud es relativa
   a un número que inventa quien llama.
2. **¿Está escrita ya la disposición de un fichero con row groups de 4.096 en los corpus servidos?**
   De eso depende que dejemos de sondear footers, y que la caché de cajas sobre.

## 2 · Las fases

**F1 · Spike, sin tocar el lector.** Añadir la dependencia y abrir un corpus con su API en un
fichero aparte. Salida: qué devuelve `window()`, en qué coordenadas, y cuántas peticiones cuesta.
Con eso se contestan las dos incógnitas y esta planificación se vuelve concreta.

**F2 · Adoptar en un solo sitio.** El `BoundedSource` que la canvas consume pasa a apoyarse en
`openCorpus` de fossil. Sabremos que salió bien cuando **la mitad que desaparece de
`duck-source.ts` sea la que sabía de prefijos**.

**F3 · Los borrados que ya estaban pendientes**, y que esta adopción hace baratos: `memorySource`,
`duckBoundedSource`, la lápida de `IdSetClient` — el «paso 10» del plan anterior.

**F4 · Las tres rutas**, ya sobre una API que no se mueve: teselado y zoom (la que enseña),
larger-than-RAM, y benchmarks (el `graph-bench` que hoy no tiene página, sólo
`/view/showcases/graph-bench`).

**Lo que NO se muda, y es la línea que protege «fossil no envía visor»:** caché de teselas,
debounce, cancelación por supersede, el `MosaicClient` con el predicado del crossfilter, `Resident`
y los buffers, la política de cuándo muestrear, y cosmos.gl entero.

## 3 · Lo que sobrevive y no debería

- ~~El renombre aprobado el 19 y nunca hecho.~~ **Hecho el 25, `b6f3073`.** Coste registrado: en los
  seis días de espera el nombre viejo ganó un segundo fichero de test, así que renombrar dos ficheros
  fue renombrar cuatro, y las citas eran de cuatro registros y no de tres.
- **`adaptive()`**: exportado, **cero llamadas** (medido el 19). El repo tiene un registro que se
  llama `an-export-needs-a-second-call-site`.
- **`.planning/` miente por partes.** `READER-VS-CORPUS.md` abre con *«no hay un lector
  direccionado»* y `openCorpus` aterrizó después. Un directorio de planes donde un tercio de los
  ficheros afirma cosas falsas es peor que ninguno: o se fecha y se marca, o se borra.

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

## 4.5 · Seis tests rojos en `packages/ui`, que no son del grafo

Medido el 25, con el renombre ya dentro y **sin un solo fichero de `packages/ui` tocado**:
`CodeEditor` (2), `Preferences` (*«wears a side by pressing its Colour card, with no toggle in the
header»*), `Questionnaire` y `code-editor-search`. Los nombres apuntan a la refundación del tema
—`data-theme` sustituyendo a `data-palette`/`data-identity`— que aterrizó mientras esta sesión no
miraba. `build`, `typecheck`, `lint` y `size` están verdes; sólo `test` no.

**Quien retome: esto es lo primero, antes que F1.** Un repo cuyo `pnpm test` está rojo no puede
distinguir un fallo nuevo de uno heredado, que es la propiedad que hace útil la cadena entera.

## 5 · Verificación, en este orden

`pnpm build`, `typecheck`, `lint`, `check:generated`, `test`, `size`, `smoke`, y
`pnpm --filter @kanzo-tech/docs build`. Más la comprobación viva: abrir la ruta, mover la cámara y
**asertar sobre el DOM** (peticiones, bytes, marcas dibujadas frente a `n`), nunca sobre una captura.

## 6 · Coordinación

Otras sesiones escriben en este mismo checkout. Atribuir antes de actuar, commitear por rutas
explícitas, y avisar por `SendMessage` antes de entrar en `packages/graph` o en
`docs/showcases/workspace/*`, que es donde tres sesiones se cruzaron el 19.
