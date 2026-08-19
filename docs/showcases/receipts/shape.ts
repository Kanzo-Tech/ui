// The seven columns of the fuel ledger, declared ONCE as a SHACL node shape.
//
// Four consumers read this one document and nothing else: the table's columns and their order,
// the JSON schema handed to the vision model, the per-cell validation, and the CSV writer's column
// order and formatting. Published as source text the way `@/example/rules` publishes the Amber
// Hall's standing orders — the panel that shows it and the engine that runs it cannot drift apart,
// because they are the same string.
//
// Nothing here is invented vocabulary. `sh:name`, `sh:description` and `sh:order` are SHACL's
// NON-VALIDATING property shape characteristics, in the Recommendation precisely so a tool can
// render a form or a table from a shape; `metadata-form`'s own HealthDCAT-AP shapes use the same
// three the same way. The one thing this shape does not use is SHACL-UI's `shui:editor`, because
// the control it would name is already implied by `sh:datatype` and `sh:in`.
//
// LANGUAGE. The chrome around this screen is English, like every other showcase. These strings are
// not chrome: `sh:name` becomes a column header in a Spanish accountant's spreadsheet and
// `sh:message` is read by whoever checks a cell against Spanish paperwork, so they are the
// domain's own words, tagged `@es`.
//
// `sh:description` is what tells the model which value is which. Without it the shape says a
// ticket has an `importe` but not that it is the TOTAL rather than the price per litre — and the
// ticket prints both. Every description below exists to close one such ambiguity on the paper.

export const TICKET_SHAPE = `@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix tk:   <https://kanzo.tech/ns/ticket#> .

tk:FuelTicketShape a sh:NodeShape ;
  sh:targetClass tk:FuelTicket ;
  sh:property [
    sh:path tk:fecha ;
    sh:name "FECHA"@es ;
    sh:description "La fecha impresa del repostaje, no la hora ni el número de remesa."@es ;
    sh:order 1 ;
    sh:datatype xsd:date ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "Cada repostaje lleva la fecha del ticket."@es ;
  ] ;
  sh:property [
    sh:path tk:ticket ;
    sh:name "N TICKET"@es ;
    sh:description "El número que sigue a «N. de ticket», al pie. No es el comercio, ni la concesión, ni el número de operación, que también son números largos."@es ;
    sh:order 2 ;
    sh:datatype xsd:string ;
    sh:pattern "^[0-9]{12}$" ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "El número de ticket son doce dígitos."@es ;
  ] ;
  sh:property [
    sh:path tk:matricula ;
    sh:name "MATRÍCULA"@es ;
    sh:description "El vehículo. NO está impreso: va escrito a mano sobre el ticket."@es ;
    sh:order 3 ;
    sh:datatype xsd:string ;
    sh:pattern "^[0-9]{4}[A-Z]{3}$" ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "La matrícula son cuatro dígitos y tres letras, sin espacio."@es ;
  ] ;
  sh:property [
    sh:path tk:driver ;
    sh:name "DRIVER"@es ;
    sh:description "Quién repostó. NO está impreso: va escrito a mano, normalmente un nombre de pila junto a la matrícula. «DRIVERS LEON» es el cliente de la tarjeta, no el conductor."@es ;
    sh:order 4 ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "Quién repostó. Va escrito a mano en el ticket."@es ;
  ] ;
  sh:property [
    sh:path tk:base ;
    sh:name "BASE/ESCOBA"@es ;
    sh:description "Para qué fue el gasto. NO está impreso: va escrito a mano, y muchos tickets no lo llevan."@es ;
    sh:order 5 ;
    sh:datatype xsd:string ;
    sh:in ( "Escoba" "Base" "Lavado" ) ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "Solo Escoba, Base o Lavado."@es ;
  ] ;
  sh:property [
    sh:path tk:importe ;
    sh:name "IMPORTE"@es ;
    sh:description "El TOTAL en euros, el de «Total Venta». No el precio por litro de la columna €/L, ni el número de litros."@es ;
    sh:order 6 ;
    sh:datatype xsd:decimal ;
    sh:minInclusive 0 ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "El importe total del ticket, en euros."@es ;
  ] ;
  sh:property [
    sh:path tk:kilometros ;
    sh:name "KILÓMETROS"@es ;
    sh:description "El cuentakilómetros del vehículo, el que el ticket imprime como «Kilómetros». Confirmar con quien lleva la hoja si es éste o el que se anota aparte."@es ;
    sh:order 7 ;
    sh:datatype xsd:integer ;
    sh:minInclusive 0 ;
    sh:maxCount 1 ;
    sh:message "El cuentakilómetros del vehículo."@es ;
  ] .
`;

/**
 * A second shape, so the strip has something to switch between — and so the claim above is
 * visible rather than argued. It names three of the seven properties, and choosing it drops the
 * other four out of the table, out of the model's schema, out of the validation and out of the
 * CSV, without a line changing anywhere but here.
 */
export const MINIMAL_SHAPE = `@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix tk:   <https://kanzo.tech/ns/ticket#> .

tk:FuelTicketShape a sh:NodeShape ;
  sh:targetClass tk:FuelTicket ;
  sh:property [
    sh:path tk:fecha ;
    sh:name "FECHA"@es ;
    sh:description "La fecha impresa del repostaje."@es ;
    sh:order 1 ;
    sh:datatype xsd:date ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "Cada repostaje lleva la fecha del ticket."@es ;
  ] ;
  sh:property [
    sh:path tk:ticket ;
    sh:name "N TICKET"@es ;
    sh:description "El numero que sigue a «N. de ticket», al pie."@es ;
    sh:order 2 ;
    sh:datatype xsd:string ;
    sh:pattern "^[0-9]{12}$" ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "El numero de ticket son doce digitos."@es ;
  ] ;
  sh:property [
    sh:path tk:importe ;
    sh:name "IMPORTE"@es ;
    sh:description "El TOTAL en euros, el de «Total Venta»."@es ;
    sh:order 3 ;
    sh:datatype xsd:decimal ;
    sh:minInclusive 0 ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "El importe total del ticket, en euros."@es ;
  ] .
`;

/** What the strip offers, the way `metadata-form` offers its example shapes. */
export const SHAPES = [
  { id: "fuel", label: "Fuel ledger — seven columns", source: TICKET_SHAPE },
  { id: "minimal", label: "Minimal — three columns", source: MINIMAL_SHAPE },
] as const;
