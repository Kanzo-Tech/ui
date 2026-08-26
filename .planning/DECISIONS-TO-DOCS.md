# `decisions/` deja de existir, y la documentación es la única fuente de verdad

Plan escrito el 2026-08-25, mapa de destinos el 2026-08-26. Alcance inferido del árbol de rmlext,
no supuesto: **allí no hay `DESIGN.md` ni `CONVENTIONS.md`** — toda la prosa de diseño vive en
`apps/docs/content/docs/design/`, y `CLAUDE.md` es el puntero para quien trabaja. Eso es lo que
significa aquí «como en rmlext».

## La operación, en una frase

La suya, y se copia literal: **un registro se sustituye por lo que decía, nunca se anota y nunca se
supersede con un fichero que se queda al lado del árbol.**

Y su lección sobre las citas: *«the rest were provenance labels in doc-comments where the sentence
beside them already carried the rule»* — **ésas se borran, no se reescriben.**

## El inventario, medido

| | |
|---|---|
| registros | 73 ficheros — **62 `live`** con los cinco campos, 8 `superseded`, el `ADR 0001`, `README` y la plantilla |
| citas hacia `decisions/` | 337 apariciones; **191 líneas** fuera de `decisions/` y `.planning/` |
| — en `packages/` | 125 apariciones, casi todas etiquetas de procedencia en un doc-comment cuya frase de al lado ya lleva la regla |
| — en `docs/` | 20 líneas |
| — en `.changeset/` | 6 |
| guard | `packages/ui/src/decisions.test.ts`, cinco reglas de forma y dos de contenido |

## El mecanismo que no se puede perder

`CLAUDE.md` declara `decisions/` como una de sus tres constantes: *«Any decision may be reopened.
They live in `decisions/`, one file each, each carrying the evidence that would reverse it.»* Esa
evidencia —el campo `Reversed by`— es la parte con valor. **Sobrevive como frase dentro de la
prosa**, igual que en rmlext: «lo que diría que esto está mal es…», «lo que lo cumpliría es…». Si al
terminar no se puede señalar qué mediría reabrir una regla, esto habrá sido una pérdida.

Los `Held by` no se pierden tampoco: dejan de ser un campo y pasan a ser la frase que nombra el
guard, que es lo que el guard superviviente sigue comprobando.

## El destino, por registro

### `docs/content/docs/design/` — la sección nueva, tras el divisor de mantenedores

Seis páginas. La mayoría de los registros **no son de cara al usuario**: son reglas de la casa.

**`design/index.mdx`** — cómo se escribe una regla aquí, y las reglas de trabajo:
`a-count-belongs-in-a-script`, `a-rule-broken-three-times-becomes-a-test`,
`an-audit-is-a-map-not-an-oracle`, `a-docs-defect-is-a-library-defect`,
`a-chart-fails-silently-and-well-painted`, `one-changeset-until-the-first-publish`,
`a-class-list-is-source-so-the-barrel-budget-moves`, `a-generated-index-with-no-second-list`. **(8)**

**`design/admission.mdx`** — qué se gana un nombre en un barril: `adoption-before-design`
(absorbe el superseded `field-has-no-consumer`, que es su ejemplo cerrado),
`an-export-needs-a-second-call-site`, `a-machine-with-a-switch-is-a-variant`,
`a-compound-keeps-its-root-even-when-the-root-is-an-alias`, `a-layout-tree-is-children`,
`a-grammar-ships-its-whole-vocabulary`, `charts-and-table-ship-code-forms-ship-a-guide`,
`the-ai-surfaces-are-their-own-package`, `a-tool-panel-composes-its-snippet`,
`the-structure-view-is-treeview-until-the-data-nests`, `a-chart-needs-no-factory`,
`ai-assist-composes-over-pure-inputs`. **(12)**

**`design/references.mdx`** — el orden de autoridad: `a-measurement-overrules-the-reference` es el
dueño y los demás lo instancian. `match-the-reference`, `a-name-shark-ships-is-ours`,
`a-house-principle-withholds-no-name`, `a-part-is-named-by-its-machine`,
`adopt-the-part-the-machine-ships`, `provenance-beats-purity`,
`ai-elements-is-a-source-not-a-reference`, `layout-is-not-ark-native`,
`steps-claims-a-tab-role-it-cannot-keep`. **(10)**

**`design/naming.mdx`** — nombres y `data-slot`: `a-primitive-owns-its-slot`,
`what-identifies-a-part-is-not-what-a-caller-may-change`,
`a-type-and-a-component-may-not-share-a-name`,
`a-hook-takes-the-name-of-the-request-it-makes`. **(4)**

**`design/colour.mdx`** — el documento de tema y lo que se contribuye a él:
`a-theme-is-one-flat-block` (dueño; absorbe cinco superseded),
`the-categorical-default-is-one-set-for-every-theme`, `accent-is-a-surface-not-a-third-brand`,
`the-obvious-ink-is-computed-in-the-form`, `monochrome-is-a-palette-not-a-look`,
`an-invalid-boundary-needs-no-dark-branch`, `a-section-brings-measurable-obligations`,
`density-has-no-legibility-floor`, `a-preference-is-contributed-like-a-token`,
`the-declaration-ships-with-the-library`. **(10)**

**`design/graph.mdx`** — el lector acotado: `ADR 0001` (el número se queda como etiqueta del suceso,
porque fossil cita por número, y la frase de al lado dice lo que decidió),
`a-tile-is-an-address-not-a-verb`, `a-far-view-is-a-sample-not-a-summary`,
`an-edge-is-drawn-from-bytes-in-hand`, `a-filter-is-a-predicate-not-a-mask`,
`the-coordinate-box-is-the-corpus-extent`, `a-dense-id-is-thirty-two-bits`,
`a-look-is-form-and-a-channel-is-a-binding`, `a-look-declares-what-it-changes`,
`a-canvas-component-owns-the-three-that-never-differ`. **(10)**

### La página del componente — donde el registro es sobre una superficie que ya se documenta

| registro | destino |
|---|---|
| `exactly-one-main` | `/docs/layout/shell` |
| `a-shell-has-two-legal-shapes` | `/docs/layout/shell` |
| `a-region-carries-no-aesthetic` | `/docs/layout/shell` — **ya está ahí**, sólo le falta la evidencia que lo revertiría |
| `the-skip-target-is-the-main-landmark` | `/docs/layout/skip-nav` |
| `a-filter-is-a-value` | `/docs/forms/facet-filter` |
| `two-themers-and-one-root` | `/docs/theming` |
| `a-model-is-a-value-so-the-picker-is-a-select` | `/docs/ai/prompt-input` — **ya está ahí** |
| `a-line-takes-candidates-a-paragraph-takes-a-continuation` | `/docs/ai/fields` |
| `a-column-is-read-from-the-shape` | `/docs/showcases/field-notes` |

**(9)** — 8 + 12 + 10 + 4 + 10 + 10 + 9 = 63, que son los 62 vivos más el ADR.

### Nada — los ocho `superseded`

Se sustituyen por la frase que los reemplazó, allí donde esa frase ya esté; y ya está en todos.

| registro | lo reemplazó | qué se conserva |
|---|---|---|
| `a-categorical-set-may-use-the-palettes-own-colours` | `a-theme-is-one-flat-block` | nada: la derivación entera se borró |
| `a-palette-is-chosen-per-appearance` | `a-theme-is-one-flat-block` | nada |
| `a-role-earns-its-name-or-becomes-a-step` | `a-theme-is-one-flat-block` | nada: los 53 roles se cortaron |
| `palette-is-authoring-time` | `a-theme-is-one-flat-block` | nada: `@kanzo-tech/palette` no existe |
| `prose-that-is-hashed-is-data` | `a-theme-is-one-flat-block` | nada: no hay digest |
| `one-theme-provider` | `two-themers-and-one-root` | la razón del portal, que el sucesor ya lleva |
| `field-has-no-consumer` | `adoption-before-design` | una frase: es el ejemplo que cerró |
| `a-picker-that-forgets-its-value-is-a-defect` | `a-model-is-a-value-so-la-picker-is-a-select` | el argumento del `selectionBehavior`, que el sucesor ya lleva en su `Because` |

## Las citas

- **Se borran** donde eran procedencia y la frase de al lado ya lleva la regla — la mayoría de
  `packages/`.
- **Se reescriben** a la ruta del sitio donde apuntaban a un registro que ahora es una página.
- **Se quedan en pasado** donde son la evidencia medida de por qué esto se va: `BENCHMARKS.md` y las
  menciones de los guards a lo que costó descubrir una regla.

## El guard

`decisions.test.ts` pierde las cinco reglas de forma —no hay fichas que validar— y conserva las dos
que valen, apuntadas a las páginas: *un título de test citado existe de verdad* y *un nombre
declarado ausente no está en el barril*. El fichero pasa a llamarse por lo que comprueba.

## Lo que no es de esta obra

`DESIGN.md`, `CONVENTIONS.md`, `philosophy.mdx`, `styling.mdx`, `BENCHMARKS.md`, `packages/graph/` y
`docs/components/write-scaling.tsx` los llevan otras sesiones. La sección `## Decisions` de
`DESIGN.md` es un índice de estos registros y **muere con ellos**: se borra al final, cuando el otro
agente haya terminado con el fichero.

## Hecho — 2026-08-26

- [x] El mapa.
- [x] `design/` existe: `index`, `admission`, `references`, `naming`, `colour`, `graph`, tras un
      divisor «For maintainers» en `docs/content/docs/meta.json`. Los 62 vivos y el `ADR 0001`
      dentro, como prosa, y cada regla termina con **«What would reverse it»**.
- [x] Los nueve que hablaban de una superficie documentada, en la página del componente.
- [x] Los ocho `superseded`: seis mueren en una frase de `design/colour.mdx` (cinco) y de
      `design/admission.mdx` (uno); de los otros dos se conserva una frase cada uno.
- [x] Las citas. **191 apariciones fuera del directorio**, no 232 — el plan contaba también las de
      dentro. Quedan tres, y las tres son en pasado: `BENCHMARKS.md` sobre rmlext, `CLAUDE.md`
      diciendo que aquí no hay ninguno, y el guard nuevo explicando de qué es el reemplazo.
      Reparto: 76 borradas, 88 reescritas, 16 que se fueron con el guard, 11 menciones sueltas.
- [x] `decisions.test.ts` → `packages/ui/src/documented-evidence.test.ts`: pierde las cinco reglas
      de forma, conserva las dos de contenido leyendo las líneas *Held by* del sitio.
- [x] `decisions/` borrado. `CLAUDE.md` reescribe su tercera constante.

Verde en `lint`, `check:generated`, 575 tests en `ui`, 71 en `theme`, 86 en `graph`, 96 en `ai`,
`docs` typecheck y la build de docs.

## Lo que queda abierto

- **`design/references.mdx` y `/docs/conventions` se rozan.** La sesión de `CONVENTIONS.md` aterrizó
  el orden de autoridad —«la referencia gobierna la superficie; una medición gobierna la
  referencia»— y sus cinco elaboraciones en `conventions.mdx` mientras esta escribía la
  jurisprudencia. La página de diseño ya no repite la frase y apunta a la suya, pero *Steps* y
  `usePinInput` aparecen en las dos: allí como una línea de la regla, aquí con la medición contra
  `@zag-js/steps@1.41.2`. Si alguien quiere una sola, la de `conventions.mdx` es la que se recorta.
- **`size` no se corrió.** Nada de esta obra toca código enviado: son comentarios, cadenas de un
  fichero que sólo importa un test, y páginas MDX. La cifra a batir sigue siendo 66.24 kB en
  `/analytics`.
- **`smoke` tampoco.** Por lo mismo.
