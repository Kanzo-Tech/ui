# Traspaso — la capa de color / `Look`, 2026-08-13

*Para retomar en una ventana limpia. Complementa `.planning/COLOUR-REVIEW.md`, que sigue siendo el
documento de decisiones; esto es el estado y lo que queda.*

---

## 0 · Dónde está el trabajo — INTEGRADO, 2026-08-13

**En `main`**, fusionado en `88995a8` («Merge branch 'ds-colour-role-cut'»), nueve commits. La rama
`ds-colour-role-cut` (antes `worktree-agent-a54ba4cbaf5bd00e1`) y su worktree siguen ahí sin nada
pendiente; se pueden borrar.

**El incidente del `pnpm install --force` no dejó rastro.** Las cinco rutas versionadas que borró se
verificaron con `git` antes de fusionar: cuatro (`pnpm-lock.yaml`, `CONVENTIONS.md`, `BENCHMARKS.md`,
`tsconfig.base.json`) no aparecían siquiera en `git status`, o sea idénticas a HEAD; la quinta,
`.changeset/`, sólo mostraba el fundido intencional de 18 notas en una, con `config.json` y
`README.md` intactos.

Los nueve commits, y el porqué del reparto: cada uno lleva **un** registro de `decisions/` y su línea
en el índice de `DESIGN.md`, para que `decisions.test.ts` quede verde en cada punto de la historia y
no sólo al final. Los cuatro ficheros que llevaban dos decisiones a la vez (`radio-group`, `slider`,
`CodeEditor`, `graph-looks`) se partieron por hunk.

---

## 1 · La pregunta que abrió esto, y su respuesta

> «La paleta está a medias, no la veo de referencia, la veo muy compleja — mi idea era algo tipo
> DaisyUI.»

**Medido: el modelo NO está mal en la raíz.** Quien sólo quiere usar un `Button` necesita **3
conceptos** (instalar, importar el CSS una vez, envolver en el provider): cero de las 13 etapas del
pipeline y cero de los 115 exports. Eso es nivel DaisyUI.

**Lo que sí estaba mal**: **53 de los 71 tokens de rol eran byte a byte idénticos a un paso de la capa
de referencia** — dos vocabularios completos para los mismos valores. Y la causa es limpia: los roles
eran el apaño de una capa de referencia que faltaba, la capa se publicó el 4 de agosto, **y nadie
quitó el apaño**. (La nota que decía «las rampas mueren en `resolveRoles`» ya es falsa: ese grep pasó
de 0 a 288.)

---

## 2 · Qué se hizo

**El corte.** 17 tokens fuera (los 53 menos los 36 que pasan admisión). Roles **71 → 54**;
declaraciones por bloque 216 → 199. Los valores eran idénticos, así que el renombrado es
demostrablemente invisible, y `compile.test.ts` fija los 17 contra el paso que los sustituyó.
Verificado en vivo sondeando el DOM: `--brand-a5` da `#0000001f`, justo lo que llevaba `--selection`.

**La guardia de `alpha-steps` estaba probando un corpus de cero.** Las siete grafías prohibidas
casaban con **0 sitios**, mientras **71 diluciones viajaban en 26 ficheros**. Reescrita como guardia
*derivada*: lee los 208 tokens del `tokens.css` publicado y trata el `/` posterior como la violación.
Distingue `shadow-destructive/24` (color) de `shadow-xs/5` (opacidad propia de una sombra), que
ninguna regla por prefijo puede. Mutada para comprobar que muerde.

**~31 ramas `dark:` retiradas** de 12 recetas (medido: `--destructive` da 4.15:1 en oscuro, por
encima del 3:1 que pide 1.4.11 en `border-`/`ring-`). **Dos restauradas a propósito**: los anillos de
foco de `badge.tsx` y `checkbox.tsx` — `invalid` y `focus-visible` se parecen en un grep y responden
a mediciones distintas (el foco diluido medía 1.29:1). `shark-parity` **no lo detecta y no puede**:
compara la superficie de exports, no los internos de una receta.

**`saturate(1.1)` borrado de Nebula.** Movía los ocho slots, el peor ΔE 8.05 — el tamaño de la
separación que `deriveScheme` garantiza. **Pero no la rompía** (par más cercano 32.36 → 30.38): el
motivo no es un fallo que causara, sino que un look no debe *poder* causarlo en una paleta con menos
holgura. La medición que no lo incrimina está en el comentario.

**Los 19 changesets fundidos en uno**, verificados byte a byte antes. **Primera versión: 0.1.0.**

**`Look` con secciones.** Dos mecanismos, decididos con arte previo:
- **Resolución — fallback jerárquico de Neovim**: `--graph-point-size-min` → `--point-size-min` →
  default del manifiesto. **Contribuir es usar un nombre, no declararlo en el core**, así que la
  puerta del barrel raíz queda cerrada estructuralmente y no por disciplina.
- **Validación — la mitad que Neovim no tiene**: el manifiesto declara sus tokens, así que una errata
  se reporta en vez de degradar en silencio. **Esa combinación no la ha hecho nadie** (VS Code y
  Emacs contribuyen sin validar; Vanilla Extract valida del todo y por eso no admite secciones
  opcionales, y StyleX se retractó de esa forma). La guardia lo dice y lista tres puntos ciegos.
- **Defaults derivados** al estilo `contributes.colors`, pero mejor: un `RoleBinding` declarativo
  contra la rampa (`--graph-marquee` = `(brand, alpha 5)`), no una transformación imperativa.
- Test que fija que **un documento con la sección de un paquete ausente es legal y se conserva byte a
  byte**. `smoke` pasa sin los 12 peers opcionales.

**Regla de admisión, escrita**: una sección entra si sus obligaciones devuelven **al menos una
afirmación medible** — y **se gana por TENER barra, no por pasarla**, o arreglar un defecto degradaría
una sección. Y la regla de retirada: **dos nombres para una DECISIÓN**, nunca para un valor (medido:
Atlassian tiene 466 tokens sobre 130 valores, 93 % comparten valor; la versión ingenua borraría el
72 % de una API sana).

**Tres secciones**: color, grafo, densidad.

---

## 3 · El grafo — ya estaba bien, y está medido

- **Los colores categóricos del grafo SON los 8 slots de gráfico.** No hay segunda lista.
- **White-label probado en la GPU** con `readPixels`: al pasar de kanzo a dracula cambian **25 de 25
  píxeles**, y `--chart-capacity` va de 8 a 7 porque Dracula nombra siete categorías.
- `Look` lleva **cero campos de color**, y las tres primitivas de color reimplementadas están fuera.
- **`shape-floor` tenía la conclusión correcta y el argumento falso.** Smart & Szafir (CHI 2019,
  doi:10.1145/3290605.3300899): la discriminación de forma es **robusta al tamaño** (4,5 puntos entre
  6 y 50 px). Lo que colapsa es **la forma corrompiendo los otros canales**: JND de luminancia
  6,48 → 11,30 ΔL\*, y el cuadrado se percibe mayor en el **82 %** de los ensayos a igual área. Ink
  gasta forma en identidad y tamaño en grado a la vez. Corregido en tres sitios.
- `shape-capacity` re-derivado sobre base medida: techo **5 forma / 7 color**, y 4 + `SHAPE_OTHER` = 5.
- `link-fade` va **sin graduar a propósito** (`measured: null` + qué la cerraría), con un test que fija
  que hay **exactamente una** fila así.

---

## 4 · Accesibilidad: lo medido, y lo que queda

**La hipótesis del `xs` en clúster está REFUTADA.** Ningún `size="xs"` falla: todos los
infradimensionados los salva la excepción de espaciado de 2.5.8.

**El defecto real era una fila hecha a mano** en `graph-view.tsx` (`px-1 py-0.5 text-xs`): 17,5 px en
compact y **20,0 en default** — falla en dos de las tres densidades. **Arreglado con `min-h-[24px]`,
en píxeles a propósito**: WCAG enuncia su barra en px CSS y **todo tamaño de esta librería es `rem`
multiplicado por la densidad**, así que `min-h-6` daría 24 en default y **21 en compact** — el fallo
disfrazado de arreglo.

**Corrección importante**: la densidad **no** movió un objetivo que pasaba a uno que falla. Es un
multiplicador sobre una barra que **las dos capas pueden romper**, y la rompió primero el componente
al declarar una fila de 1.25rem.

**`target-size` sigue en ROJO a propósito** en la sección de densidad: `Button size="xs"` mide 21 px
en compact. Ningún call site medido falla por él, pero la barra es de la variante y no se ha tocado.

**Y falta una primitiva**: una **fila de lista pulsable y densa** que cumpla 2.5.8 por construcción.
`Item` es una tarjeta (`p-3`, `border`, `rounded-xl`, ~2,5× la altura); `SidebarMenuButton` está
acotada; `Listbox`/`Command` traen roles ARIA que una lista estática no quiere. **El hallazgo no fue
descuido: fue que la primitiva no existe.** Es trabajo con su propio ciclo (admisión, docs, ejemplo,
changeset), no un parche.

---

## 5 · Qué queda

1. ~~**Integrar el worktree** y commitear.~~ **Hecho** — §0.
2. **La primitiva de fila** (§4).
3. Decidir si `target-size` de `Button size="xs"` se arregla o se documenta.
4. **No construir más registro del necesario**: hay tres secciones; el mecanismo ya está. La
   tentación siguiente es convertir el wash de marquesina, la viñeta y la rejilla en roles —
   **no lo hagas**: es exactamente cómo nacieron los 17 tokens borrados.
   `SELECTION_WASH = "var(--brand-a5)"` en el call site YA es el patrón correcto de capa 3.

## 6 · Números de control

`build` · `typecheck` · `lint` · `check:generated` · `test` (**824**) · `smoke` · `docs build`:
todos verdes. `size`: barrel 40.13 → **40.00 kB**, analytics 66.28 → **66.26**, componente **1.11**,
hoja 24.13 → **23.93**. **Ningún límite subido.**

`check:generated` regenera limpio pero reporta diff contra HEAD: son los 12 generados que cambiaron
por el corte, y el generador se verificó idempotente (dos pasadas, mismo md5).
