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
