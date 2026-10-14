"use client";

import {
  type Finding,
  FindingsBadge,
  FindingsContent,
  FindingsGroup,
  FindingsHeader,
  FindingsItem,
  FindingsList,
  FindingsRoot,
  FindingsSource,
  tallyFindings,
} from "@kanzo-tech/ui";

/** A form's place is a field's label. */
const ISSUES: Finding<string>[] = [
  {
    severity: "violation",
    message: "El título es obligatorio.",
    rule: { id: "sh:MinCountConstraintComponent", label: "MinCount" },
    place: "Título",
  },
  {
    severity: "warning",
    message: "La licencia no es una IRI conocida.",
    rule: { id: "sh:InConstraintComponent", label: "In" },
    place: "Licencia",
  },
  {
    severity: "warning",
    message: "Conviene al menos una palabra clave.",
    rule: { id: "sh:MinCountConstraintComponent", label: "MinCount" },
    place: "Palabras clave",
  },
];

/** The plural is the locale's, so the count goes through `Intl.PluralRules`, not a trailing "s". */
const plural = new Intl.PluralRules("es");
const incidencias = (n: number) => `${n} ${plural.select(n) === "one" ? "incidencia" : "incidencias"}`;

const LABELS = {
  title: "Incidencias",
  severity: { violation: "Infracción", warning: "Aviso", info: "Nota" },
  details: "Detalles",
};

const tally = tallyFindings(ISSUES);

export default function Example() {
  return (
    <FindingsRoot translations={LABELS} tally={tally}>
      <FindingsBadge pill>{(t) => (t?.total ? incidencias(t.total) : "Válido")}</FindingsBadge>
      <FindingsContent>
        <FindingsHeader>
          <FindingsSource>conjunto-de-datos.ttl</FindingsSource>
        </FindingsHeader>
        <FindingsList>
          <FindingsGroup tally={tally} title="Conjunto de datos">
            {ISSUES.map((issue) => (
              <FindingsItem
                action={{ label: "Ir al campo", run: () => undefined }}
                describe={(field) => ({ where: field })}
                finding={issue}
                key={issue.place}
              />
            ))}
          </FindingsGroup>
        </FindingsList>
      </FindingsContent>
    </FindingsRoot>
  );
}
