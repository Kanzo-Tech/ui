# El tema es un documento plano — refundación de la capa de color

Escrita 2026-08-21, a petición del dueño: *«nuestro sistema de paletas es bastante complicado,
tengo la sensación de que Daisy UI lo resuelve de manera MUCHO más elegante»*. Continúa
`.planning/COLOUR-REVIEW.md` (2026-08-01), que entró por el mismo malestar y respondió
*profundizando* el pipeline. Esta responde cortándolo.

Rama: `ds-theme-daisy`.

---

## 0. Lo decidido antes de escribir

Tres preguntas, tres respuestas del dueño, y el resto de este documento las desarrolla.

1. **Estructura de Daisy, nombres de Shark.** `--background` / `--foreground` / `--muted` /
   `--destructive` / `--card` / `--popover` siguen escribiéndose así. No adoptamos
   `--color-base-100`. `match-the-reference` y `shark-parity.test.ts` siguen vivos y las recetas
   venidas de Shark siguen compilando.
2. **Paridad Daisy total en la derivación.** `@kanzo-tech/palette` se borra entero. Un tema son
   valores escritos a mano. Sin rampas, sin medición de contraste en la derivación, sin búsqueda de
   separación categórica. **El autor responde de AA.** (§8 dice qué cuesta esto y qué propongo
   devolver por muy poco; es tuyo tacharlo.)
3. **La rama se abre ya.** Hecho. El árbol sucio de las sesiones paralelas viajó con ella.

---

## 1. Lo medido

Todo re-derivable. Los comandos están en `.planning/` no porque haga falta creerlos, sino porque
un número en prosa se pudre.

**El pipeline actual**

| | LOC fuente | LOC test |
|---|---|---|
| `packages/palette/src` | 4 717 | 3 377 |
| `packages/theme/src` | 1 043 | 1 247 |

`packages/theme/tokens.css` declara **408** propiedades personalizadas, de las cuales **191** son
utilidades `--color-*`. Cada documento de paleta compilado (`palettes/nord.css` y sus cinco
hermanos) publica **199** propiedades.

**Cuántas se usan.** Barriendo `packages/{ui,ai,graph}/src` — 160 ficheros, 1,2 MB de fuente —
buscando cada nombre como utilidad (`bg-`, `text-`, `border-`, `ring-`, `fill-`…) o como
`var(--nombre)`:

- **126 de las 191 utilidades de color no las usa ningún componente.**
- El *reference tier* publica **144** escalones (6 familias × 12 sólidos × 12 alfa). **Se usan 18.**
- **Los 18 son alfa** — `a3`, `a4`, `a5`, `a6`, `a8`. **Ni un solo escalón sólido (1–12) aparece en
  el barrido.** El barrido son los tres paquetes; `docs/` no está dentro y no lo he mirado.
- Los 47 nombres de rol y de chart se usan todos.

Ese es el hallazgo que autoriza el corte. Ocho mil líneas de derivación existen para que
`--destructive-a4` tenga un nombre, y `--destructive-a4` aparece seis veces.

**Lo que un tenant NO puede tocar hoy.** En 115 ficheros de componente: 169 `rounded-*`,
53 `shadow-*`, 229 `h-N`/`size-N`, 125 `border`, 152 `text-{xs,sm,base}`. El radio y la densidad
sí son knobs (`--radius`, y el `rem` contra la raíz que fija la densidad); **el grosor del trazo,
la elevación y la textura no existen como knob en ninguna parte.** Un cliente puede cambiarnos los
colores y nada más de la forma.

**Daisy 5.7.20**, leído del CSS publicado, no de la documentación:

- Un tema son **20 colores + 8 knobs + `color-scheme` = 29 declaraciones**. 35 temas de fábrica.
- `--depth` aparece en **31** declaraciones distintas, `--border` en 63, `--radius-field` en 37,
  `--size-field` en 18, `--noise` en 4.
- Hay **1 121** `color-mix(in oklab, …)` en la hoja.

---

## 2. Qué hace Daisy que es elegante — cinco mecanismos

No es «menos colores». Son cinco cosas, y las cinco son adoptables por separado.

**(a) Un efecto es un número, no una rama.** `--depth: 0 | 1` y `--noise: 0 | 1` no encienden nada:
se multiplican dentro de un `calc()` que ya está escrito.

```css
--btn-shadow: 0 3px 2px -2px color-mix(in oklab, var(--btn-bg) calc(var(--depth) * 30%), #0000);
--btn-inset:  0 .5px 0 .5px oklch(100% 0 0 / calc(var(--depth) * 6%));
text-shadow:  0 .5px oklch(100% 0 0 / calc(var(--depth) * .15));
background-size: auto, calc(var(--noise) * 100%);
```

Con `--depth: 0` la sombra es transparente y el inset no existe. Con `1`, el botón tiene relieve.
**Un mismo CSS produce flat design y skeuomorfismo sin una sola condicional**, y el knob es un
número que un tenant escribe.

**(b) Los estados se derivan en uso, no se precomputan.** El borde de un botón es su fondo
oscurecido un 5 % × depth. No hay un token `--primary-border`. Es lo que sustituye a nuestras
rampas de 12 pasos.

**(c) Una variante son dos asignaciones.** Esto, entero, es el botón primario de Daisy:

```css
.btn-primary{--btn-color:var(--color-primary);--btn-fg:var(--color-primary-content);--btn-soft-bg:initial}
```

(Verbatim del CSS publicado. Dos asignaciones y un reset.)

Todo lo demás — fondo, borde, sombra, inset, text-shadow, ruido, radio, altura — está escrito una
vez en `.btn` y derivado de esos dos. Nuestro `buttonVariants` tiene seis variantes de cinco a seis
utilidades cada una, cada una nombrando tokens distintos.

**(d) Una escala es un knob multiplicado.** `--size:calc(var(--size-field) * 10)`. Esto ya lo
hacemos con el radio (`--radius-lg: calc(var(--radius) * 1)`) y es exactamente por lo que ese eje sí
funciona.

**(e) El documento es plano y se escribe a mano.** Sin build, sin derivación, sin paso de
autoría. Es lo que hace posible el theme generator, y es el corazón de la petición.

**Lo que Daisy NO resuelve, y conviene no importar el hueco:** tipografía. No hay variable de fuente
en el tema; la documentación remite a `--font-sans` de Tailwind o a meter un `font-family:` crudo en
el bloque. `trends.daisyui.com` **no es una demo de las primitivas** — es un catálogo editorial de
41 imágenes estáticas, con las tipografías *sugeridas en prosa* y un servidor MCP que escribe el
tema. Nosotros ya vamos por delante ahí: `--font-sans`, `--font-heading` y `--font-mono` son ejes
desde hace tiempo, y `--font-heading` separado del `--font-sans` es justo la elección que más
identidad carga (el serif del ejemplo «Millennial Beige»). Lo único que falta es que vivan **en el
documento**, no sólo en la preferencia del usuario.

---

## 3. La pieza que decide el diseño: un tema es UN modo

Esto es lo que hay que entender antes que nada, porque sin ello el refactor choca de frente con un
guard que tiene razón.

`packages/ui/src/alpha-steps.test.ts` **prohíbe `bg-token/NN`**, y su argumento está medido:

> *una fracción cae en un escalón distinto en cada modo.* `/4` es a3 en claro y a2 en oscuro, `/10`
> a4 y a3, `/20` a5 y a4, `/32` a6 y a5. No es redondeo: `CHROMA_PROFILE.dark` es deliberadamente
> más gruesa por abajo, así que un tinte tiene que trabajar más contra un fondo oscuro.

Es decir: **el mecanismo central de Daisy — diluir con un porcentaje — es exactamente lo que este
repositorio midió y prohibió.** Si copiamos Daisy sin más, reintroducimos el defecto.

La salida no es un compromiso. Es que **la objeción es condicional**: sólo muerde si *un* documento
tiene que servir *dos* modos. Y Daisy no tiene ese problema porque **un tema de Daisy es un solo
modo**. Verificado en el CSS publicado: dos bloques planos, `[data-theme=light]` y `[data-theme=dark]`,
sin `@media (prefers-color-scheme)` en el bundle, sin documento compartido, sin `.dark` que voltee
tokens. Claro y oscuro son dos temas distintos, cada uno con sus colores escritos.

**Adoptamos eso.** Y al hacerlo:

- El porcentaje deja de ser ambiguo, porque no hay un segundo modo donde equivocarse. La premisa
  del guard desaparece; el guard se retira **con su razón escrita**, no en silencio.
- `.dark` deja de ser un selector que voltea tokens. Lo que sobrevive es `color-scheme` dentro de
  cada bloque, para los controles nativos.
- **`decisions/a-palette-is-chosen-per-appearance.md` (open, 2026-08-16) se cierra por
  implementación directa, no por innecesaria.** Esa decisión inventaba un mapa
  `paletteByAppearance` para que un usuario pudiera querer paletas distintas en claro y en oscuro.
  Si un tema *es* un modo, esa preferencia deja de ser un mapa y pasa a ser **dos elecciones** —
  qué tema llevo en claro, qué tema llevo en oscuro — que es exactamente lo que el panel enseña
  como dos rejillas de tarjetas. El mapa era la forma retorcida de decir esto desde el otro lado.
- El límite de tres niveles de alternancia documentado en `styles.css` (`dark → light → dark` no
  resuelve los descendientes, «Radix y daisyUI tienen la misma cota») **desaparece**: una preview
  con ámbito es `[data-theme=x]` en un `div`, y eso sí anida sin límite.
- `data-palette` + `data-identity` + `.dark` colapsan en **`data-theme`**.

Coste, dicho entero: los seis documentos actuales llevan los dos modos dentro y se convierten en
**doce temas**. Los colores de la mitad oscura ya están derivados y medidos — se extraen del CSS
compilado de hoy, no se re-inventan. Es un script de una vez, no trabajo a mano.

---

## 4. El documento

**Un tema es un bloque de CSS y nada más.** Sin build, sin JSON, sin JS, sin paso de derivación:
un selector, unas declaraciones, se acabó. Es la respuesta a *«la gracia es que los temas se
definen de manera declarativa usando CSS, ¿no?»* — sí, y es de ahí de donde sale todo lo demás.
Un tema se escribe a mano, se pega desde otro sitio, se lee en una revisión de código y se
diferencia en un `git diff` línea a línea. Nada de eso es cierto hoy, porque hoy un tema es la
salida de trece etapas.

```css
[data-theme="bank-dark"] {
  color-scheme: dark;
  --background: #0c1017;  --foreground: #f9fafb;
  --primary: #6299a9;     --primary-foreground: #001016;
  /* … 17 colores más … */
  --radius-box: .75rem;   --radius-field: .5rem;  --radius-selector: .25rem;
  --size-field: .25rem;   --stroke: 1px;          --depth: 0;
  --font-heading: "Lora", serif;
}
```

### La regla que gobierna el resto: usar, no duplicar

**Un nombre nuevo se gana sólo si un tema le daría plausiblemente un valor distinto del token del
que sale. Si no, no es un nombre: es un uso.**

Es la generalización de `decisions/a-role-earns-its-name-or-becomes-a-step.md`, que ya mató
diecisiete roles del núcleo por ser «una segunda ortografía de un valor». Aquella regla se aplicó
al reference tier; **esta se aplica a todo, secciones incluidas**, y es lo que evita que el sistema
vuelva a tener dos vocabularios para los mismos colores.

Las tres consecuencias, y hay que aceptar las tres o ninguna:

- **Los 21 son los únicos que llevan valor.** Todo lo demás sale de ellos. Un token que lleva un
  hex propio es un duplicado por construcción.
- **Un default es un `var()`, no una copia.** `--card: var(--background)` *usa*; escribir el mismo
  hex dos veces *duplica*. La diferencia se ve al cambiar el tema: lo primero sigue, lo segundo se
  queda atrás.
- **Sobreescribir es opt-in y significa algo.** Un tema declara `--card` sólo cuando quiere la
  tarjeta despegada de la página. Si no lo declara, no es que herede por descuido: es que en ese
  tema la tarjeta *es* la página, y lo dice no diciéndolo.

`--card` pasa el examen porque muchos temas de verdad lo quieren distinto de `--background` — Daisy
separa `base-100` de `base-200` en casi todos los suyos. `--vignette` del grafo no lo pasa, y §4-ter
dice por qué.


Tres clases de valor, y la distinción es de Daisy (`var(--btn-color, var(--color-base-200))`)
aplicada al nivel del tema.

### Autorado y obligatorio — 21

Ver §4a para el mapeo completo contra los de Daisy, uno a uno.


### Derivado por defecto, sobreescribible — 0 de coste

Existen como nombre, valen algo razonable, y un tema los toca sólo si quiere. Cada uno es un alias
o un `color-mix`:

```
--card --popover        → var(--background)
--card-foreground …     → var(--foreground)
--field --faint         → color-mix del --muted sobre --background
--input                 → la línea, del --foreground al X%
--sidebar + sus 7       → var(--card) y compañía
--destructive-foreground / --info-foreground / …   ← Shark: variante legible EN PÁGINA, no tinta sobre relleno
```

Ocho tokens de sidebar que Shark envía y que hoy autoramos: pasan a costar cero. Esto es lo que
permite bajar de 199 a ~21 sin perder ni un nombre del vocabulario de Shark.

### Autorado y opcional

- `--chart-1..8` — los ocho slots categóricos. Un tema que los omite hereda un set por defecto.
  Un tema que **declina** el canal categórico (monocromo) lo dice explícitamente, que es lo que
  `decisions/monochrome-is-a-palette-not-a-look.md` ya exige.
- `--syntax-*` — los siete del editor.

**Trabajo real que esto crea, dicho ahora:** 8 slots × 12 temas = 96 colores categóricos elegidos a
mano, más 7 × 12 de sintaxis. Antes los buscaba `derive-scheme.ts` con una búsqueda de separación.
Ahora los elige una persona. Es la parte más cara de la opción 2 y no se ve hasta que se hace.

### Los knobs

| Knob | Valor | Sustituye a |
|---|---|---|
| `--radius-box` | card, dialog, alert | el `--radius` único |
| `--radius-field` | button, input, select, tab | idem |
| `--radius-selector` | checkbox, switch, badge | idem |
| `--size-field` | unidad de altura de control | los 229 `h-N` |
| `--size-selector` | unidad de checkbox/switch | idem |
| `--stroke` | grosor de línea | los 125 `border` |
| `--depth` | 0–1, relieve | los 53 `shadow-*` |
| `--noise` | 0–1, textura | nada, es nuevo |
| `--font-sans` `--font-heading` `--font-mono` | las pilas | el eje `data-font`, que sube al documento |

Dos notas.

**El radio pasa de 1 knob a 3, y es una mejora real**: hoy es imposible pedir un checkbox
redondeado con una tarjeta cuadrada, porque los dos salen del mismo `--radius`.

**`--size-field` no compite con la densidad, compone con ella.** La densidad fija el `font-size` de
la raíz y por tanto toda la escala `rem`, tipografía incluida. `--size-field` se expresa *en* `rem`
y escala sólo el control. Un tenant puede pedir controles compactos con texto normal, que hoy no se
puede. Son ortogonales y las dos se ganan el sitio. Daisy no tiene densidad; ahí seguimos por
delante.

---

## 4a. Los tokens, uno a uno contra los de Daisy

Lo que un tema **autora** — los únicos que llevan valor. Todo lo demás los *usa* (§4, la regla).

### Superficies y tinta — 5

| Daisy | Nosotros | Por qué |
|---|---|---|
| `base-100` | `--background` | La página. |
| `base-200` | `--card` | Daisy numera tres superficies; nosotros nombramos las dos que Shark distingue. |
| `base-300` | `--muted` | La superficie apagada. |
| `base-content` | `--foreground` | |
| — | `--muted-foreground` | **Daisy no lo tiene**: escribe `base-content/60` en cada sitio. Es **nuestro token más usado, 129 veces**, y un tema le da un valor propio siempre. Se gana el nombre con holgura. |

### Marca — 6

| Daisy | Nosotros |
|---|---|
| `primary` / `primary-content` | `--primary` / `--primary-foreground` |
| `secondary` / `secondary-content` | `--secondary` / `--secondary-foreground` |
| `accent` / `accent-content` | `--accent` / `--accent-foreground` |

### Estado — 8

| Daisy | Nosotros | Por qué |
|---|---|---|
| `error` / `error-content` | `--destructive` / `--destructive-content` | Nombre de Shark. `-content` es literalmente la palabra que Daisy usa para «tinta sobre el relleno», y ya la habíamos adoptado. |
| `info` / `info-content` | `--info` / `--info-content` | Idénticos. |
| `success` / `success-content` | `--success` / `--success-content` | Idénticos. |
| `warning` / `warning-content` | `--warning` / `--warning-content` | Idénticos. |

### Líneas — 2

| Daisy | Nosotros | Por qué |
|---|---|---|
| — (deriva de `base-300`) | `--border` | 48 usos. **Ojo con la colisión:** el `--border` de Daisy es el *grosor*. El nuestro es el color, así que el knob de grosor se llama `--stroke`. |
| — (usa `base-content`) | `--ring` | El foco. Divergimos de Shark aquí **por una medición** (anillo sólido contra el diluido suyo), y esa divergencia necesita un token propio. |

**Total autorado: 21.** Daisy son 20. La diferencia entera es un intercambio limpio: **soltamos su
par `neutral` / `neutral-content`** —una superficie oscura de marca para footers y badges que Shark
no tiene y nosotros no usamos— **y a cambio nombramos `--muted-foreground` y `--ring`**, que los
usamos 129 y 44 veces.

### Los que NO se autoran: usan

Existen como nombre, valen un `var()` de los de arriba, y un tema los declara sólo si de verdad los
quiere distintos.

| Nombre | Usa | Se gana el nombre porque |
|---|---|---|
| `--popover` | `var(--card)` | Un overlay puede querer despegarse de una tarjeta. Marginal. |
| `--card-foreground` `--popover-foreground` | `var(--foreground)` | Contrato con Shark; las recetas lo pegan literal. |
| `--input` | `var(--border)` | Un tema puede querer el campo perfilado distinto del borde de una tarjeta. |
| `--field` `--faint` | `color-mix` sobre `--muted` | Superficie de campo y la tinta más callada. |
| `--sidebar` + sus 7 | `var(--card)` y compañía | Shark los envía. Coste cero al no llevar valor. |
| `--destructive-foreground` y sus 3 hermanos | `color-mix(in oklab, var(--X) 78%, var(--foreground))` | La variante *legible en página* de la misma familia — la convención de Shark, que NO es tinta sobre relleno. La mezcla acierta en la mayoría; un tema la sobreescribe donde no lea, y el check de §8 dice cuándo. |

### Los knobs — 9 contra 8

| Daisy | Nosotros | |
|---|---|---|
| `--radius-box` | igual | card, dialog, alert |
| `--radius-field` | igual | button, input, select, tab |
| `--radius-selector` | igual | checkbox, switch, badge |
| `--size-field` | igual | unidad de altura de control |
| `--size-selector` | igual | unidad de checkbox / switch |
| `--border` | **`--stroke`** | renombrado por la colisión de arriba |
| `--depth` | igual | relieve, 0–1 |
| `--noise` | igual | textura, 0–1 — **fuera del primer corte** (§9) |
| — | `--font-sans` `--font-heading` `--font-mono` | **Daisy no tiene fuentes en el tema.** Nosotros ya las teníamos como eje; aquí bajan al documento. |

### `color-scheme`, que no es un token nuestro

Es la **única declaración nativa** del bloque, y no la inventamos ni Daisy ni nosotros: es CSS
estándar y es lo que le dice al navegador de qué lado pintar todo lo que la página **no** estiliza
— la barra de scroll, el `<select>` desplegado, el date picker nativo, el cursor de texto, el
fondo del canvas antes de que pinte nada. Sin ella, un tema oscuro sale con la barra de scroll
blanca y el calendario nativo en blanco.

Ya está en nuestros documentos (`palettes/nord.css`, primera línea del bloque) y con su razón
escrita en `tokens.css`: **va como declaración dentro de una regla, nunca como
`documentElement.style.colorScheme`**, porque una declaración en línea gana a toda regla de forma
permanente y no hay manera de retirarla.

Y es lo que hace literal el «un tema es un modo» de §3: el tema *declara* de qué lado es, y el
cromo del navegador le sigue. Por eso la cuento entre las 32 — un tema no está completo sin ella.

### Y el recuento honesto

| | Daisy | Nosotros |
|---|---|---|
| Colores autorados | 20 | **21** |
| Knobs de forma | 8 | 7 (+`--noise` aplazado) |
| Fuentes | 0 | **3** |
| `color-scheme` | 1 | 1 |
| **Declaraciones por tema** | **29** | **32** |
| Opcionales | 0 | 8 chart + 7 sintaxis |
| Props publicadas hoy | — | 199 |

**32 contra las 199 de hoy.** Y la comparación que importa no es 32 contra 29 — es que las 32 se
escriben a mano en un bloque de CSS, y las 199 son la salida de trece etapas.

---

## 4-bis. El panel de preferencias se queda, y mejora

**Nada de esto retira el selector.** Lo que colapsa en §3 son los *atributos*
(`data-palette` + `data-identity` + `.dark` → `data-theme`), no el control que los escribe. El
panel no se puede quitar por una razón que no es de color: es donde viven las credenciales y lo
demás que un producto tiene que configurar. Sigue siendo `Preferences`, sigue siendo una sección
del core bajo el namespace `theme`, y sigue resolviendo por la misma cadena.

Lo que gana, y son cuatro cosas concretas:

1. **Dos rejillas, no un mapa.** Un tema es un modo, así que el panel enseña *qué tema llevo en
   claro* y *qué tema llevo en oscuro*. Es la decisión abierta de §3, dibujada.
2. **La tarjeta entera es el control.** `RadioGroupCard` ya es un `ArkRadioGroup.Item`, así que la
   semántica de radio ya cubre la tarjeta completa — **verificar antes de tocar** si lo que rompe
   el click es la celda de preview de dentro, y arreglar eso, no la tarjeta.
3. **El activo es un `Badge` en la esquina superior.** El componente existe y es el que toca; hoy
   el estado seleccionado se lee sólo del borde y del relleno.
4. **La previsualización es lo fundamental y se refuerza.** Ya está bien planteada: cada celda se
   dibuja **a sí misma** —una miniatura de la interfaz, no una lista de hexes— y el hover viste el
   tema entero como hacen VS Code y Zed. Con temas de un modo eso se simplifica: la celda pone
   `data-theme` en un `div` y ya está. Desaparece el caso raro del tema por defecto sin atributo, y
   desaparece el límite de tres niveles de alternancia.

**El catálogo de partida:** los 35 temas de Daisy, traducidos a nuestros nombres. Son 21 colores
cada uno y ya están escritos; nos dan un catálogo real contra el que probar el panel el primer día,
en vez de seis documentos. Los nuestros conviven con ellos — un tema es un bloque, no un privilegio.

---

## 4-ter. El grafo, con el mismo patrón

El grafo **ya hace lo que pides**, y conviene saberlo antes de rediseñarlo. `GRAPH_SECTION`
(`packages/graph/src/section.ts`) declara sus tokens bajo el namespace `graph` con los defaults
escritos como **bindings redirigibles**, no como hexes:

```ts
marquee:       { kind: "alpha", ramp: "brand", step: 5 }
"marquee-edge":{ kind: "role",  token: "--primary" }
vignette:      { kind: "role",  token: "--background" }
grid:          { kind: "role",  token: "--border" }
```

Eso es exactamente «reutilizar los colores», y con la capacidad añadida de que un documento los
redirija. Junto a ellos van dieciséis preferencias no-color — la capa de aristas, la rejilla de
puntos y los seis coeficientes de fuerza — que son el «resto de variables configurables».
`css-color.ts` resuelve cualquiera de ellos a floats de GPU con `resolveTokenColor`, la del
propio repositorio, contra el elemento donde vive el canvas (para que un tema con ámbito gane).

**Qué le rompe el corte.** `SectionBinding` tiene tres `kind`: `step`, `alpha` y `role`. Los dos
primeros apuntan al reference tier, que muere — `{ ramp: "brand", step: 5 }` se queda sin referente.
La reparación es el mismo movimiento que todo el refactor: **un default deja de ser un objeto con
tres formas y pasa a ser una cadena de CSS.** Tres `kind` colapsan en cero. Y el tipo está
**declarado estructuralmente dos veces** —en `packages/theme/src/sections.ts` y a mano en el grafo,
para no crear una dependencia—, así que borrarlo quita dos declaraciones y su riesgo de divergencia.

**Y aquí es donde muerde la regla de §4.** Pasando los cinco tokens de color del grafo por el
examen *¿le daría un tema un valor distinto del token del que sale?*:

| Token | Default | ¿Se gana el nombre? |
|---|---|---|
| `vignette` | `--background` | **No.** El viñeteado se desvanece *hacia la página*; cualquier otro valor lo rompe. Nunca puede diferir. **Muere, y el canvas usa `--background`.** |
| `marquee` | brand a5 | **No.** Es una dilución de `--primary`, es decir una *derivación*, no un nombre. Se escribe `color-mix` donde se dibuja. |
| `marquee-edge` | `--primary` | **No.** El contorno de una selección *es* la marca. Un tema que lo quisiera distinto estaría diciendo que su marca no es su marca. |
| `point-ring-hover` | `--primary` | **No.** Igual, y además duplica al anterior: dos nombres para «la marca, sólida». |
| `grid` | `--border` | **Discutible, y por eso es el único que dejo abierto.** La rejilla de puntos es decorativa y a otro peso que un borde; puede que un tema la quiera más tenue. Si no aparece un tema que la quiera distinta, también muere. |

Cuatro de cinco son usos disfrazados de nombres. Lo que se pierde al borrarlos es la capacidad de
que un tenant los redirija — y esa capacidad, medida contra el examen, no la quiere nadie: redirigir
`vignette` es romperlo. **Lo que el grafo conserva es lo que sí es suyo:** el esquema categórico de
8 slots, el canal de forma, y las dieciséis preferencias no-color.

Esto es lo que pedías con «no sobreescribir, usar»: el grafo deja de tener vocabulario de color
propio y pasa a leer el del tema. Un vocabulario, no dos.

**Lo que sí falta, y es la mitad no tomada en el core también.** Hoy las dieciséis preferencias
no-color del grafo sólo las mueve un *usuario*. La misma frase que `CORE_PREFS` ya escribió sobre el radio, la
densidad y las fuentes vale aquí: **un documento de tema debe poder fijarlas**. Un cliente que
quiere su grafo con aristas finas y poca fuerza no debería necesitar que cada usuario lo
configure — lo declara en su tema, junto a sus colores. La política por namespace (`pinned` /
`hidden`) ya existe y es el mecanismo; lo que falta es que el documento sea un origen más de la
cadena para las secciones, no sólo para el core.

Lo que **no** cambia: `decisions/a-look-is-form-and-a-channel-is-a-binding.md` y
`a-graph-look-is-form-not-colour`. Un `Look` sigue siendo geometría, el color sigue viniendo del
esquema categórico del tema, y el canal de forma sigue teniendo capacidad 4+1 contra los 8 slots
de color. Este refactor no toca esa división — sólo cambia de dónde salen los 8 slots (§4: de una
búsqueda a una elección).

---

## 5. La receta

La segunda mitad del refactor, y la más cara en ficheros tocados. El patrón, en los tres pasos que
Daisy usa:

1. La base declara sus locales y **deriva de ellos todos los estados**.
2. Una variante **sólo reasigna locales**.
3. Nada de utilidades de color en las variantes.

Nuestro `Button` de hoy, resumido: seis variantes, cada una con `bg-*`, `text-*`, `border-*`,
`hover:bg-*`, `focus-visible:*`, nombrando ocho tokens distintos entre todas. El destino:

```ts
variant: {
  default:     "[--btn-bg:var(--primary)]     [--btn-fg:var(--primary-foreground)]",
  destructive: "[--btn-bg:var(--destructive)] [--btn-fg:var(--destructive-content)]",
  outline:     "[--btn-bg:transparent]        [--btn-fg:var(--foreground)]",
  …
}
```

…y el hover, el borde, la sombra y el inset escritos **una vez** en la base, derivados de
`--btn-bg` con `color-mix` y multiplicados por `--depth`.

**Dónde vive la base.** Las expresiones `color-mix` y `calc` son ilegibles como clases arbitrarias
de Tailwind. `packages/ui/src/styles.css` existe y hoy son 114 líneas de imports. La base de cada
receta baja ahí como CSS real, en una capa en cascada, y `tailwind-variants` se queda con lo que
sabe hacer bien: asignar locales y elegir tamaños. Esto **no** es volver a hojas de estilo a mano —
es la misma división que Daisy tiene y la razón de que su variante quepa en una línea.

---

## 6. Qué muere

- `@kanzo-tech/palette` entero — 4 717 + 3 377 líneas. Con él `ramp.ts`, `derive-scheme.ts`,
  `derive-palette.ts`, `roles.ts`, `derive-syntax.ts`, `palette-check.ts`, `compile.ts`.
- El *reference tier*: los 144 escalones, y las 18 utilidades alfa que se usaban pasan a `color-mix`.
- `scripts/gen-palette.mjs`, `palette-data.json`, y la mitad de color de `check:generated`.
- `data-palette`, `data-identity`, `paletteByAppearance`, `identityByPalette` → `data-theme`.
- `.dark` como selector que voltea tokens.
- `decisions/palette-is-authoring-time.md` — su premisa era que derivar es caro. Ya no se deriva.
- `packages/theme/src/palettes.test.ts` y `boundary.test.ts` — el primero mide rampas que no
  existirán, el segundo vigila una dependencia que se borra.
- `packages/ui/src/alpha-steps.test.ts` — §3. Se retira con su razón escrita, no en silencio.

**Sin alias, sin shim, sin ruta de migración.** Constraint 1.

---

## 7. Qué se rompe, y en qué orden

El orden importa porque `docs/` consume `dist/` y un rename typechequea limpio mientras el build de
docs falla.

1. **`packages/theme`** — el tipo de documento, los doce temas extraídos del CSS de hoy, los knobs,
   `themes.css`. Sin tocar componentes. `pnpm build` verde aquí antes de seguir.
2. **`packages/ui/src/styles.css`** — las bases de receta como CSS real, y las capas.
3. **Los componentes, por familia** — botón y sus parientes primero, porque es donde el patrón se
   valida o se cae. 115 ficheros, pero la mayoría toca dos o tres utilidades.
4. **Los guards** — `alpha-steps` se retira, `no-literal-hues` pierde su import de
   `@kanzo-tech/palette` (`oklch`, `CHROMA_FLOOR`) y necesita otra fuente para el suelo de croma,
   `documented-tokens` se re-apunta.
5. **`packages/graph` y `/analytics`** — los 8 slots dejan de derivarse.
6. **`docs/`** — la página de theming se reescribe entera, y aquí está el premio: **el theme
   generator se vuelve escribible**, porque un tema pasa a ser 29 números.
7. **Los showcases** — el dueño ya lo anticipó. Con `data-theme` en un `div` y sin el límite de tres
   niveles, una galería de doce temas en una página deja de ser un caso especial.

---

## 7-bis. Docs y showcases: el «trends» nuestro

Hay que reescribirlos, y es la parte que mejor demuestra el refactor.

**Qué se retira.** `docs/showcases/palette-onboarding/` y `docs/content/docs/showcases/palette.mdx`
enseñan *cómo se derivaba una paleta a partir de dos seeds*. Con la derivación borrada, ese
showcase no describe nada que exista. `docs/content/docs/(root)/theming.mdx` se reescribe entera,
y con ella `styling.mdx` y `onboarding.mdx`.

**Qué lo sustituye — y por qué el nuestro puede ser mejor que el de Daisy.** `trends.daisyui.com`
es un catálogo editorial: 41 **imágenes estáticas**, moodboards, tipografías sugeridas en prosa y un
MCP que escribe el tema. No demuestra las primitivas — las ilustra con capturas.

El nuestro puede ser **en vivo**, y esa es exactamente la capacidad que compra este refactor:

> **Una pantalla, doce aspectos, cero forks.** El mismo showcase renderizado N veces, cada copia
> dentro de un `div` con su `data-theme`, todo en la misma página y todo real — no capturas.

Sólo es posible por dos cosas de este diseño: que un tema es **un bloque de CSS** (así que
aplicarlo es un atributo, no una carga) y que un tema es **un modo** (así que se anida sin el
límite de tres niveles que hoy documenta `styles.css`). Hoy, con documentos de dos modos y el
límite, esta página no se puede escribir.

**La forma concreta, tres piezas:**

1. **La galería** — reemplaza a `palette-onboarding`. Una rejilla donde cada celda es el *mismo*
   fragmento de interfaz bajo un tema distinto. Los 35 de Daisy traducidos dan un catálogo de
   verdad desde el primer día. Hover para vestirlo, click para llevártelo.
2. **El generador** — la página de `theming.mdx`, escribible por primera vez: los knobs de §4a como
   controles, la preview al lado, y el bloque de CSS resultante para copiar. Es el equivalente
   nuestro del theme generator, y sale casi gratis porque un tema son 32 declaraciones.
3. **Los showcases que ya existen no se tocan en su contenido** — `workspace`, `metadata-form`,
   `field-notes`, `discovery`, `job-studio`, `app-shell`, `settings`. Se les cambia el marco: cada
   uno gana un selector de tema, y **son ellos** los especímenes de la galería. Un showcase que
   aguanta doce temas sin retoques es la prueba de que la capa funciona; uno que no, es un bug que
   sólo esta página encuentra.

`preferences/` y `graph-bench/` sí cambian por dentro, por §4-bis y §4-ter.

---

## 8. Lo que se pierde con la opción 2, dicho claro

La opción elegida borra la medición. Esto es lo que la medición encontró la última vez, y está
escrito en el comentario de cabecera de `tokens.css`: la tinta sobre relleno era un `text-white`
literal, y medida daba **2,13:1 en warning, 2,47 en success, 3,76 en info y 3,81 en destructive**,
contra el 4,5 que pide AA. *No había token, así que no había nada que medir, y no habiendo nada que
medir no había test que fallara.*

Con temas escritos a mano, ese fallo vuelve a ser posible. Es tu decisión y la respeto.

**Lo que propongo devolver, y es distinto de lo que borramos:** un **check**, no una derivación.
Un test que lee los doce temas enviados y mide cada par relleno/tinta contra AA. No necesita rampas,
ni búsqueda, ni el paquete `palette` — necesita una función de contraste, que son unas cincuenta
líneas. La diferencia práctica: «el autor responde de AA» pasa a ser «el autor responde de AA **y se
entera cuando se equivoca**». Es aditivo respecto a lo decidido y es tuyo tacharlo.

Lo mismo, más barato aún, para el set categórico: un test que mide la separación mínima entre los
ocho slots de cada tema. Sin la búsqueda — sólo la comprobación de que lo elegido a mano separa.

---

## 9. Lo que este documento no resuelve

- **El suelo de croma.** `no-literal-hues.test.ts` importa `CHROMA_FLOOR` de `@kanzo-tech/palette`
  para distinguir un literal acromático (legal) de uno cromático (prohibido). Al borrar el paquete
  hay que decidir dónde vive esa constante. Es pequeño y no bloquea, pero no está resuelto.
- **Los 96 colores categóricos** de §4 no están elegidos, y elegirlos es trabajo de diseño, no de
  refactor.
- **Si `--noise` se gana el sitio.** Es el único knob nuevo que no sustituye a nada nuestro. Daisy
  lo usa en 4 declaraciones. Contra la constraint 2, entra sólo si alguien lo pide; lo dejo
  nombrado y fuera del primer corte.
- **La densidad y sus obligaciones.** `decisions/density-has-no-legibility-floor.md` está `live` con
  la barra de WCAG 2.5.8 **en rojo**. Este refactor no la toca y no la arregla; `--size-field`
  cambia dónde se escribe la altura, no cuánto mide.

---

## 10. Paso 1, hecho — y las dos cosas que sólo se vieron al hacerlo

`packages/theme` está migrado. **16 temas** (6 paletas × 2 modos, + la identidad `private` del banco,
+ el tenant por defecto), cada uno un bloque plano de ~55 declaraciones bajo `[data-theme=…]`, con
su `color-scheme` dentro. `pnpm build` verde en `theme` y en `ui`. De los tests de `theme`, **61
pasan y 6 fallan, en exactamente los dos ficheros que §6 marca para borrar** — `palettes.test.ts` y
`boundary.test.ts`. Ningún rojo inesperado.

El paso cambió la **forma y no los píxeles**, que es lo que lo hace verificable:
`scripts/extract-themes.mjs` copió los colores que ya se enviaban, y además **asserta** que los 8
nombres que suelta son alias en los 16 bloques y se niega a correr si alguno difiere. Los 8 son
`--card-foreground`, `--popover-foreground` y seis de los ocho de sidebar: 96 declaraciones
escribiendo un valor ya escrito. **Los nombres viven; lo que murió es autorarlos.**

### La trampa: una propiedad derivada hereda ya sustituida

`:root { --sidebar-primary: var(--primary) }` parece equivalente a poner el puente en `@theme
inline` y **no lo es**. Una propiedad personalizada hereda su valor **computado**: se resuelve una
vez, en `<html>`, contra el `--primary` de ese elemento. Un preview con ámbito —`<div
data-theme="dracula">`— define un `--primary` nuevo en el div, pero `--sidebar-primary` ya estaba
sustituida arriba y **hereda el valor viejo**. El div pintaría la marca de Dracula con el sidebar
de Nord, en silencio y sin error de compilación.

La salida es `@theme inline`: Tailwind mete el valor dentro de la **utilidad**, así que
`bg-sidebar-primary` compila a `background-color: var(--primary)` y el `var()` se resuelve en el
elemento que lleva la clase. Por eso **todo el vocabulario se puentea y nada se re-declara**, y por
eso la escala de radios cuelga de `--radius-field` directamente en vez de un `--radius` intermedio
— caí en la misma trampa escribiéndolo y la corregí.

**Medido en Chrome sobre el CSS compilado**, que es la única manera de saberlo:

| Sonda | Resultado |
|---|---|
| `bg-primary` en la raíz (kanzo) | `rgb(15,15,15)` |
| `bg-primary` dentro de `[data-theme=dracula]` | `rgb(229,98,175)` — **difiere** |
| `bg-sidebar-primary` en ese mismo ámbito | `rgb(229,98,175)` — **idéntico al anterior** |
| `bg-sidebar-primary` en `[data-theme=nord-dark]` | `rgb(103,158,174)` |
| `bg-sidebar-primary` en `monochrome` anidado dentro de `nord-dark` | `rgb(15,15,15)` |

La última fila es la que cierra §3: **tres niveles de anidamiento resuelven bien**, así que el
límite que `styles.css` documenta desaparece de verdad y la galería de §7-bis se puede escribir.

### `.dark` se degrada a marcador de variante

Un tema es un modo y lleva sus colores, así que `.dark` ya no voltea ningún token. Le queda **un
solo trabajo**: seleccionar la variante `dark:` en los **55 sitios** que todavía la piden. Casi
todos existen porque un token tenía que servir a dos modos y la receta parcheaba la diferencia
(`dark:bg-field` es el tipo), y cada uno se vuelve borrable cuando se revisa su componente, porque
ahora el tema lo dice directamente. La variante se queda hasta que se vayan: borrarla primero los
tiraría a todos en silencio.

---

## 11. Paso 2, hecho — el botón valida el patrón

Las bases de receta bajan a `packages/ui/src/styles.css` como CSS real, en `@layer components`,
enganchadas a `data-slot` (que ya existe y ya está guardado). El botón es el primero.

**Una variante es ahora tres asignaciones y nada más:**

```ts
default:     "[--btn-bg:var(--primary)]     [--btn-fg:var(--primary-foreground)]"
destructive: "[--btn-bg:var(--destructive)] [--btn-fg:var(--destructive-content)]"
outline:     "[--btn-bg:transparent] [--btn-fg:var(--foreground)] [--btn-bd:var(--input)]"
```

El relleno, la tinta, el canto, la elevación, el hover, el active y la altura se escriben **una
vez**, en términos de esos tres. Seis hovers pasan a ser uno.

### Mezclamos hacia `--foreground`, no hacia `black` — y es mejor que la referencia

Daisy oscurece con `color-mix(in oklab, var(--btn-bg), #000 5%)`. Dos problemas: mete literales de
color en una hoja que no tiene ninguno, y —el de verdad— **`black` sólo es «más oscuro» en un tema
claro.** En uno oscuro, el hover de un botón pálido debe ir hacia el blanco, y un `#000` fijo lo
mueve al revés.

Mezclando hacia `var(--foreground)` una sola fórmula significa «aleja este relleno de la página y
acércalo a la tinta», y eso es correcto en ambos modos porque el foreground ya cambia de lado. Es
también por lo que `--depth` puede ser un solo número: la dirección ya es correcta, el knob sólo
dice cuánto. Divergencia de la referencia **por una razón**, que es la cláusula de
`a-measurement-overrules-the-reference`.

### Medido en el navegador

| | |
|---|---|
| Alturas `sm/md/lg/xl` | **28 / 32 / 36 / 40 px** — idénticas a los `h-7/8/9/10` que sustituyen |
| `kanzo` default | `rgb(15,15,15)`, radio 8px, trazo 1px, sombra `oklab(0 0 0 / 0)` |
| `dracula-dark` default | `rgb(224,93,170)` — mismo marcado |
| `nord` default | `rgb(98,153,169)` — mismo marcado |
| Con `--depth:1 --stroke:2px --radius-field:1rem --size-field:.34rem` | trazo **2px**, radio **16px**, alto **43.5px**, sombra **`… / 0.3`** — el color del propio botón al 30 % |

**La fórmula degrada sola en las variantes transparentes**: `outline` a `--depth:1` sale sin sombra,
porque mezclar `transparent` al 30 % sigue siendo transparente. No hizo falta un caso especial, que
es la señal de que la derivación es la correcta. Y el mismo `color-mix` que oscurece un relleno
sólido produce, sobre `transparent`, exactamente el lavado al 10 % que un botón fantasma quiere.

### Los tests, y una buena noticia

`ui`: **564 pasan, 15 fallan en 4 ficheros**, y los 15 tienen la misma causa raíz — leen la forma
vieja del documento (dos modos en un bloque, el reference tier). **Ninguno es una regresión de
componente.**

Y dentro de esos 15 está `simples/status.test.ts`, con diez asserts de la forma *«la tinta de un
punto de estado, medida contra su propio relleno, cumple AA en claro y en oscuro»*. Falla diciendo
`--warning not declared in tokens.css`: es un problema de corpus, no de contraste. **El check de AA
que §8 proponía devolver ya existe** — sólo hay que apuntarlo a `themes/*.css`, y al hacerlo pasa
de medir dos modos de un documento a medir los dieciséis temas.

---

## 12. Paso 3, primera pasada — el barrido completo

Auditados los **102 ficheros con receta** de `ui`, `ai` y `graph`. **47 ya estaban limpios.**

**Lo que NO hay que tocar, y ahorra el mayor bloque de trabajo:** las **94 diluciones `/NN`**. El
guard las prohibía porque *una fracción cae en un escalón distinto en cada modo*; con temas de un
modo esa premisa no existe, así que pasan de prohibidas a ser la ortografía correcta.

**Los 18 `dark:` de color, fuera.** Eran tres patrones y ninguno sobrevive a un tema de un modo:

| Patrón | Sitios | Qué se hizo |
|---|---|---|
| `bg-transparent dark:bg-field` | 9 | `bg-field` a secas. `--field` significa «una superficie que se retira hacia la página» —lo dicen los comentarios de `alert` y `toggle`, que ya lo usaban a pelo— y el input quiere exactamente eso. **Cambio visible: en claro el input gana el lavado de `--field` (4 %) donde antes era transparente.** |
| `text-destructive dark:text-destructive-foreground` | 6 | `text-destructive-foreground` sin rama. Medido en los 8 temas claros: **9.42 contra 4.56**. El `dark:` existía porque un documento servía dos modos; ahora cada tema tiene el suyo. |
| `dark:bg-transparent` en `input-group` | 2 | Cancelaba el `dark:bg-field` del input; sin él, sobra. |

(Un decimonoveno era un falso positivo: en `status.tsx` la coincidencia estaba **dentro de un
comentario** que documenta el override que deliberadamente no tenemos.)

### El hallazgo serio: 51 sitios rotos en silencio desde el paso 1

`alert.tsx` usaba `bg-destructive-a3`, `border-destructive-a6`… — **escalones del reference tier,
que el paso 1 borró.** 17 utilidades distintas en 51 sitios, en 18 ficheros, y **nada falló**: una
utilidad que Tailwind no conoce simplemente no se emite. Ni el build ni los tests lo vieron. Eso es
lo que §6 tenía en una línea («las 18 alfa que se usaban pasan a `color-mix`») y yo no ejecuté.

El reemplazo cae solo: `bg-destructive/7` compila exactamente al `color-mix(… transparent)` que un
escalón alfa era. Los porcentajes salen de medir el canal alfa que cada escalón **llevaba** en los
seis documentos × dos modos, no de inventarlos:

| nivel | alfa medido (min–max) | se fija en |
|---|---|---|
| a3 | 3.9 – 11.8 % | `/7` |
| a4 | 9.4 – 22.0 % | `/14` |
| a5 | 9.0 – 29.8 % | `/17` |
| a6 | 16.9 – 39.2 % | `/30` |

**Un número por NIVEL, no por familia** — un escalón era un nivel. Y el rango de cada uno es
exactamente lo que la opción «paridad Daisy» cambia por un valor fijo: antes la rampa daba un alfa
distinto por documento y por modo, ahora es uno. Cae dentro del rango medido de todas las familias.

### Los guards

| Fichero | Estado |
|---|---|
| `simples/status.test.ts` | **Verde, y ampliado.** Pasa de 10 pares a **5 variantes × 16 temas**, leyendo `themes/*.css` y sacando el modo de `color-scheme`. Es el check de AA de §8, y ya existía. |
| `lib/token-color.test.ts` | Verde. «Los dos modos» pasa a «cada tema publica los 8 slots o ninguno» — declinar el canal es legal, y es lo que `monochrome-is-a-palette-not-a-look` exige poder decir. |
| `documented-tokens.test.ts` | Verde. El suelo baja de 400 a 250 (hoy son 325) y se dice por qué: es un suelo contra un glob vacío, no un registro del recuento. |
| `alpha-steps.test.ts` | **Rojo, y es una decisión, no un arreglo.** Abajo. |

**`ui`: 570 pasan, 5 fallan** — 3 de `alpha-steps` y 2 de `chart-inputs`, que **pasan al ejecutarse
solas**: interferencia de la ejecución en paralelo, no rotura.

### Lo que está bloqueado en `alpha-steps.test.ts`

El fichero **no** es un «ban del anillo de foco», que es como lo citan dos records. Es un guard de
diluciones: prohíbe nuevas y ancla las que se enviaban, agrupadas por razón medida. **Su premisa
murió y su función no**, y qué hacer con él es una decisión:

- **Repinnear** — la lista pasa de 52 a **103** entradas (las 52 de antes + las 61 que convertí).
  Conserva la fuerza, pero anclar 103 spellings es una lista que nadie vuelve a leer.
- **Cambiar la regla** — de «esta dilución exacta está fijada» a «una dilución nombra un token
  registrado, nunca una paleta cruda». Más legible y sobrevive al refactor; es **más débil**.
- **Retirarlo** — pero se lleva por delante las citas de `match-the-reference`,
  `a-measurement-overrules-the-reference`, `a-rule-broken-three-times-becomes-a-test`,
  `CONVENTIONS.md` (dos), `CLAUDE.md` y `shark-parity.divergences.ts`.

No lo decido yo.

### Y una cosa que hice mal, dicha

Dos de mis pasadas con expresión regular barrieron **más de lo que pretendían** — una dejó la mitad
equivocada del par en los sitios donde estaba en una sola línea, y otra convirtió todo
`text-destructive` y no sólo los emparejados. Ambas detectadas revisando el diff y corregidas, pero
el método es frágil en un checkout que **otras sesiones están escribiendo a la vez**: el diff de
`radio-group.tsx` mezcla mis cambios con los de otra sesión. Nada commiteado.

---

## 13. La capa de paletas, borrada

Sin alias, sin shim, sin ruta de migración.

**Borrado:** `packages/palette` entero (4.717 + 3.377 líneas), `packages/theme/palettes/`,
`gen-palette.mjs`, `extract-themes.mjs` (era de un solo uso y ya corrió), `palettes.test.ts`,
`boundary.test.ts`, `alpha-steps.test.ts`, `docs/showcases/palette-onboarding/`,
`docs/content/docs/showcases/palette.mdx`, `docs/lib/palette.ts`, y la dependencia de tres
`package.json`.

**Siete ejes pasan a seis.** `palette` + `identity` + `paletteByAppearance` colapsan en
`themeByAppearance`. Tres tipos (`KanzoPalette`, `KanzoIdentity`, `KanzoIdentityMemory`) pasan a uno
(`KanzoThemeName`); `PaletteOption` pasa a `ThemeOption` **y pierde `children`**, que es lo que hace
que el selector sea una lista y no un árbol. `PrefSource` va de `"palettes" | "identities"` a
`"themes"`. `IdentityNotice` se renombra a `ThemeNotice`.

**Lo que desaparece con la contención, y es el premio:** `setPalette` archivaba la marca que dejabas,
restauraba la que entrabas, se llevaba por clave *resuelta* porque el documento por defecto tenía dos
ortografías, y no debía pisar una marca nombrada en la misma llamada. **Cada una de esas cláusulas
fue un defecto real alguna vez.** `setTheme` es una asignación. La memoria `identityByPalette` que lo
sostenía se fue con ello.

**El preview también adelgaza.** Ya no necesita la clase de apariencia (un documento llevaba dos
bloques y había que forzar el lado), ni un segundo atributo, ni el caso especial del documento por
defecto — que se emitía en `:root` pelado, así que `[data-palette="kanzo"]` no casaba con nada y la
celda heredaba lo que llevase la página. `themes/kanzo.css` responde a `:root` **y** a
`[data-theme="kanzo"]`.

**`CHROMA_FLOOR` y `oklch` bajan a `guard-corpus.ts`** — el hueco que §9 dejaba abierto. Son doce
líneas: sRGB → lineal → OKLab, tres matrices publicadas y una raíz cúbica. Eso es todo lo que un
guard necesitaba de un paquete de ocho mil líneas.

### Un bug real que sólo apareció al ejecutarlo

Nombré la declaración `theme` y el campo almacenado `themeByAppearance`. La cadena resuelve **por
clave**, así que ni el provider ni el script de pre-hidratación escribían `data-theme` — y como los
dos fallaban igual, el test de *acuerdo entre ambos lados* pasaba. Lo que lo cazó fue el assert de
valor, no el de acuerdo. Declaración y campo tienen que llamarse igual.

### Estado

`packages/theme` y `packages/ui`: **build y typecheck limpios**. Tests de `ui`: **535 pasan, 22
fallan en 10 ficheros**, y ninguno es una regresión de componente:

| Qué | Cuántos |
|---|---|
| `Preferences.test.tsx` — cuerpos que ejercitan el modelo de dos mitades | 7 |
| `KanzoTheme.test.tsx` — el themer con ámbito | 6 |
| `documented-tokens`, `documented-exports`, `decisions`, `shark-parity` — prosa y páginas que citan lo borrado | 6 |
| `theme-tick`, `KanzoThemeProvider` | 2 |
| `Questionnaire`, `code-editor-search` — pasan solos, interferencia del runner | 2 |

Y queda **la capa C entera**: `docs/` (layout, provider, las `.mdx` de theming/onboarding/styling),
`CLAUDE.md`, `CONVENTIONS.md`, `README.md`, el changeset, y los records de `decisions/` que hay que
marcar `superseded` en vez de borrar.

---

## 14. El árbol, entero y verde

Los ocho pasos del pipeline, en el orden que manda `CLAUDE.md`:

| paso | |
|---|---|
| `build` · `typecheck` · `lint` · `check:generated` | **OK** |
| `test` | **OK** — 562 `ui`, 45 `theme`, 89 `ai`, 77 `graph`, 41 `docs` = **814** |
| `size` | **OK** — barrel 42,32 → **42,35 kB** (límite 43,5); analytics 66,24 → **66,20 kB** (límite 68). Ningún límite tocado. |
| `smoke` | **OK** |
| `pnpm --filter @kanzo-tech/docs build` | **OK** — 430 páginas |

### Lo que costó la capa C

- **`onboarding.mdx` reescrita.** Su sujeto era *«dos colores entran, un documento medido sale»*. Ahora es *«escribe el tema, envía el fichero»*, con un aviso arriba que dice qué se gana y qué se asume.
- **`theming.mdx` de 474 a 201 líneas.** Se fueron el reference tier, los escalones alfa, las puertas que se ajustan, la lectura de un registro y las semillas base16 — sus seis secciones describían el pipeline. Entran los veintiuno, los usos, los knobs y la trampa de herencia.
- **`TokenScale`** (los dos ficheros y su registro en `mdx-components`) — dibujaba las seis rampas con sus obligaciones. Sujeto borrado, componente borrado.
- **`docs/app/layout.tsx`** deja de inlinear los documentos compilados: el catálogo viaja en la hoja.
- **Cinco records a `superseded`** por `a-theme-is-one-flat-block`, editados y no reescritos para darle la razón, como manda `decisions/README.md`. Los vivos que citaban ficheros borrados se re-apuntaron a ficheros que existen. `DESIGN.md` reindexado; **`Open` queda en ninguna.**

### Dos guards que pasaban en falso

- **`smoke`** afirmaba *«la derivación se queda en `@kanzo-tech/palette`, que un consumidor nunca instala»*. Con el paquete borrado eso **pasa vacuamente y se lee igual que un guard que funciona.** Reescrito: comprueba que ningún punto de entrada de la derivación está en la ruta de runtime **y** que el paquete no resuelve.
- **`packages/theme/src/index.test.ts`** exigía `[data-theme=` dentro de `themes.css`. No está: `themes.css` lleva `@import`s y las preferencias del usuario, y los selectores viven en los ficheros de tema escritos a mano. Eso es lo que fijó el `source` del eje en `"document"` — **los valores de un tema son del tenant**, que es justo lo que ese guard defiende.

---

## 15. El estudio de temas

`docs/showcases/theme-studio/` — la superficie que faltaba, y la que `Preferences` **no** es: el panel
deja a un *usuario* elegir entre temas que un tenant publicó; nada dejaba a nadie **escribir** uno,
porque escribirlo era correr trece etapas. Un tema son 32 declaraciones en su suelo, así que autorar
es un formulario.

**La propiedad que lo hace fiable:** el panel de preview lleva los knobs como propiedades **en
línea**, y un bloque de declaraciones en línea *es* lo que una regla `[data-theme]` es. Así que los
especímenes no son una ilustración pintada desde un objeto de estado — son componentes reales
leyendo tokens reales, y el CSS que te da es el atributo `style` reformateado. **No hay
serializador, así que no hay nada en lo que un serializador pueda equivocarse.**

### Lo que se aprendió mirando la referencia, y no antes

Tres cosas que daisyUI hace y la primera versión de esto no:

- **Un par de color son dos cuadrados, y el segundo lleva una `A` pintada con la tinta sobre el
  relleno.** Ves si el par *se lee* antes que cualquier número. Es exactamente el fallo que esta capa
  repite —una tinta medida contra un relleno y puesta sobre otro— y cuesta cero.
- **El radio no es un slider: son cinco esquinas dibujadas.** Elegir una forma gana a arrastrar un
  número hacia ella. Igual el tamaño y el trazo. `--depth` va con tres nombres (Flat / Soft /
  Raised) porque lee como un *material*, y un número entre Soft y Raised no es una decisión.
- **El preview son fragmentos de app**, no un muestrario. Un tema se juzga sobre si una *interfaz*
  se sostiene, y una fila de controles sueltos no puede enseñar eso.

Y una que la referencia **no** tiene: las fuentes como espécimen, `Ag` en su propia letra. Eso ya
estaba resuelto en casa —`Preferences` lo hace y `Preferences.test.tsx` lo exige— y sólo había que
mirarlo.

### Tres defectos que sólo aparecieron al mirarlo en pantalla

1. **Dos pickers por token.** Emparejé cada superficie con una tinta que no era suya, así que
   `--foreground` acabó con tres controles. La fila `base` de la referencia son tres rellenos y
   **una** tinta. La regla quedó escrita: *cada token, un picker y sólo uno*, y un grupo es `pairs`
   (la tinta pertenece a ese relleno y a nada más) o `row` (no tiene pareja).
2. **Etiquetas solapadas** por meter cinco en una fila. El nombre es lo que te dice qué vas a
   cambiar; no se sacrifica.
3. **El interruptor Dark sólo estampaba `color-scheme`** y dejaba los colores claros — un tema
   mintiendo sobre sí mismo. Ahora cambia de lado de verdad, sembrando de `themes/kanzo-dark.css`
   (una fuente, como en todo lo demás). **Sólo se mueven los veintiuno**: el radio, el trazo y las
   tipografías son decisiones sobre el PRODUCTO, no sobre un lado.

---

## 16. Qué queda, y una trampa localizada

- **Los 35 temas de Daisy.** Y hay una trampa medida antes de empezar: **los suyos están en `oklch`
  y nuestro guard de AA sólo parsea `#hex`**, así que entrarían y `status.test.ts` los **saltaría en
  silencio** — pasaría verde midiendo menos. Hay que convertir a hex en la importación o enseñarle
  `oklch` al guard, y decidirlo *antes*, no después. Además: MIT, así que la atribución va en los
  ficheros generados. Y los nombres chocan (`dracula`, `nord`, `catppuccin-*` son nuestros y suyos
  a la vez, derivados del mismo upstream) — hay que decidir cuál gana.
- **La galería «una pantalla, doce aspectos»** (§7-bis), que ahora sí se puede escribir.
- **§4-bis, la tarjeta entera clickable.** `RadioGroupCard` ya es un `ArkRadioGroup.Item`, así que
  **verificar si lo que rompe el click es la celda de preview de dentro** antes de tocar la tarjeta.
- **El patrón de receta** a las familias que estrenan `--radius-selector` y `--size-selector`.
- **`--noise`** sigue sin call site. Contra la constraint 2, entra sólo si alguien lo pide.

---

## 17. Qué queda

Nada bloquea. El orden de §7 empieza por `packages/theme`, que es autocontenido y verde o rojo por
sí solo. Cuando ese paso esté, se ve en pantalla si los doce temas se parecen a los seis de hoy, y
esa comparación es la que dice si el corte fue del tamaño correcto.

---

## 18. La derivación vuelve — al formulario, no a la página

Escrito 2026-08-22, después de leer el paquete de Daisy en vez de suponerlo.

**Daisy no deriva en runtime.** Cero `oklch(from …)`, cero `color-mix` en 5.7.20, y
`var(--color-primary-content)` usado 136 veces **sin fallback**. Sus 35 temas publican los 28
valores planos. Pero fueron generados, y la fórmula se lee en la salida: de 280 pares, 156 llevan
el tono del relleno a cuatro decimales, con `L × 0.2` en la rama oscura (97/109) y `L = 0.8 + 0.2·L`
en la clara (exacto en 31/47).

Así que la elegancia que buscábamos **no es un mecanismo, es un generador**: computa la mitad
aburrida una vez y publica plano. Eso es `packages/theme/src/ink.ts` y
`decisions/the-obvious-ink-is-computed-in-the-form.md`.

Dos desviaciones, ambas medidas: la rama se elige por contraste (no por el umbral de luminosidad de
Daisy) y AA es un suelo. Sobre 9.178 rellenos, la fórmula pura cae bajo 4.5:1 en el 11,3% y los
pares que Daisy publica en el 14,3%; `inkFor` no devuelve nada bajo 4,50:1. Reproduce los pares de
Daisy a ΔE 0,60 de mediana y **los 112 de nuestros dieciséis temas enteros**.

### El recorte: 72 declaraciones, y sólo alias exactos

Medido exhaustivamente, no por sospecha. Cinco alias que valían lo mismo en los dieciséis:
`--secondary-foreground` y `--accent-foreground` = `--foreground`, `--sidebar-foreground` =
`--muted-foreground`, `--sidebar` = `--popover`, y `--popover` = `--card` en los ocho claros. De 54
declaraciones por tema a 49–50.

**No entra nada que necesite `color-mix` en `tokens.css`** — eso sería la derivación volviendo al
runtime, que es justo lo que se cortó. Los cuatro `--*-foreground` de estado, `--faint` y `--input`
se quedan autorados hasta que el *generador* los emita, que es otra tarea.

Un hallazgo colateral: `--popover` difiere de `--card` en los ocho temas **oscuros** y en ninguno
claro. Un overlay se despega de la tarjeta sólo en el lado oscuro, y ahí se gana el nombre.

### El bug que esto destapó: once de dieciséis temas estaban muertos

`kanzo.css` abría con `:root, [data-theme="kanzo"]`. `:root` tiene la **misma especificidad** que
`[data-theme="x"]`, así que decide el orden de fuente — y `themes.css` importa alfabéticamente, con
`kanzo.css` en la posición 12 de 16. Resultado: los once temas que ordenan antes se pintaban con los
colores claros de kanzo, `color-scheme: light` incluido. `bank`, `bank-dark`, `dracula-dark`,
`kanzo-dark`, los cuatro catppuccin. Sólo sobrevivían monochrome*, nord* y kanzo.

Ninguno de los guards podía verlo: **todos leen un fichero a la vez y ninguno pregunta cuál de dos
gana**. Arreglado con `:root:not([data-theme])`, y `themes.test.ts` lo sujeta con dos aserciones
—"binds the default theme so it cannot outrank a chosen one" y "gives exactly one theme the default
binding"— verificadas mordiendo al revertir el selector.

Verificado en navegador sobre `themes.css` crudo: sin `data-theme` sale kanzo, cero temas oscuros
con `color-scheme` incorrecto, y `bank` vuelve a su `#f9fafb`.

### La semilla del estudio: leída de la cascada, no copiada

Hecho. El estudio tenía treinta y pico hex escritos bajo un comentario que los llamaba «los mismos
que publica `themes/kanzo.css`». Cinco no lo eran, y nada podía cogerlo: una copia sólo está mal
comparada con su original, y el fichero que afirmaba que coincidían era la copia.

Ahora no hay semilla. `readTheme` estampa `data-theme` en el documento, lee las propiedades
computadas y devuelve el atributo — misma hoja, mismos selectores, misma resolución que usa la
página, así que **no puede discrepar del tema porque es el tema**. Tiene que ser `<html>` y no una
sonda escondida: una sonda hereda los tokens de sus ancestros y mezclaría el tema leído con el
puesto.

Descartado meter los valores en `theme-data.json`: son 20 kB al bundle de todo el mundo por algo que
sólo usa el estudio. Y descartado el subpath `.json` a pelo, que `index.ts` ya documenta como
irreparable en un build. Lo único que sí viaja son las **12 cadenas de fallback** (+657 bytes),
generadas de `tokens.css`, porque un tema autora ~30 de los 54 nombres y leer un token a secas
volvería vacío para los que defiere.

Además: selector «empezar desde» con los dieciséis, leído de `themeIndex`; el interruptor Dark salta
al tema contrario del catálogo (`nord` ⇄ `nord-dark`) conservando forma y tipografía; y
`seed.test.ts` prohíbe que vuelva a haber un hex en el fichero, con las dos mitades de la regla para
que ninguna se satisfaga borrando la otra.

Verificado en vivo: kanzo siembra `--card #fafafa`, `--muted #efefef`, `--muted-foreground #454545`,
`--accent #d9d9d9`, `--ring #737373` — los cinco que derivaban, ahora exactos.

### La tinta de página, y por qué NO hay un fichero generado aparte

Descartado el `themes-derived.css` importado antes de los temas. Es una regla de orden de import
invisible, un segundo artefacto, y dos guards que tendrían que leer dos ficheros para saber qué
declara un tema — y rompe la propiedad que sostiene todo esto: **un tema es un bloque plano que
abres y pegas**. Daisy tampoco lo hace; su generador escribe el fichero completo.

Así que los derivables los computa el estudio y viajan en el bloque. El fichero se queda en 49
líneas y las **decisiones bajan a ~30**, que era la pregunta de verdad.

`pageInk(fill, ground)` en `ink.ts`: el relleno mezclado al 60% hacia `--foreground`. Reproduce los
**64 valores autorados** de los dieciséis temas con ΔE ≤ 5, y los óptimos por token eran 60, 60, 59
y 62 — un número con redondeo, no cuatro.

Lo que **no** es: `inkFor`. Son dos trabajos que los nombres esconden. `--destructive-content` va
ENCIMA del relleno (blanco sobre un botón rojo); `--destructive-foreground` es texto rojo sobre la
página. Tirar del segundo a un extremo daría casi negro, que ya no es rojo. En el estudio se dibujan
juntos, tercera pastilla del par, porque verlos al lado es lo único que explica la diferencia.

**Un fallo de cableado que sólo vio el navegador:** le pasé `--background` como suelo de la mezcla
en vez de `--foreground`, y las propuestas salieron salmón claro sobre página clara. La fórmula
mezcla hacia la tinta y se **mide** contra la superficie: dos tokens distintos. Los tests pasaban
porque el de `ink.ts` usa el correcto.

La tinta de página tiene dos padres, así que sigue al relleno y a `--foreground`, con el mismo
predicado de siempre — enlazada es *igual a lo que la regla propone*, nada almacenado. Verificado en
vivo: mover `--foreground` a azul llevó `#8a1f19 → #96384c` y `#1c5d41 → #0e6e6d`, y dejó la tinta
sobre el relleno intacta.

### El permalink

`link.ts`: el documento entero en el fragmento, `deflate-raw` + base64url con `CompressionStream`
nativo — cero dependencia. **435 caracteres**, del orden del de Daisy, contra 1.296 sin comprimir.
Las claves viajan enteras: quitarles el `--` ahorra siete caracteres (deflate ya se había comido la
repetición) y costaría que un enlace de hoy siga decodificando cuando la lista de tokens crezca.

Un fragmento nunca llega a un servidor, así que la paleta sin publicar de un cliente no sale de su
máquina.

`decode` devuelve `null` ante cualquier cosa que no sepa leer y **filtra el payload a tokens con
valor de cadena**: viene de un desconocido y acaba en un atributo `style`.

Botón de copiar propio, porque el showcase se lee dentro de un iframe y ahí no hay barra de
direcciones que copiar. Y el selector deja de mentir: si el tema vino de un enlace muestra «a shared
link» y Reset se deshabilita, porque no hay tema publicado al que volver.

**Un bug que sólo vio el runner:** al decodificar basura rechazan los *dos* extremos del stream, y
el del lado writable estaba flotando con `void` — una unhandled rejection fuera de cualquier `try`.
Los siete tests en verde y el proceso en rojo. Vitest falla la ejecución por eso, que es la única
razón por la que apareció.

Verificado en vivo el viaje completo: fabriqué un enlace de un tercero y el estudio adoptó colores,
forma (`--stroke: 2px`, `--radius-selector: 9999px`, `--depth: 1`), tipografía, nombre y
`color-scheme: dark`.

### La galería

`showcases/theme-gallery/`. La misma pantalla del estudio, **importada y no reescrita**: subió a
`showcases/shared/`, que es exactamente lo que ese fichero pide (una pieza con dos call sites). Si
las dos divergieran, la galería compararía temas a través de dos interfaces distintas y la
comparación no valdría nada.

Una baldosa es un `data-theme` en un `div`, y ya. Ese selector es un selector de atributo corriente
—casa con un elemento, no con un documento— así que las propiedades del tema aterrizan en la
baldosa y heredan hacia dentro. Dieciséis temas cuestan dieciséis atributos: sin iframe por baldosa,
sin intercambiar hojas, sin JavaScript. Es la misma propiedad en la que se apoya el estudio, y la
que el bug del `:root` habría roto: todas las baldosas habrían pintado el mismo tema.

**Dos cosas que sólo se vieron mirando.** La primera no era un fallo: creí que el grid no entraba y
la ventana medía 745px de verdad. La segunda sí: a tamaño natural una baldosa mide **964px**, o sea
un tema cada vez, que es lo contrario de una galería. Con `zoom: 0.6` y recorte a 22rem se queda en
388px — seis temas a la vez en una pantalla ancha. `zoom` y no `transform: scale` porque el segundo
deja la caja del tamaño que era y el grid seguiría reservando 960px por tema.

El enlace «Edit» lleva el **nombre** (`?from=nord`), no los valores. La galería los tiene todos y
podría mandarlos, pero entonces el enlace llevaría una copia de la hoja de estilos y el estudio
abriría con lo que la galería creyera al renderizar. Un nombre hace que el estudio vaya a leerlo.

### Lo que queda

### `--noise`, con call sites

Pedido, así que entra. El mecanismo es el de Daisy y es el mismo truco que `--depth`:
`background-size: calc(var(--noise, 0) * 100%)` — a 0 la capa mide cero y no se pinta, a 1 tesela.
**Sin un condicional.** El grano (`--fx-noise`, un SVG de `feTurbulence` inline) es una constante de
la hoja, no una decisión del tema: un tema dice cuánta textura quiere, nunca cuál.

Tres call sites, los de la referencia: el botón al 100% y los controles de selección al 33% (una
caja de 1rem teselada a tamaño completo es un borrón, no una textura). Ningún tema publicado lo
declara — el defecto vive en `var(--noise, 0)`, como en el corte de alias.

Guard nuevo, `knobs-are-read.test.ts`, que codifica la regla que se rompió: **un knob que no lee
nadie miente**. Un tenant lo pone, no se mueve nada, y el tema parece roto en vez de ignorado —que
es peor, porque un tema roto se depura y una declaración ignorada se encoge de hombros. Cuenta dos
caminos: `var(--knob)` en la hoja, o binding en `tokens.css` cuya utilidad alguien usa. Verificado
mordiendo: quitando los call sites falla nombrando el knob.

Y el estudio gana el control, de dos pasos y no un slider: `--noise` multiplica el *tamaño* de la
capa, así que un valor intermedio es una textura dibujada más grande que su tesela, o sea un borrón.

### Lo que queda

### Los temas de Daisy: 13 de 35

`scripts/import-daisy.mjs`, que **no es un generador**: corre a mano y lo que escribe es fuente
desde ese momento, como hizo `extract-themes.mjs`. `check:generated` no lo conoce y no debe.

**No corrige un color.** Un `pastel` con sus cuatro pares de estado retocados hasta pasar AA no es
`pastel`, y el nombre prometería algo que ya no entrega. Así que un tema cuyos propios valores
fallan se salta, y se imprime por qué: 19 de 35 por ahí, más `dracula` y `nord` (el nombre está
cogido) y `light`/`dark` (son nuestros dos *lados*, no nombres de tema).

Ojo con la cifra: dije 21 y son **13**. Aquellos 21 sólo medían los pares de estado; el guard mide
doce pares resueltos, incluido el de la barra lateral, que cae por la cadena a `--card` /
`--muted-foreground`.

Ellos autoran 20 colores y nosotros 21, y los conjuntos no coinciden. Cuatro decisiones de mapeo:
`--card` toma `base-100` y no `base-200` (una tarjeta aquí se apoya en la página, y su superficie
elevada es nuestro `--muted`); `--border` toma `base-300`; `--ring` toma `primary`; y
`--muted-foreground` no tiene equivalente, así que se **busca**: la mezcla más pálida hacia
`base-100` que aún se lee sobre las dos superficies que la llevan. Una proporción fija habría sido
una suposición que falla en los oscuros.

**Un hallazgo que el importador destapó y ningún guard veía.** Los temas importados no traen las
cuatro tintas de página, así que caían al puente —`var(--destructive-foreground, var(--destructive))`,
o sea el relleno a plena fuerza sobre la página— y eso da **1.23:1** en el warning de `acid`.
Diecinueve pares ilegibles y nada los medía. Ahora `themes.test.ts` mide `--background` contra las
cuatro, y el importador las autora con `pageInk`, que gana un tercer argumento: la superficie sobre
la que se lee. Con ella el 60% deja de ser el valor y pasa a ser el punto de partida, con AA de
suelo — la misma disciplina que `inkFor`. No cambia nada en los dieciséis de casa, que ya cumplían;
existe por `lemonade`, que se quedaba en 3.93.

Los importados traen **28 declaraciones**, que es exactamente el número de Daisy. Los nuestros, 49.

Catálogo: 29 temas, 15 oscuros y 14 claros.
- `--faint` e `--input` siguen autorados a propósito: sus fórmulas ajustan de mediana (ΔE 1,5 y 2,1)
  pero tienen un tema que se va a 14 y a 7,8. Con esa dispersión una propuesta estorba más que ayuda.
- **El canal categórico de los importados: declinado, no resuelto.** Los trece declaran
  `--chart-capacity: 0`, que es la respuesta honesta y la que el contrato de `categoricalCapacity`
  ya contemplaba —una capacidad *ausente* lee como ocho, así que callarse hacía que un chart
  reclamara ocho colores y los pintara con un `var()` que no resuelve—. Lo que queda es el diseño:
  **un set por defecto en `tokens.css`**, para que cualquier tema tenga charts sin autorar ocho
  colores. Medido y pendiente: `--chart-6` toma 12 valores distintos en 16 temas, así que el set no
  puede derivarse de `--primary`; tiene que elegirse una vez y validarse sobre fondo claro y oscuro.
### La documentación, al día

`theme-studio.mdx`: cifras corregidas (~50 declaraciones, ~30 decisiones), fuera «no comprueba
contraste» —lo hace— y dentro dos secciones nuevas: la regla de derivación con sus medidas, y el
permalink. El callout del puente decía que los *usos* no salen en el bloque emitido; ahora dice la
excepción, que son los cuatro `-foreground` de estado.

`theming.mdx`: «cincuenta y cinco declaraciones» → «cincuenta, y unas treinta decisiones». La lista
de usos pasa a una tabla que separa lo que **ningún** tema autora (`--secondary-foreground`,
`--accent-foreground`, `--sidebar`, `--sidebar-foreground`) de lo que autoran **sólo los oscuros**
(`--popover`) y de lo que siguen autorando todos (`--field`, `--faint`, `--input`, los `-foreground`
de estado). «Es un uso» y «se deja en paz» son afirmaciones distintas y la página las confundía.
Sección nueva: **tematizar una región**, con el `data-theme` en un `div`, el aviso de `color-scheme`
y el callout del `:root`.

`onboarding.mdx`: el ejemplo se queda —es un tema legítimo— con una nota de que ninguno de los
dieciséis acabó necesitando `--secondary-foreground` ni `--accent-foreground`.

`styling.mdx`: revisado, nada caducado.

### Lo que queda

- `--faint` e `--input` siguen autorados a propósito: sus fórmulas ajustan de mediana (ΔE 1,5 y 2,1)
  pero tienen un tema que se va a 14 y a 7,8. Con esa dispersión una propuesta estorba más que ayuda.
- ~~El build de docs roto~~ — **resuelto, y no era de nadie.** `/docs/ai/tool` reventaba con
  `Maximum call stack size exceeded` en el prerender y lo atribuí a un bug de Ark en
  `JsonTreeView`. **Falso**: lo reproduje en SSR aislado y renderiza bien; el JSX de esa página está
  dentro de vallas de código, así que no monta nada. La causa la explicaba el propio
  `examples/tool/example-default.tsx` desde el día 21 —un `Extension` de CodeMirror es un grafo
  cíclico y sin `"use client"` el serializador RSC lo recorre hasta agotar la pila— y la directiva
  estaba puesta. Lo que fallaba era correr `pnpm --filter docs build` **en aislamiento**: eso
  consume el `dist` de `packages/ai` sin reconstruirlo, y llevaba tres horas y media por detrás de
  un `src` que otra sesión editaba. **Correr siempre el `pnpm build` de raíz**, que construye en
  orden topológico, antes de creerse un error del build de docs.
