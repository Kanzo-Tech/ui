# Qué commit trajo realmente qué, 2026-08-19

> **EVIDENCIA. Revisado 2026-08-26 y sigue siendo cierto.** No dirige trabajo: es lo único que
> traduce cinco mensajes de commit a lo que sus diffs llevaban de verdad, y no se puede derivar de
> `git log` porque el índice compartido no deja marca. Se borra el día que la historia deje de
> consultarse.

Decisión de Ángel: **no se reescribe la historia** — hay varias sesiones commiteando a la vez sobre
este checkout y no hay remoto, así que un rebase bajo ellas es cómo se pierde trabajo de verdad. La
verdad se escribe aquí en su lugar. Esto es peor que tenerla en el mensaje del commit y mejor que
perderla.

## Qué pasó

Tres veces en dos días, una sesión paralela ha hecho `git commit` con trabajo **staged** de un agente
mío todavía en vuelo, así que el código aterrizó bajo un mensaje que no lo describe. Nadie hizo nada
mal: `git add` deja el índice compartido, y dos procesos commiteando el mismo checkout no tienen
forma de verse.

| commit | mensaje que lleva | qué se llevó además |
|---|---|---|
| `244baed` | *one Look, one builder, and the names belong to the host* | ediciones en vuelo de `index.ts`, `index.test.ts` y `graph-view.tsx` del trabajo del `MosaicClient`. Contenido intacto. |
| `55ef47c` | *the contributed-preference record closes, and a number was stale* | **el cambio entero** de la vista alejada como muestra: el borrado del agregado, el muestreo por zancada, los guards y la decisión. |
| `25dddf8` | *a far view is a sample, and the summary it replaces crashed the tab* | quedó casi vacío — sólo una línea de `DESIGN.md`. **Es el mensaje que describe lo que trajo `55ef47c`.** |

**Y un cuarto caso, en la dirección contraria:** `c562229` (el agente de la capa de aristas) se llevó
seis ficheros del agente de la caja de coordenadas antes de que éste commiteara — `use-bounded-graph.ts`
y su test, `graph-model.ts`, `index.test.ts`, `DESIGN.md` y el changeset. Verificado que no se perdió
nada. Importa porque rompe la lectura cómoda de los tres anteriores: no es «las otras sesiones se
llevan lo mío», es que **dos procesos cualesquiera commiteando un índice compartido se llevan lo del
otro**, y nosotros hemos estado en los dos lados.

Y un quinto, atrapado a tiempo: un borrado staged de `once-query.ts` de otra sesión se coló en
un primer commit del agente de diseño, que lo devolvió al índice intacto al notarlo.

## Cómo leer esto

Si `git log` te dice que el muestreo por zancada llegó en un commit sobre preferencias, no busques un
merge raro: busca aquí. Y si estás reconstruyendo por qué existe algo, **el mensaje correcto es el de
`25dddf8`** aunque su diff no lo respalde.

## Cómo evitarlo la próxima

Lo barato: un agente que va a tocar ficheros compartidos commitea **por rutas explícitas y pronto**,
en vez de acumular staged. Lo caro y correcto: un worktree por agente (`.claude/worktrees/` ya
existe para eso). Lo segundo cuesta una instalación por worktree, que es la razón por la que no se
hizo — y este fichero es lo que cuesta no hacerlo.
