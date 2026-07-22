# Componentes nuevos de kanzo-ui — diseño y plan

Estado: propuesta. Fecha: 2026-07-22.

Diseñado contra call sites reales extraídos de `keasy/web` y `metadata-form`, no contra
especulación. Cada decisión cita la evidencia que la sostiene.

---

## 0. Regla de admisión (refinada)

`CONVENTIONS.md` dice "adopt, don't rebuild". Esa regla es sobre **comportamiento**, no
sobre composición:

> **No reimplementes comportamiento** — foco, teclado, aria, posicionamiento, colisión.
> Eso lo resolvió Ark y lo haremos peor.
> **Sí construye composición y patrones** — es la capa Level 2, y nadie upstream conoce
> nuestros productos.

Un componente nuevo entra si cumple las tres:

1. **Domain-free** — no sabe de RDF / SHACL / fossil / grafos / auth.
2. **Demanda probada** — aparece en ≥2 sitios reales, no en una hipótesis.
3. **Envuelve, no reinventa** — si necesita comportamiento, se apoya en Ark.

La regla 3 es la que impide que "podemos crear componentes" degenere en el ad-hoc styling
que `CONVENTIONS.md` quiere evitar.

---

## 1. Correcciones a hallazgos previos

Tres cosas que se afirmaron antes en esta investigación y que la evidencia desmiente:

| Se dijo | Realidad verificada |
|---|---|
| "keasy hace binding RHF+zod ad-hoc" | `react-hook-form` está en `package.json` pero **cero usos** en `src/`. No hay `useForm`, `Controller`, `zodResolver` ni imports de `zod`. Los 3 formularios son 100% `useState`. |
| "RHF está pagando peso en el bundle" | Falso. Una dependencia nunca importada no entra al bundle. Está en `node_modules`, no en el build. |
| "DataTable tiene 5 consumidores" | Son **4**. El quinto hit del grep era el propio fichero. |

---

## 2. Los componentes

### 2.1 `AsyncCombobox`

**Evidencia.** `metadata-form/src/react/fieldassist/SuggestionBox.tsx:36-119`, consumido por
`ReferenceField` (`defaultWidgets.tsx:105-134`) para campos `sh:class`. La implementación
actual, sobre `downshift`, tiene cuatro defectos verificados:

- El debounce de 250 ms está sobre el **commit al grafo**, no sobre la búsqueda:
  `loadItems` se dispara en cada pulsación (`onInputValueChange`, línea 68).
- **Sin estado de loading** — no hay flag ni spinner.
- **Sin estado empty** — `open = isOpen && items.length > 0`, con 0 resultados el panel
  desaparece en silencio.
- **Error tragado** — `catch(() => setItems([]))`, sin mensaje. Y sin cleanup al desmontar:
  la petición en vuelo no se aborta.

**Decisión.** No se construye desde cero. Ark 5.37.2 trae `useAsyncList`
(`@ark-ui/react/collection`, verificado en el árbol instalado), que resuelve todo salvo el
debounce: `load({signal, filterText, cursor, sortDescriptor})`, `AbortController` interno,
guarda de secuencia contra race conditions, y `loading` / `empty` / `hasMore` / `error` +
`abort()` / `reload()` / `loadMore()` / `setFilterText()`.

`AsyncCombobox` = nuestro `combobox` + `useAsyncList` + un `useDebouncedValue` propio.

**API.**

```tsx
export interface AsyncComboboxProps<T> {
  /** Fetch items for the current query. Receives Ark's AbortSignal. */
  load: (args: { filterText: string; signal?: AbortSignal }) => Promise<T[]>;
  value?: string | null;
  onValueChange?: (value: string | null) => void;
  itemToValue: (item: T) => string;
  itemToLabel: (item: T) => string;
  /** Debounce before hitting `load`. Default 250. */
  debounce?: number;
  /** Minimum input length before querying. Default 1. */
  minChars?: number;
  /** Accept free text not present in the results (IRI entry). Default false. */
  allowCustomValue?: boolean;
  renderItem?: (item: T) => React.ReactNode;
  emptyMessage?: React.ReactNode;
  errorMessage?: (error: Error) => React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
}
```

**Notas.** `allowCustomValue` es lo que preserva el caso "escribe un IRI que no está en el
vocabulario". El debounce va sobre la query, **no** sobre el commit: el commit al grafo es
responsabilidad del consumidor (`useCommit` sigue viviendo en metadata-form).

**Tamaño estimado:** ~110 LOC. **Riesgo:** bajo.

---

### 2.2 `FieldArray`

**Evidencia.** `metadata-form/src/react/form/FieldRenderer.tsx:105-158`. El patrón es
"N filas + ✕ por fila + `+ Add` + respeta `maxCount`", pero tiene una sutileza que un
rediseño ingenuo rompe, documentada en el propio código (líneas 107-111):

> Las filas "pending" son solo de UI (no existen en el grafo). Su `key` **debe coincidir**
> con la que tendrá el slot al materializarse (`${field.id}#${i}`). Si difiere, el primer
> commit cambia la key → React remonta el input → **se pierde foco y caret**.

Otros hechos: `minCount` **no** se aplica en la UI (solo pinta el asterisco); no hay
reordenar filas (cero ocurrencias de drag/sortable en el repo); los errores son a nivel de
campo, no de fila (se propagan a todas via `invalid`).

**Decisión.** Se construye. No existe en Ark ni en Shark. La clave del diseño es que **el
consumidor es dueño de la identidad de fila** — por eso `rowKey` es una prop obligatoria y
no un índice implícito.

**API.**

```tsx
export interface FieldArrayProps {
  /** Number of rows to render (real + pending — the consumer decides). */
  count: number;
  /** Stable key per row. Critical: must match the key the row will have once
   *  committed, or the first commit remounts the input and drops focus. */
  rowKey: (index: number) => string;
  children: (index: number) => React.ReactNode;
  onAdd: () => void;
  onRemove: (index: number) => void;
  /** Hides `+ Add` when false (e.g. maxCount reached, or read-only). */
  canAdd?: boolean;
  /** Hides every ✕ when false. */
  canRemove?: boolean;
  addLabel?: React.ReactNode;   // default "Add"
  removeLabel?: string;         // aria-label per row, default "Remove"
  orientation?: "vertical" | "horizontal";  // row alignment: center vs start
}
```

**Notas.** `orientation` cubre la diferencia real entre el caso plano (`align="center"`) y
el anidado con `NodeForm` (`align="start"`). El componente no sabe nada de cardinalidad:
`canAdd` es la proyección de `maxCount` que hace el consumidor.

**Tamaño estimado:** ~70 LOC. **Riesgo:** bajo, pero el `rowKey` debe documentarse con el
porqué o alguien lo "simplificará" a índice y romperá el foco.

---

### 2.3 `DataTable`

**Evidencia.** `keasy/web/src/components/ui/data-table.tsx` (332 LOC), 4 consumidores.
Las 6 props se pasan en los 4 sitios, sin excepción. Y hay tres features muertas:

- **Column visibility**: el dropdown "Columns" se renderiza siempre, ningún consumidor lo
  configura, y lista los `column.id` crudos — el menú dice literalmente `auth_method`,
  `created_at`. Feature no pedida con UX degradada.
- **Row selection**: los 4 incluyen `selectColumn()`, pero **nadie lee `rowSelection`**. No
  hay bulk actions ni callback. El único efecto visible es el texto `{n} selected`.
- **Empty state interno** (`"No results."`): inalcanzable — los 4 cortan antes con
  `length === 0` y un `<EmptyState>` propio.

Cero uso de: server-side, multi-sort, expansión, agrupación, faceting, `pageSize`
configurable, sorting inicial. El único `filterFn` custom (jobs, columna `status`) **no
tiene UI que lo dispare** — también es código muerto.

**Decisión.** Entra al DS bajo el subpath **`@kanzo-tech/ui/table`**, con
`@tanstack/react-table` como **peer opcional** — mismo precedente que `/editor` con
CodeMirror. Así el barrel raíz no paga nada y el presupuesto de tamaño no se toca.

Se conserva la API `ColumnDef` (cero churn en los 4 consumidores, que ya escriben columnas
así). Se **borran** visibility, selection y el empty interno.

**API.**

```tsx
export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Enables the toolbar search input, filtering on this column id. */
  searchKey?: string;
  searchPlaceholder?: string;
  onRowClick?: (row: TData) => void;
  toolbarActions?: React.ReactNode;
  /** Rows per page. Default 20. Pagination hides itself below one page. */
  pageSize?: number;
  /** Rendered in place of the table body when `data` is empty. */
  empty?: React.ReactNode;
}
```

Helpers que se mantienen (los 4 los usan): `sortableHeader(label)`, `actionsColumn(render)`.
`selectColumn()` **no se porta** — nadie lee la selección.

**Simplificación medida:** ~332 → ~180 LOC.

**Nota de diseño.** La paginación hoy se renderiza siempre, incluso con 3 filas. En el DS se
oculta cuando hay una sola página.

**Riesgo:** medio. Es la primera dep pesada del sistema, aunque sea opcional y fuera del
barrel. Alternativa considerada y descartada: reimplementar sort+filter+paginate a mano
(~50 LOC) — se descartó porque obligaría a reescribir las definiciones de columnas de los
4 consumidores, que es churn sin ganancia.

---

### 2.4 `CardRadioGroup`

**Evidencia.** Cuatro implementaciones del mismo patrón en keasy:

| Fichero | LOC | Base | Controlado |
|---|---:|---|---|
| `shared/radio-card-group.tsx` | 84 | `RadioGroup` | sí |
| `jobs/mode-picker.tsx` | 33 | `ToggleGroup` | **no** |
| `connections/connection-editor.tsx:185-205` | ~20 | a mano | — |
| `jobs/step-config.tsx:86-98` | ~13 | a mano | — |

5 invocaciones de `RadioCardGroup`, 1 de `ModePicker`, 2 sitios a mano. Demanda probada de
sobra. Tres defectos concretos del actual:

- `grid-cols-3` **hardcodeado** (`radio-card-group.tsx:40`).
- El `badge` solo se renderiza **si la opción está disabled** (`:74`) — acoplamiento
  arbitrario.
- **No soporta `description` por opción** — que es exactamente por lo que los otros dos
  sitios están escritos a mano.

**Decisión.** Uno solo, sobre Ark `RadioGroup` (accesible), que reemplaza los cuatro.

**API.**

```tsx
export interface CardRadioOption {
  value: string;
  label: React.ReactNode;
  /** Secondary line. Its absence is why two call sites are hand-rolled today. */
  description?: React.ReactNode;
  /** Pre-rendered icon — the DS never imports an icon library. */
  icon?: React.ReactNode;
  /** Free of the current coupling to `disabled`. */
  badge?: React.ReactNode;
  /** Arbitrary preview node — collapses previewText/ClassName/Style into one. */
  preview?: React.ReactNode;
  disabled?: boolean;
}

export interface CardRadioGroupProps {
  options: readonly CardRadioOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  /** Grid columns. Default "auto" (fits by min width). Was hardcoded to 3. */
  columns?: number | "auto";
  /** Layout inside each card. Default "vertical". */
  orientation?: "vertical" | "horizontal";
  name?: string;
  disabled?: boolean;
}
```

**Notas.** `preview?: ReactNode` colapsa tres props (`previewText`, `previewClassName`,
`previewStyle`) en una — y de paso saca del componente los `style` inline, que
`CONVENTIONS.md` prohíbe para apariencia.

**Sustituye:** 84 + 33 + ~33 a mano = **~150 LOC** en keasy por ~110 en el DS.

---

### 2.5 `StatCard`

**Evidencia.** `keasy/web/src/components/shared/summary-card.tsx` (58 LOC), 5 invocaciones
en dos dashboards. Tres cosas a arreglar al promover:

- **`href` es obligatorio** y el `<Link>` incondicional — no hay variante no clicable.
- **El loading es implícito**: `value === undefined` activa el skeleton. Los 5 sitios
  escriben `value={loading ? undefined : ...}`, que es un idiom que hay que adivinar.
- **Usa paleta cruda**: `bg-green-500/10`, `text-amber-500`. Esto **viola** la regla de
  `CONVENTIONS.md` ("sin paleta cruda `bg-slate-700` en componentes"). El DS ya tiene
  tokens `--success` y `--warning`.

**API.**

```tsx
export interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  /** Token-backed, replaces the raw-palette `ok?: boolean` tri-state. */
  status?: "neutral" | "success" | "warning" | "danger";
  /** Explicit, replaces the `value === undefined` convention. */
  loading?: boolean;
  /** Optional — the card is a plain surface when absent. */
  href?: string;
  linkComponent?: LinkComponent;
}
```

**Tamaño estimado:** ~70 LOC.

---

### 2.6 `SecretField`

**Evidencia.** `keasy/web/src/components/ui/secret-input.tsx` (24 LOC), 2 invocaciones. La
semántica "vacío = conservar el actual" está trazada de punta a punta: el cliente envía
`""`, y el servidor Rust lo interpreta (`server/src/settings/routes.rs:143-152` y
`server/src/cloud/db.rs:125-129`). Es un patrón genuinamente genérico de edición de
credenciales.

**Decisión.** Adoptar el `password-input` de Shark (102 LOC, trae el toggle de revelar) y
añadir encima la semántica de valor almacenado. Adopt + extend, no construir.

**API.**

```tsx
export interface SecretFieldProps
  extends Omit<InputProps, "type" | "autoComplete"> {
  /** A secret already exists server-side; the field renders empty and submitting
   *  it empty means "keep the current value". */
  hasStoredValue?: boolean;
  storedPlaceholder?: React.ReactNode;  // default "Leave empty to keep current"
  revealable?: boolean;                 // default true, from Shark's password-input
}
```

**Dos bugs de producto encontrados por el camino** (no son del DS, van a keasy):

1. `cloud-account-form.tsx:159` pasa `hasStoredValue={isEdit}` a secas — **asume** que hay
   secreto por el hecho de estar editando, sin consultar al backend. El caso AI sí lo hace
   bien (`isEdit && !!provider?.api_key`, con el backend devolviendo `"••••"`).
2. `cloud-account-form.tsx:94-96`: `isDirty` en modo edición **solo mira el nombre**. Editar
   un campo secreto no marca el formulario como sucio, pese a que sí se envía y sí se
   persiste. `UnsavedChangesGuard` no protege esos cambios.

---

### 2.7 `LanguagePicker`

**Evidencia.** `metadata-form/src/react/widgets/LanguagePicker.tsx` (179 LOC). Verificado
**100% domain-free**: cero imports de RDF, de `FormModel`, de `GraphState` o de los
vocabularios SHACL. Su API es `value: string` / `onChange(tag: string)` sobre tags BCP-47
planos. Lo específico de SHACL vive fuera, en el adaptador `LangField`.

Único acoplamiento: `type PickerStrings = Strings["languagePicker"]`, un tipo estructural
del catálogo i18n de metadata-form. Se sustituye por una interfaz local de 5 campos con
defaults en inglés (que ya existen: `DEFAULT_STRINGS`).

**Decisión.** Promover — **pero reconstruyendo el chrome sobre nuestro `combobox`**. El
actual implementa a mano `ArrowDown` / `ArrowUp` / `Enter` y el highlight activo
(líneas 100-109), que es exactamente el "reinventar teclado" que `CONVENTIONS.md` prohíbe.
Sobre `combobox` eso desaparece y se gana la a11y de Ark.

**API.**

```tsx
export interface LanguagePickerProps {
  value: string;
  onChange: (tag: string) => void;
  /** Constrains the list and disables free BCP-47 entry when non-empty. */
  allowed?: string[];
  disabled?: boolean;
  invalid?: boolean;
  strings?: LanguagePickerStrings;
}
```

**Se conserva** el endónimo vía `new Intl.DisplayNames([tag], { type: "language" })` — el
locale de resolución es el propio tag, por eso sale "Español" y no "Spanish". Y el fallback
al tag crudo cuando el runtime no sabe nombrarlo.

**Tamaño estimado:** 179 → ~120 LOC al apoyarse en `combobox`.

---

### 2.8 `ComingSoon`

**Evidencia.** `keasy/web/src/components/shared/coming-soon.tsx` (33 LOC), 2 invocaciones.
No es un badge: es un **decorador de disponibilidad** — envuelve `children`, los atenúa
(`opacity-50`) y los **desactiva** (`pointer-events-none`). Tiene efecto funcional.

Dato: las 2 invocaciones pasan `placement="inline"`. El default (`"absolute"`) **nunca se
ejercita**. El default debe invertirse.

**API.**

```tsx
export interface ComingSoonProps {
  children: React.ReactNode;
  label?: React.ReactNode;                   // default "Coming soon"
  placement?: "inline" | "corner";           // default "inline"
  className?: string;
}
```

**Tamaño estimado:** ~35 LOC.

---

### 2.9 `Badge size="xs"` — variante, no componente

**Evidencia.** El mismo string de micro-badge está copiado tres veces:

```
coming-soon.tsx:25        "text-[10px] px-1.5 py-0 h-5 shrink-0 absolute"
experimental-badge.tsx:9  "text-[10px] px-1.5 py-0 h-5 gap-1"
radio-card-group.tsx:75   "text-[10px] px-1.5 py-0"
```

**Decisión.** Una variante `size="xs"` en el `badge` existente. No es un componente nuevo.

---

### 2.10 `UnsavedChangesDialog` — promoción **parcial**, con rediseño

**Evidencia.** `keasy/web/src/components/shared/unsaved-changes-guard.tsx` (99 LOC), 7
invocaciones en 4 ficheros. Es el candidato más atractivo y el más peligroso: usa tres
canales (`beforeunload`, monkey-patch de `history.pushState`/`replaceState`, y `popstate`),
y tiene problemas estructurales verificables:

- **El patch de `history` es global y no reentrante.** `job-editor.tsx` renderiza 4
  instancias en ramas distintas; si dos coexistieran, la segunda parchearía sobre la
  primera y el cleanup restauraría una referencia **ya parcheada**.
- El cleanup asigna incondicionalmente, sin comprobar que `history.pushState` siga siendo
  su propio patch.
- `isDirtyRef.current = isDirty` (línea 17) es una **escritura durante el render**.
- No intercepta navegaciones fuera del History API (`window.location.href = …`).

**Decisión.** **No se promueve tal cual.** Parchear `history` globalmente desde una
librería compartida es peor que hacerlo desde una app: multiplica el riesgo por el número
de productos.

Se parte en dos:

- **En el DS**: `UnsavedChangesDialog` (presentación + el canal `beforeunload`, que sí es
  estándar y seguro) y un hook `useUnsavedChanges({ when })` **singleton** — un solo
  listener global por proceso, contando referencias, lo que de paso arregla el bug de las 4
  instancias.
- **En el producto**: la intercepción del router. Es intrínsecamente específica
  (Next.js App Router vs TanStack Router `useBlocker` vs React Router). El DS expone el
  seam; keasy inyecta el adaptador.

**API.**

```tsx
export function useUnsavedChanges(opts: {
  when: boolean;
  /** Product-supplied navigation blocker. Without it, only `beforeunload` guards. */
  blocker?: (proceed: () => void) => () => void;
}): { pending: boolean; confirm: () => void; cancel: () => void };

export interface UnsavedChangesDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: React.ReactNode;        // default "Unsaved changes"
  description?: React.ReactNode;
  confirmLabel?: React.ReactNode; // default "Leave"
  cancelLabel?: React.ReactNode;  // default "Stay"
}
```

**Riesgo:** el más alto del lote. Va al final del plan, no al principio.

---

### 2.11 `@kanzo-tech/ui/form` — la capa de formularios sobre TanStack Form

**Decisión de stack.** `@tanstack/react-form@1.33.2` (v1 estable; peer React 17/18/19; solo
dos dependencias internas, `@tanstack/form-core` y `@tanstack/react-store`). `react-hook-form`
se **borra** de keasy: está declarado y nunca importado.

**Evidencia del problema.** Los 3 formularios de keasy son 100% `useState` manual, con
~102 líneas de boilerplate en 631 líneas de componente, repartidas en siete patrones
literales: 14 declaraciones de estado, 9 bindings `value`/`onChange` idénticos, ~14 `.trim()`
dispersos entre validación y submit, validación como expresión booleana dentro del `disabled`
del botón, `isDirty` calculado a mano campo por campo, `handleSubmit` que reconstruye el
payload, y `useEffect` de sincronización (uno con `eslint-disable exhaustive-deps`).

Y lo más grave: **ningún formulario muestra errores de campo**. La única señal al usuario es
el botón deshabilitado.

**El patrón de referencia.** Tanto Ark (`docs/guides/forms`) como Shark
(`docs/forms/tanstack-form`) documentan el mismo binding crudo — `form.Field` con render
prop, `<Field invalid={...}>`, control cableado a `field.state.value` / `handleChange` /
`handleBlur`, y `<FieldError>`. Son ~8-10 líneas **por campo**, y **Shark no lo envuelve**.

Ahí está nuestra oportunidad. TanStack Form v1 expone `createFormHookContexts` +
`createFormHook`, cuyo propósito literal es que un design system pre-enganche sus componentes
una sola vez. Ese es el seam.

**Arquitectura — tres capas, y ninguna sabe de la de arriba.**

```
producto        useAppForm + campos de dominio
    ↓
/form           binding fino TanStack ← ESTA es la capa nueva
    ↓
@kanzo-tech/ui  primitivas agnósticas de librería de formularios
```

Las primitivas (`Field`, `Input`, `Select`, `FieldArray`, `SecretField`…) **no conocen
TanStack**. Siguen siendo usables a pelo, y metadata-form —que no usa librería de formularios,
porque su fuente de verdad es el grafo RDF— las consume sin arrastrar nada.

**API.**

```tsx
// Una vez por producto.
import { createKanzoForm } from "@kanzo-tech/ui/form";

export const { useAppForm, withForm } = createKanzoForm({
  // Los campos de dominio del producto se fusionan con los nuestros.
  fieldComponents: { ProviderPickerField },
});
```

```tsx
const form = useAppForm({
  defaultValues: { name: "", apiKey: "", maxTokens: undefined },
  validators: { onSubmit: aiProviderSchema },   // zod vía Standard Schema
  onSubmit: ({ value }) => mutation.mutate(value),
});

<form.AppForm>
  <form.AppField name="name">
    {(f) => <f.TextField label="Name" placeholder="e.g. Production Azure" />}
  </form.AppField>

  <form.AppField name="apiKey">
    {(f) => <f.SecretField label="API key" hasStoredValue={isEdit} />}
  </form.AppField>

  <form.UnsavedChanges />
  <form.SubmitButton>Save</form.SubmitButton>
</form.AppForm>
```

**El contrato único.** Todo `*Field` es `FieldChromeProps` + las props de su control. Un solo
idiom aplicado transversalmente, no doce APIs distintas:

```tsx
export interface FieldChromeProps {
  label?: React.ReactNode;
  description?: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  hint?: React.ReactNode;
  className?: string;
}
```

**Campos pre-enganchados:** `TextField`, `TextareaField`, `NumberField`, `SecretField`,
`SelectField`, `NativeSelectField`, `CheckboxField`, `SwitchField`, `RadioCardField`,
`ComboboxField`, `AsyncComboboxField`, `DateField`, `TagsField`, `FileField`, `SliderField`,
`ArrayField`.

**Componentes de formulario:** `SubmitButton` (se suscribe a `canSubmit`/`isSubmitting`),
`ResetButton`, `UnsavedChanges` (se suscribe a `isDirty`), `FormError` (errores de raíz).

**Por qué esto es elegante y no solo más corto.** Ark `Field` propaga `invalid`, `disabled`,
`required` y `readOnly` a los controles anidados **por contexto** — su documentación dice
explícitamente que no hace falta poner `invalid` en el `Input`. Así que el binding solo tiene
que fijar el estado **una vez**, en `Field`, y todo lo de dentro lo hereda. El error se
renderiza siempre, por construcción: es imposible construir un campo que se olvide de mostrar
su error, que es exactamente el bug que hoy tienen los 3 formularios de keasy.

**Lo que el estado derivado de TanStack borra**, sin escribir nada:

| Boilerplate actual | Sustituto |
|---|---|
| `isDirty` a mano, campo por campo (3 variantes distintas) | `form.Subscribe(s => s.isDirty)` |
| Validación dentro del `disabled` del botón (3 variantes) | `canSubmit` |
| `handleSubmit` reconstruyendo el payload + coerciones | `value` tipado |
| `.trim()` disperso ×14 | el schema zod, una vez |
| `useEffect` de sincronización | `defaultValues` + `validators` |

**`ArrayField` — el puente.** TanStack tiene modo array (`mode="array"`, `field.pushValue`,
iteración con `field.state.value.map((_, i) => …)` y subcampos `name={\`items[${i}].prop\`}`).
`ArrayField` cablea eso al `FieldArray` **presentacional** de §2.2 — el mismo componente que
metadata-form usa sin TanStack. Una sola presentación, dos fuentes de estado.

> **Trampa a documentar.** La iteración por índice de TanStack invita a `key={i}`, que es
> exactamente el fallo de remount/pérdida de foco que metadata-form documentó en
> `FieldRenderer.tsx:107-111`. `ArrayField` debe exponer `rowKey` y no aceptar el índice
> desnudo por defecto.

**Distribución:** subpath `@kanzo-tech/ui/form`, `@tanstack/react-form` como **peer opcional**
— mismo patrón que `/editor` con CodeMirror y `/table` con TanStack Table. El barrel raíz no
paga nada.

**Tamaño estimado:** ~380 LOC (16 campos × ~18 + factory + 4 componentes de formulario).

---

## 3. Lo que NO se construye

| Candidato | Por qué no |
|---|---|
| **Un sistema de formularios propio** | `createFormHook` de TanStack es exactamente el seam que necesitábamos. Construir el nuestro sería reinventar comportamiento — la regla 3. Nosotros aportamos la capa de presentación pre-enganchada, que es lo que Shark deja sin hacer. |
| **`primitives/field.tsx`** | **Ya existe** (304 LOC): `Field`, `FieldLabel`, `FieldError`, `FieldDescription`, `FieldRequiredIndicator`, `FieldSet`, `FieldLegend`, sobre Ark `Field`. keasy simplemente no lo usa. Es el cimiento de §2.11, no un hueco. |
| **`ExperimentalBadge`** | Código muerto: cero importaciones en todo keasy. Se borra. |
| **`EmptyState`** | Ya existe en el DS (29 LOC). keasy tiene 13 usos de su copia local: adoptar, no construir. |
| **`selectColumn` / column visibility** | Features muertas del DataTable. No se portan. |
| **Los ~4.500 LOC del registry de Shark** | file-upload, tags-input, pagination, number-input, editable, data-list, clipboard, highlight, json-tree-view, chart… Construirlos sería tirar comportamiento accesible ya vetado para reescribirlo peor. Se traen del registry. |

### El hallazgo que más simplifica

**`FormField` de keasy (30 LOC, 8 consumidores) tiene un bug de accesibilidad**: el
`<Label>` no lleva `htmlFor` y el `children` no recibe `id`. **No hay asociación
label↔control en 8 sitios.** Además no acepta ni renderiza `error` — y ninguno de los 3
formularios muestra errores de campo en absoluto; la única señal al usuario es el botón
deshabilitado.

El `Field` de Ark que ya está en el DS resuelve ambas cosas por construcción. Adoptarlo no
es un refactor cosmético: **arregla accesibilidad rota en 8 pantallas**.

---

## 4. Plan — componentes primero

El orden lo fija la **dependencia técnica**, no el riesgo: los del registry son insumos de
los nuestros (`password-input` → `SecretField`, `pagination` → `DataTable`), y las primitivas
son insumo de la capa `/form`.

### Ola 1 — insumos del registry (fontanería, sin diseño)

Se traen del registry de Shark, se reescriben los imports, se rebrandean a tokens. Cero
diseño: es el mismo procedimiento que ya produjo un 97,2 % de fidelidad.

`password-input` · `pagination` · `number-input` · `tags-input` · `file-upload` ·
`data-list` · `editable` · `clipboard` · `highlight` · `accordion` · `toggle-group` ·
`button-group` · `format`

### Ola 2 — componentes propios

| # | Componente | LOC | Depende de |
|---|---|---:|---|
| 1 | `Badge size="xs"` | ~5 | — |
| 2 | `ComingSoon` | ~35 | `badge` |
| 3 | `StatCard` | ~70 | `card`, `skeleton` |
| 4 | `SecretField` | ~40 | `password-input` (ola 1) |
| 5 | `FieldArray` | ~70 | `button` |
| 6 | `CardRadioGroup` | ~110 | `radio-group` |
| 7 | `AsyncCombobox` | ~110 | `combobox` + `useAsyncList` |
| 8 | `LanguagePicker` | ~120 | `combobox` |
| 9 | `DataTable` → `/table` | ~180 | `table`, `pagination` (ola 1) |

### Ola 3 — la capa `/form`

Va después de la ola 2 porque pre-engancha sus componentes: `SecretField`, `CardRadioGroup`,
`AsyncCombobox` y `FieldArray` son insumos directos de `f.SecretField`, `f.RadioCardField`,
`f.AsyncComboboxField` y `f.ArrayField`.

`createKanzoForm` + 16 campos + 4 componentes de formulario (~380 LOC).

### Ola 4 — `UnsavedChanges`

Deliberadamente al final: es el único de riesgo alto, y su versión `/form`
(`form.UnsavedChanges`, suscrito a `isDirty`) elimina la necesidad de calcular `isDirty` a
mano, que es de donde salen dos de los bugs encontrados en keasy.

### Ola 5 — adopción

keasy primero (ya comparte Tailwind v4 y React 19), metadata-form después (React 18→19,
introducir Tailwind, y quitar `@radix-ui/themes` que es *peer* — o sea **breaking change de
la API pública** de una librería publicada).

### Fontanería pendiente (en paralelo, no bloquea)

Estas cuatro no bloquean los componentes, pero siguen pendientes y conviene no perderlas:

1. Commit inicial de `kanzo-ui` — hoy `main` no tiene **ningún** commit.
2. `size-limit` falla 7× (173,83 kB medidos vs 25 kB) porque mide el barrel con `export *`,
   que arrastra todo Ark. Medir imports representativos y dar al barrel un techo realista.
   **Nota:** las tres deps nuevas van todas en subpaths con peer opcional, así que ninguna
   agrava esta cifra.
3. Tres drifts de documentación: `--kanzo-control-*` (documentado, **cero** ocurrencias),
   `CONVENTIONS.md` → `primitives/Button.tsx` (el fichero es `button.tsx`), y el
   `package.json` raíz que dice "Radix Themes primitives".
4. `pnpm shark:diff` — la fidelidad del 97,2 % no está protegida por ningún mecanismo:
   vendorizamos un snapshot sin registrar versión.

También queda `breadcrumb` (116 LOC compound) del registry, retirando nuestro composite
`Breadcrumbs` prop-driven. Ojo a la colisión: nuestro `BreadcrumbItem` exportado es un **tipo
de datos**; el de Shark es un **componente**.

---

## 5. Verificación

Precondición innegociable, porque hoy la verificación es simbólica: **3 asserts** que
comprueban que `Button`, `KanzoTheme` y `Preferences` son funciones, y un Gallery que
ejercita ~140 de ~380 exports (**37 %**), con **cero hooks y cero recipes**.

Para cada componente nuevo:

1. **Entrada en el Gallery** — es el único sitio donde los bugs del DS salen antes de
   multiplicarse por dos productos.
2. **Test de a11y**, no solo de humo. `CONVENTIONS.md` sostiene que "la accesibilidad viene
   de Ark", pero eso solo es cierto si el wrapper **preserva** lo que Ark da: un
   `forwardRef` perdido o un `asChild` que no se propaga matan la a11y en silencio. Nada lo
   detecta hoy.
3. **Un changeset** por componente.

---

## 6. Balance

| | LOC |
|---|---:|
| Nuevo en el DS — ola 2 | ~740 |
| Nuevo en el DS — ola 3 (`/form`) | ~380 |
| Nuevo en el DS — ola 4 (`UnsavedChanges`) | ~120 |
| Del registry de Shark (olas 1, fontanería) | ~1.900 |
| Borrado en keasy | ~5.570 |
| Borrado en metadata-form | ~1.665 |
| **Neto** | **≈ −5.400** |

El borrado en keasy sube ~100 LOC respecto a la estimación anterior: la capa `/form` se lleva
por delante los ~102 de boilerplate de estado de formulario, y `react-hook-form` sale de las
dependencias.

## 7. Dependencias nuevas

Las tres son de la misma familia y todas entran como **peer opcional en subpath**, siguiendo
el precedente ya establecido por `/editor` con CodeMirror:

| Paquete | Versión | Subpath |
|---|---|---|
| `@tanstack/react-table` | 8.21.3 | `@kanzo-tech/ui/table` |
| `@tanstack/react-form` | 1.33.2 | `@kanzo-tech/ui/form` |

Se **borra** de keasy: `react-hook-form` (declarado, nunca importado).

Un solo proveedor para tabla y formulario mantiene un idiom por caso de uso en lugar de dos
modelos mentales distintos.
