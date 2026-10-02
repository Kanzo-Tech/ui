"use client";

import {
  Diagnostic,
  DiagnosticHeader,
  DiagnosticSeverity,
  DiagnosticTitle,
  type Finding,
  FindingsContent,
  FindingsGroup,
  FindingsRoot,
  FindingsTrigger,
} from "@kanzo-tech/ui";

interface Issue extends Finding {
  message: string;
}

const ISSUES: Issue[] = [
  { id: "title", variant: "destructive", message: "El título es obligatorio." },
  { id: "licence", variant: "warning", message: "La licencia no es una IRI conocida." },
  { id: "keywords", variant: "warning", message: "Conviene al menos una palabra clave." },
];

/** The plural is the locale's, so the count goes through `Intl.PluralRules`, not a trailing "s". */
const plural = new Intl.PluralRules("es");
const incidencias = (n: number) => `${n} ${plural.select(n) === "one" ? "incidencia" : "incidencias"}`;

const WORD = { destructive: "Infracción", warning: "Aviso", info: "Nota" };

const row = (issue: Issue) => (
  <Diagnostic variant={issue.variant}>
    <DiagnosticHeader>
      <DiagnosticSeverity>{WORD[issue.variant]}</DiagnosticSeverity>
      <DiagnosticTitle>{issue.message}</DiagnosticTitle>
    </DiagnosticHeader>
  </Diagnostic>
);

export default function Example() {
  return (
    <FindingsRoot findings={ISSUES}>
      <FindingsTrigger pill>{({ total }) => (total ? incidencias(total) : "Válido")}</FindingsTrigger>
      <FindingsContent description="Lo que la validación encontró en el formulario.">
        <FindingsGroup title="Infracciones" variant="destructive">
          {row}
        </FindingsGroup>
        <FindingsGroup title="Avisos" variant="warning">
          {row}
        </FindingsGroup>
        <FindingsGroup title="Notas" variant="info">
          {row}
        </FindingsGroup>
      </FindingsContent>
    </FindingsRoot>
  );
}
