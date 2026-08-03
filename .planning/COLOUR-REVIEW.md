# La capa de color y tema — revisión

Escrita 2026-08-01, a petición del dueño del sistema: *«en general revisaría nuestro sistema, no me
acaba de convencer, no sé si es el mejor diseño»*. Entró por un bug concreto —el sistema de paletas
no reparte sintaxis, así que el `CodeEditor` no es tematizable— y ese bug resultó ser el síntoma más
visible de algo estructural.

Esto **no** es un spec. Es una auditoría que termina en cuatro decisiones. Cada número del repo
lleva el comando que lo reproduce; cada afirmación sobre un sistema ajeno lleva enlace a fuente.

---

## 1 · Qué no está en juego

Tres piezas se quedan, y decirlo primero es lo que permite que esto sea corto. **La crítica no es a
la matemática.**

- **Las obligaciones medidas de `ramp.ts`.** Doce pasos donde cada uno debe algo verificable
  (`OBLIGATIONS`, `roles.ts` lee `Ramp.boundary` en vez de codificar el paso 8), y los valores son
  consecuencias. Radix afina sus escalas a mano; esto es mejor.
- **El set categórico con `capacity`.** Nombrar cinco categorías de verdad en vez de ocho que un
  daltónico ve como cinco.
- **`relief` / `Adjustment`.** «Esto se movió, esta regla lo movió, y costó ΔE 7.27.» Es lo que hace
  auditable una marca blanca ante un cliente que aprobó un render.

Lo que se revisa es el **vocabulario sobre el que esa matemática proyecta** y el **mecanismo por el
que llega al navegador**.

---

## 2 · La evidencia

```bash
grep -c '^  { token:' packages/palette/src/roles.ts                       # 58 filas a mano
sed -n '/^:root/,/^}/p' packages/theme/tokens.css | grep -c '^  --'       # 84 declaraciones
sed -n '/@theme inline/,/^}/p' packages/theme/tokens.css | grep -c color- # 64 mapeos a Tailwind
grep -cE '^\s+--(neutral|brand|destructive|warning|success|info)-[0-9]+:' \
  packages/theme/tokens.css                                               # 0  ← el hallazgo
```

**Cero.** Las rampas se calculan, se miden, se les imponen obligaciones… y **mueren dentro de
`resolveRoles`**. Ni un solo paso llega a la hoja. Nada aguas abajo puede nombrar un paso de una
rampa: ni un componente, ni un consumidor, ni el editor de código.

Y el vocabulario se mantiene a mano en **tres sitios** que tienen que estar de acuerdo: la tabla
`ROLES` (58 filas), las declaraciones compiladas (84) y el bloque `@theme inline` que las convierte
en utilidades Tailwind (64 mapeos). Añadir un token es tocar los tres.

### El corte que lo explica todo

Partiendo la tabla por el tipo de binding —lo que ya distingue `roles.ts` entre `step`/`alpha` y
`fill`/`on-fill`/`boundary`/`recess`:

```bash
sed -n '/^export const ROLES/,/^];/p' packages/palette/src/roles.ts > /tmp/r.txt
grep -oE 'kind: "(fill|on-fill|boundary|recess)"' /tmp/r.txt | wc -l    # 12
grep -c 'binding: step(' /tmp/r.txt                                    # 29
grep -c 'kind: "alpha"' /tmp/r.txt                                     # 17
```

| tipo de fila | cuántas | qué es |
|---|---:|---|
| **Decisión medida** | **12** | `--primary` = el paso que la semilla alcanza (`fill`); `--input` = el primero que cruza 3:1 (`boundary`); `--field` = el alfa *si retrocede*, si no la página (`recess`). Un número de paso no puede expresarlas. **Se ganan su nombre.** |
| **Sólo un nivel** | **46** | `--muted` = neutral 3. `--secondary-wash` = neutral a4. `--match` = warning a5. `--selection` = brand a5. Un nombre para un paso. |

**79 % de la tabla es un paso de una rampa con un nombre encima.** Y quince de esos nombres son
nombres inventados para un nivel pintado sobre algo que el componente no controla:

```
--field  --faint  --selection  --match  --match-active
--secondary-wash  --accent-wash  --{destructive,warning,success,info}-wash{,-strong}
```

Se usan poco y desigual —`bg-field` 18 sitios, `text-faint` 10, `--secondary-wash` 5, `--accent-wash`
3, `--match` 2, `--selection` 1— porque no son un vocabulario que alguien diseñó. Son **una válvula
de escape tallada a mano, un token cada vez**, cada uno con su párrafo de justificación en
`roles.ts` (628 líneas, la mayoría explicando por qué existe cada nombre).

Y el caso que abrió todo esto es el mismo mecanismo una vez más: la sintaxis pedía **trece** tokens
nuevos. El grafo pidió los suyos. Un heatmap de calendario pedirá otros.

---

## 3 · Los dos polos, verificados contra fuente

| sistema | capa de referencia | capa semántica | capa de componente |
|---|---|---|---|
| **Radix Themes** | `--accent-1..12` + `--accent-a1..12` (24/familia), pública | **13** alias | recetas sobre pasos |
| **Material 3** | `md.ref.palette.*`, tonos 0–100, pública | `md.sys.color.*` — **45** roles | `md.comp.*` |
| **Panda CSS** | `tokens` | `semanticTokens`, referencian a los primeros con `{}` | — |
| **Kanzo hoy** | **ninguna** | **79** roles | — |

Radix documenta la semántica posicional de cada paso — 1 fondo de app, 3 fondo de elemento, 6 bordes
sutiles, 9 fondos sólidos, 11 texto de bajo contraste, 12 texto de alto contraste
([Understanding the scale](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale))
— y además publica 13 alias semánticos: `--accent-surface`, `--accent-indicator`, `--accent-track`,
`--accent-contrast` por familia, más `--color-background`, `--color-panel-solid`,
`--color-panel-translucent`, `--color-surface`, `--color-overlay`
([Themes · color](https://www.radix-ui.com/themes/docs/theme/color)).

M3 tiene tres capas: `md.ref.palette.primary40` (referencia) → `md.sys.color.primary` (sistema, 45
roles, [ColorScheme](https://api.flutter.dev/flutter/material/ColorScheme-class.html): *«A set of 45
colors based on the Material spec»*) → `md.comp.*` (componente). Un botón que necesita un color no
acuña un rol de sistema: declara `--md-filled-button-container-color: var(--md-sys-color-error)`
([Material Web · theming](https://material-web.dev/theming/material-theming/)).

Panda separa `tokens` de `semanticTokens`, y los segundos *referencian* a los primeros con la
sintaxis `{colors.red}`, con condiciones para claro/oscuro
([Panda · tokens](https://panda-css.com/docs/theming/tokens)).

### El hallazgo

**Mi tesis inicial era que Kanzo estaba en el polo del rol y que el polo de la escala era el bueno.
La evidencia la refuta: los dos polos publican la escala.** Radix mina exactamente los mismos
nombres-de-nivel que critiqué —`--accent-surface`, `--accent-track`— y M3 tiene 45 roles semánticos.
Un vocabulario de roles no es el error.

Lo que ninguno de los tres hace es tener **una sola capa**. Y ésa es la diferencia real:

> Un vocabulario de roles sin una escala publicada debajo **no tiene válvula de escape**, así que
> cada necesidad nueva se convierte en un rol nuevo.

Radix tiene 13 alias y no crecen, porque quien necesita algo que los 13 no cubren escribe
`--accent-a5`. M3 tiene 45 y no crecen, porque un componente que necesita algo declara un token de
componente que apunta a uno de sistema. **Kanzo tiene 79 y crecen con cada consumidor, porque no hay
nada más abajo a lo que apuntar.** Los 46 nombres-de-nivel *son* la capa de referencia,
filtrándose hacia arriba de uno en uno.

---

## 4 · Duda 1 · el vocabulario

**Confirmada, y es la raíz.** No por los 79 roles —M3 tiene 45 y Radix 13 y ambos están sanos— sino
porque **falta la capa de abajo**, y sin ella el número no puede dejar de crecer.

**Recomendación: publicar la escala. No tocar los 12 roles que son decisiones medidas.**

Emitir, generado por `compile()` como todo lo demás:

```
--neutral-1..12   --neutral-a1..12
--brand-1..12     --brand-a1..12
--destructive-1..12  --warning-…  --success-…  --info-…      (6 familias × 24 = 144)
```

Suenan muchas propiedades y es exactamente al revés: son **generadas**, mientras que las 46 que
sustituyen son **escritas y justificadas a mano**. El coste de mantenimiento se mueve de la tabla al
compilador, que es donde ya vive todo lo demás.

Qué pasa con cada grupo:

- **Los 12 medidos se quedan.** `--primary`, `--input`, `--field`, los `-content`. Un paso no expresa
  «el primero que cruza 3:1».
- **Los 46 niveles se convierten en alias finos**, al estilo Panda, y los que no ganen su nombre
  desaparecen: `--secondary-wash` es `--neutral-a4` y no necesita otro nombre; `--match` es
  `--warning-a5`.
- **Se conservan los nombres que Shark exige.** `bg-accent`, `bg-muted`, `text-muted-foreground` son
  el contrato con las recetas de Shark que se pegan verbatim (87 sitios usan
  `text-muted-foreground`). Siguen existiendo como alias sobre pasos — que es literalmente lo que ya
  son hoy, sólo que sin poder decirlo.

En Tailwind v4 la consumición es casi gratis: el bloque `@theme inline` que ya existe registra
`--color-neutral-4: var(--neutral-4)` y `bg-neutral-4` sale solo.

---

## 5 · Duda 2 · las dos autoridades

**Confirmada, y la premisa que la sostiene no se aguanta al medirla.**

El color es una hoja servida en build; los otros cuatro ejes son atributos en runtime. El provider
tiene una preferencia `palette` cuyo propio JSDoc admite que no aplica nada
(`KanzoThemeProvider.tsx:220`: *«Wiring this does not apply anything»*). De ahí salen tres
imposibilidades que se presentan como consecuencias físicas: sin previsualización, sin ámbito, sin
cambio de paleta sin ida al servidor.

```bash
ls -la packages/theme/palettes/*.css   # 4.7 – 5.6 kB cada documento
```

**Un documento compilado son 4,7 kB.** Los cinco, 24 kB sin comprimir; con gzip, del orden de 5. Eso
es menos que un icono. «Un documento es una hoja de estilo, así que el servidor la sirve» es una
**decisión de despliegue presentada como una restricción física**, y de ahí salieron el
`cookieStorageAdapter` obligatorio, el `elevate` para que un documento gane a otro, y una preferencia
que el provider no puede honrar.

La restricción que sí es real y que cualquier propuesta debe respetar: los valores tienen que seguir
siendo **hexes literales**, porque `resolveTokenColor` los lee con `getComputedStyle` para dárselos a
Observable Plot, que rechaza `var()`, `color-mix()` y `oklch()` (`charts/theme.ts:31`). Es lo que ya
mató a `light-dark()`. Publicar la escala no la toca: 144 hexes literales más.

**Recomendación:** el documento deja de ser «una hoja que sustituye a otra» y pasa a ser **un bloque
con ámbito**. `compile(doc, { scope })` — la extensión natural de `elevate`, que ya existe para que
dos documentos convivan. Con eso:

- el `<KanzoTheme>` anidado al estilo `<Theme>` de Radix es posible, y la página de theming puede
  enseñar cinco paletas a la vez;
- cambiar de paleta en runtime es cambiar un atributo, no un viaje al servidor;
- la preferencia `palette` del provider por fin aplica algo, y `elevate` y la mitad de la
  documentación sobre orden de fuentes desaparecen.

**Advertencia que hay que codificar, no descubrir:** los overlays de Ark portalan a `document.body` y
se escapan de cualquier ámbito que no sea `<html>`. El ámbito es para previsualizaciones; el chrome
de la app se sigue tematizando en la raíz. Va en el JSDoc, en los docs y en un test.

---

## 6 · Duda 3 · ningún producto lo ha usado

**Confirmada, y es la que más debería pesar en el orden de las otras tres.**

```bash
grep -l '"@kanzo-tech/ui"' ../*/package.json   # sin resultados
```

Ni keasy ni metadata-form dependen de `@kanzo-tech/ui` — lo único de Kanzo que consume
`metadata-form` es `@kanzo-tech/rudof-wasm`. **Cero consumidores externos.** Todo este
diseño se ha derivado de primeros principios y se ha validado midiéndose contra sí mismo. Las
decisiones están bien argumentadas *y no han recibido tirón*.

Y hay una pregunta que sólo un consumidor puede contestar, que es justo la de la duda 1: **¿cuál de
los 46 nombres-de-nivel usaría una pantalla real, y cuáles no se usan porque nadie los necesitaba?**
Los recuentos de arriba ya insinúan la respuesta —`--selection` en 1 sitio, `--match` en 2— pero un
uso interno no es demanda.

**Recomendación: no bloquear la duda 1 detrás de esto, pero sí ordenarlas.** Publicar la escala es
aditivo y no rompe nada: se puede hacer antes de migrar una pantalla, y de hecho hace la migración
más fácil, porque una pantalla que necesita un color raro tendrá dónde ir sin pedir un token nuevo.
Lo que sí debe esperar a un consumidor real es **borrar** los 46 alias: eso es una decisión sobre qué
vocabulario quiere hablar un producto, y aquí no hay ninguno que hable todavía.

---

## 7 · Duda 4 · los tres paquetes

**La más débil de las cuatro, y conviene decirlo en vez de inflarla.**

```bash
grep -rn 'from "@kanzo-tech/palette' packages/ui/src --include='*.ts*'
# packages/ui/src/no-literal-hues.test.ts:3   ← el único, y es un test
```

La frontera está **bien dibujada**: `palette` es matemática de autoría y no entra en el runtime; `ui`
consume `theme` (12 imports) y `palette` sólo desde un test. No hay violación de capas.

Lo que hay es un problema de **nombres**: tres cosas se llaman tema (`packages/theme`,
`packages/ui/src/theme/`, y el `themes.css` generado), y la tabla de roles —el vocabulario— vive en
`palette` mientras el CSS que produce vive en `theme`. Es confuso al leerlo, no al ejecutarlo.

**Recomendación: no reorganizar paquetes.** Si la duda 1 sale adelante, el vocabulario se reduce a
una escala generada más ~12 decisiones medidas, y `roles.ts` deja de ser 628 líneas de justificación.
Buena parte de la confusión se disuelve sola. Revisar los nombres **después**, no antes.

---

## 8 · El caso que lo abrió: sintaxis y `CodeEditor`

Una revisión que no sabe contestar a su propio caso desencadenante es teoría.

**Estado verificado.** `roles.ts:289` fija `SYNTAX_SOURCE = { light: "kanzo", dark: "kanzo-dark" }`,
así que los seis documentos compilados declaran los mismos 26 valores `--kanzo-syntax-*`; los slots
base16 de Dracula y Nord están en `palette-data.json` sin usar. Elegir Dracula da superficies Dracula
y sintaxis Kanzo. Son además los **únicos** valores del sistema de tipo `fixed`: ni derivados ni
medidos.

**Con la escala publicada, el problema se encoge de trece tokens a siete.** Seis de los trece dejan de
existir porque ya tienen dónde apuntar:

| rol | pasa a ser | |
|---|---|---|
| `comment` | `--neutral-10` | la tinta «presente pero no es contenido» ya existe |
| `punctuation` | `--neutral-11` | |
| `operator` | `--neutral-12` | hoy ya *es* la tinta, con otro nombre |
| `invalid` | `--destructive-11` | es un estado, y hay una familia para eso |
| `inserted`/`deleted`/`changed` | `--success-*`/`--destructive-*`/`--warning-*` | ya lo eran |

Quedan **siete tonos cromáticos** (keyword, string, number, type, function, property, identifier) que
sí son hues nuevos y necesitan derivación con obligaciones medidas —legible sobre la línea activa,
ΔE ≥ 8 entre sí, nunca más contrastados que la tinta, y capacidad cuando dos colapsan— más
adaptadores para que un esquema ajeno (base16, un tema de VS Code) entre **como tonos** y se resuelva
contra la página del inquilino. Eso ya estaba diseñado y acordado; no cambia.

**Y el editor deja de ser un caso especial.** Hoy `CodeEditor.tsx` registra su tema con
`EditorView.theme({...})` sin `{dark}`, así que las reglas `&light` de CodeMirror aplican también en
oscuro, y el fichero lo compensa con una cadena de cinco selectores (línea 317) que documenta como
tal. Con la escala publicada, un editor —o un grafo, o un heatmap— **referencia pasos** en vez de
pedirle tokens al sistema de diseño. Es exactamente el patrón `md.comp.*`.

---

## 9 · Las decisiones

| # | decisión | recomendación | coste |
|---|---|---|---|
| **1** | ¿Se publica la capa de referencia (6 familias × 12 pasos + 12 alfas)? | **Sí.** Es la propiedad que tienen los tres sistemas de referencia y que a éste le falta. Aditivo: no rompe nada el día que entra. | `compile.ts` + `roles.ts` + regenerar. ~2 días. |
| **2** | ¿Se borran los 46 alias de nivel, o se quedan como capa fina? | **Se quedan los que Shark exige** (`bg-accent`, `bg-muted`, `text-muted-foreground`: contrato con recetas que se pegan verbatim). **Se borran los 15 nombres-de-nivel** en cuanto una pantalla real diga que no los usa. | Rompedor, pero nada está publicado. Tras decisión 4. |
| **3** | ¿El documento pasa de hoja servida a bloque con ámbito? | **Sí.** 4,7 kB desmontan la premisa. Desbloquea previsualización, ámbito y cambio en runtime, y borra `elevate` y el `cookieStorageAdapter` obligatorio. | `compile.ts` + provider + `<KanzoTheme>`. ~3 días. |
| **4** | ¿Se migra una pantalla de keasy antes de borrar vocabulario? | **Sí, y es lo que ordena todo lo demás.** Publicar la escala puede ir antes; borrar alias, no. | La migración ya estaba en el plan de showcases. |

**Orden propuesto:** 1 → 3 → 4 → 2. Las dos primeras son aditivas y se pueden mergear a `main` por
separado; las dos últimas son las que deciden qué vocabulario habla un producto, y para eso hace
falta un producto.

**Lo que arregla el bug que abrió todo esto:** la sintaxis derivada y el `CodeEditor` no dependen de
ninguna de las cuatro. Pueden ir primero, y bajo la decisión 1 son un 46 % más pequeños.

---

## 10 · La arquitectura que dibujan las decisiones 1 y 3

Las secciones anteriores diagnostican. Ésta dibuja el destino, para que la decisión no se tome sobre
una lista de cambios sino sobre una forma.

```
SEMILLAS            brand #2b7fff · neutral #6b7280 · [fuente de sintaxis]
    │
    │   @kanzo-tech/palette — autoría, se ejecuta UNA vez al onboarding
    │   deriveRamp ×6 familias ×2 modos · deriveScheme · deriveSyntax
    ▼
DOCUMENTO           palettes/*.json — datos versionados, con relief y crossChecks
    │               añadir un cliente = un documento, cero código
    │   compile(doc, { scope })
    ▼
╔═ CAPA 1 · REFERENCIA ═══════════════════════════ 144 propiedades, GENERADAS ═╗
║  --color-base-1..12   --color-base-a1..12      → bg-base-3, text-base-11    ║
║  --color-brand-1..12  --color-brand-a1..12     → bg-brand-9                 ║
║  --color-{destructive,warning,success,info}-1..12 + alfas                   ║
║  en @theme, genera utilidades · semántica posicional de Radix · hexes       ║
╚═════════════════════════════════════════════════════════════════════════════╝
    ▲
╔═ CAPA 2 · SISTEMA ══════════════════════════════ ~40 roles, CERRADA ════════╗
║  12 DECISIONES MEDIDAS   --primary=fill · --input=boundary                  ║
║     un número de paso     --field=recess · --*-content=on-fill              ║
║     no las expresa                                                          ║
║  ~20 ALIAS DE CONTRATO   --muted=neutral-3 · --accent=neutral-5             ║
║     el vocabulario de     --border=neutral-6 · --background=neutral-1       ║
║     Shark, que se pega verbatim                                             ║
║  8 --chart-N + capacity   ·   7 --syntax-N (tonos, no pasos)                ║
╚═════════════════════════════════════════════════════════════════════════════╝
    ▲
╔═ CAPA 3 · COMPONENTE ═══════════════════════ la válvula, HOY NO EXISTE ═════╗
║  --editor-active-line: var(--neutral-3)                                     ║
║  --editor-gutter:      var(--neutral-2)                                     ║
║  --graph-marquee:      var(--brand-a5)                                      ║
║  la declara el COMPONENTE, no el documento · nunca vuelve a la tabla        ║
╚═════════════════════════════════════════════════════════════════════════════╝
```

### Las cinco reglas

1. **Sólo hacia abajo.** Capa 3 → 2 ó 1. Capa 2 → 1. Capa 1 → nada. Un componente jamás pide un token
   nuevo al sistema de diseño: declara el suyo y apunta. Es lo que cierra el crecimiento, y es
   literalmente lo que hace Material Web con
   `--md-filled-button-container-color: var(--md-sys-color-error)`.
2. **Un rol de capa 2 existe sólo si es una decisión medida o un contrato con Shark.** Es comprobable
   y no una convención: si su binding es `step` o `alpha` puro y su nombre no está en el vocabulario
   de Shark, no es un rol — es capa 1 con otro nombre. Eso es un lint, y es el que habría impedido
   que aparecieran los quince nombres-de-nivel.
3. **Capas 1 y 2 se emiten literales.** El alias se resuelve en el compilador, no en el navegador.
   Así `resolveTokenColor` y los charts no cambian —la restricción de §5 se respeta sin pensar— y la
   hoja sigue siendo diffable contra el render que aprobó un cliente. El `var()` aparece sólo en capa
   3, que nadie resuelve numéricamente.

### Tailwind es la referencia, y daisyUI el precedente

Decidido 2026-08-01 tras verificar ambos en fuente, y corrige dos cosas que este documento decía
antes.

**La capa 1 entra en `@theme` y genera utilidades.** En Tailwind v4 *«a corresponding utility with
the same name will become available»*: un token que no genera utilidad no es un token, es una
variable suelta. Y Tailwind publica 22 familias × 11 pasos como *sus* tokens — **una escala es el
modelo Tailwind**. Exponer la capa 1 sólo como `var()` habría sido el modelo de Radix
([Tailwind · theme](https://tailwindcss.com/docs/theme)).

**La neutra se llama `base`.** De las seis familias, sólo `neutral` colisionaba con Tailwind
(`bg-base-3` junto a `bg-neutral-300` es pedir un error); `brand`, `destructive`, `warning`,
`success` e `info` no existen en su paleta. `base` es la palabra de daisyUI para exactamente esto y
este repo ya la cita como referencia. Así no hay que limpiar el namespace —Tailwind sólo permite
`--color-*: initial`, entero— y el código de una app conserva las 22 familias.
*Consecuencia asumida sin preguntar:* el renombrado es consistente hasta la semilla
(`RampName`, `seeds.neutral`, `neutralHue`, `HueSource`), porque dos nombres para una cosa es la
enfermedad que este documento diagnostica. El esquema sube a v4 de todas formas.

**daisyUI ya hace la decisión 3, y eso la avala.** Sus temas viajan todos en la página como bloques
`[data-theme="x"]`, se conmutan cambiando un atributo y **se anidan**: *«Add `data-theme` to any
element and everything inside will have your theme. You can nest themes and there is no limit!»*
No hay que inventar el mecanismo ([daisyUI · themes](https://daisyui.com/docs/themes/)).

**Donde no le seguimos, y por qué.** daisyUI no tiene escala: su válvula de escape es
`color-mix(in oklab, var(--color-base-content) 10%, transparent)` en el sitio de uso — 240 mezclas
sobre `base-content` sólo, verificado en su CSS publicado. Aquí eso ya se midió y se descartó: el
porcentaje aterriza en un paso alfa **distinto según el modo** (`/4` es a3 en claro y a2 en oscuro),
así que cada `bg-X/NN` era correcto en un modo como mucho. Los pasos alfa derivados dan el mismo
resultado en los dos y bajo Tailwind generan `bg-base-a4`, igual de nativo. No es un defecto de
daisyUI: es que ellos toleran esa asimetría y este sistema tiene una obligación (`alpha-fidelity`)
que no se lo permite.

**Y `--faint` deja de ser un paso.** Está atado al paso 10, cuyo deber declarado en `OBLIGATIONS` es
`solid-hover` — tinta viviendo en un paso de relleno, que funciona sólo porque en una rampa neutra el
paso 10 es una claridad y nada más. Pasa a ser una decisión medida, con la forma de `boundary`: *la
tinta más silenciosa que aún cumple AA contra la página*, y la rampa contesta. Se une a las 12 y deja
las 46.
4. **El documento es un bloque con ámbito, no una hoja que sustituye a otra.** De ahí la
   previsualización, el `<KanzoTheme>` anidado y el cambio en runtime; y mueren `elevate` y el
   `cookieStorageAdapter` obligatorio.
5. **El documento sigue siendo el artefacto.** Derivado y medido una vez, versionado, exportable, con
   el registro de lo que se movió. Nada de lo anterior lo toca.

### Qué cambia en números

| | hoy | después |
|---|---:|---:|
| propiedades emitidas | 84 | 144 (capa 1, generadas) + ~40 (capa 2) + N por componente |
| filas escritas a mano | 58 | ~32 |
| sitios a sincronizar | 3 (`ROLES`, CSS, `@theme inline`) | 1 (`ROLES`; el resto se genera) |

El coste de mantenimiento se mueve de la tabla al compilador, que es donde ya vive todo lo demás.

**El reparto de paquetes no se toca** (§7): `palette` deriva y compila, `theme` guarda lo generado,
`ui` tiene el provider —que bajo la regla 4 por fin puede aplicar la paleta que su preferencia
promete— y los componentes, que consumen las tres capas.
