# `decisions/` deja de existir, y la documentación es la única fuente de verdad

Plan escrito el 2026-08-25. Alcance inferido del árbol de rmlext, no supuesto: **allí no hay
`DESIGN.md` ni `CONVENTIONS.md`** — toda la prosa de diseño vive en
`apps/docs/content/docs/design/`, y `CLAUDE.md` es el puntero para quien trabaja. Eso es lo que
significa aquí «como en rmlext».

## La operación, en una frase

La suya, y se copia literal: **un registro se sustituye por lo que decía, nunca se anota y nunca se
supersede con un fichero que se queda al lado del árbol.**

## El inventario, medido

| | |
|---|---|
| registros | 73 ficheros — **63 `live`**, 8 `superseded`, más `README`, la plantilla y el `ADR 0001` |
| citas hacia `decisions/` | **232** |
| — en `packages/` | 125, casi todas etiquetas de procedencia en un doc-comment cuya frase de al lado ya lleva la regla |
| — en `docs/content/` | 15 |
| — en `.changeset/` | 6 |
| — en la raíz | el resto: `DESIGN.md`, `CONVENTIONS.md`, `CLAUDE.md`, `README.md`, `BENCHMARKS.md` |
| guard | `packages/ui/src/decisions.test.ts`, que verifica cinco reglas de forma y dos de contenido |
| citas hacia `DESIGN.md` | **368** |
| citas hacia `CONVENTIONS.md` | **293** |
| **total a reescribir** | **~893** |

**Y `DESIGN.md` ya está duplicado.** `docs/content/docs/(root)/philosophy.mdx` son 290 líneas con
las mismas secciones —la restricción que gobierna, las tres capas, los tres ejes, la regla del
motor, la del nombre, la admisión, menú contra listbox, la frontera de cliente, dónde vive la
especificidad—. O sea que la fuente doble que hay que cerrar no es sólo `decisions/`: **ya hay dos
copias de las reglas y la del sitio es la que se queda.** `CONVENTIONS.md` sólo está duplicado a
medias: `styling.mdx` lleva la receta, y la mitad de autor —nombres, frontera de cliente,
comentarios, tests, distribución— no tiene página.

## Lo que hay que decidir por registro, y no es mecánico

De los 63 vivos, la mayoría **no son de cara al usuario**: son reglas de la casa —nombres, guards,
la frontera de cliente, tokens— que hoy viven en `DESIGN.md` y `CONVENTIONS.md`. Un puñado sí tiene
página (`a-theme-is-one-flat-block`, `exactly-one-main`, `a-shell-has-two-legal-shapes`). Así que el
destino no es uno:

- **una sección `docs/content/docs/design/` nueva**, que es donde aterriza `DESIGN.md` entero y la
  mayoría de los registros;
- **la página del componente**, cuando el registro es sobre una superficie que ya se documenta;
- **nada**, cuando el registro es historia: los 8 `superseded` se sustituyen por la frase que los
  reemplazó, allí donde esa frase ya está.

## Los pasos

1. **`docs/content/docs/design/` existe**, con una página por eje y `DESIGN.md` dentro. Sin borrar
   nada todavía.
2. **Los 63 vivos entran**, en la página que les toca, como prosa y no como ficha. El `Held by` deja
   de ser un campo y pasa a ser la frase que nombra el guard.
3. **Las 232 citas**: reescritas a la ruta del sitio donde apuntaban a un registro que ahora es una
   página; borradas donde eran procedencia y la frase de al lado ya lleva la regla.
4. **El guard**: `decisions.test.ts` pierde las cinco reglas de forma —no hay fichas que validar— y
   conserva las dos que valen, apuntadas a las páginas: *un título de test citado existe* y *un
   nombre declarado ausente no está en el barril*.
5. **El borrado**: `decisions/`, `DESIGN.md`, `CONVENTIONS.md`. `CLAUDE.md` se queda y apunta al
   sitio.

## Lo que se queda a propósito

Las menciones **en pasado** en `BENCHMARKS.md` y en los guards: son la evidencia medida de por qué
esto se va, no punteros hacia dentro. Igual que ellos conservaron las suyas.

## El riesgo, dicho antes de empezar

`CLAUDE.md` declara `decisions/` como una de sus tres constantes: *«Any decision may be reopened.
They live in `decisions/`, one file each, each carrying the evidence that would reverse it.»* Ese
mecanismo —la evidencia que revertiría cada decisión— es la parte con valor y **no tiene equivalente
en una página de prosa**. Si al terminar no se puede señalar, en la página, qué medición reabre una
regla, esto habrá sido una pérdida y no una consolidación. Es la única cosa que hay que vigilar.
