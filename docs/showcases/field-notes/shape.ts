// The seven columns of the sighting ledger, declared ONCE as a SHACL node shape.
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
// CASE. `sh:name` is sentence case, not the spaced capitals the hall's press puts on the paper.
// The slip is uppercase because a hand press had one case; a column header is ours to write, and
// seven shouted words across a header row is a wall rather than a list. The VALUES keep whatever
// the paper had — those are read, not authored.
//
// `sh:description` is what tells the model which value is which. Without it the shape says a slip
// has a `bounty` but not that it is the gold PAID rather than the standing rate for the beast —
// and the hall's own board prints both. Every description below exists to close one such
// ambiguity on the paper.

export const SLIP_SHAPE = `@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix gs:   <https://kanzo.tech/ns/sighting#> .

gs:SightingSlipShape a sh:NodeShape ;
  sh:targetClass gs:SightingSlip ;
  sh:property [
    sh:path gs:date ;
    sh:name "Date" ;
    sh:description "The date the hall filed the slip, printed under the number. Not the date of the sighting itself, which the hunters rarely write down." ;
    sh:order 1 ;
    sh:datatype xsd:date ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "Every slip carries the date it was filed." ;
  ] ;
  sh:property [
    sh:path gs:slip ;
    sh:name "Slip no." ;
    sh:description "The twelve digits printed after «No.» at the head of the slip. It is not the bounty warrant number, which is also long." ;
    sh:order 2 ;
    sh:datatype xsd:string ;
    sh:pattern "^[0-9]{12}$" ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "A slip number is twelve digits." ;
  ] ;
  sh:property [
    sh:path gs:beast ;
    sh:name "Beast" ;
    sh:description "What was seen. NOT printed: written in ink in the field, and it must be one of the bestiary's eight — a hunter's spelling is not." ;
    sh:order 3 ;
    sh:datatype xsd:string ;
    sh:in ( "Wyrm" "Basilisk" "Grimalkin" "Bog-hound" "Harpy" "Revenant" "Mimic" "Stoneback" ) ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "The bestiary knows eight, spelled its own way." ;
  ] ;
  sh:property [
    sh:path gs:observer ;
    sh:name "Observer" ;
    sh:description "Who reported it. NOT printed: written in ink beside the beast, usually a full name from the hall's roster." ;
    sh:order 4 ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "Who reported it. Written in ink on the slip." ;
  ] ;
  sh:property [
    sh:path gs:verdict ;
    sh:name "Verdict" ;
    sh:description "What the warden made of it. NOT printed: written in ink when the slip is settled, and many slips are never settled at all." ;
    sh:order 5 ;
    sh:datatype xsd:string ;
    sh:in ( "confirmed" "disputed" "hoax" ) ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "Only confirmed, disputed or hoax." ;
  ] ;
  sh:property [
    sh:path gs:bounty ;
    sh:name "Bounty" ;
    sh:description "The gold actually PAID, printed at the foot beside «Bounty». Not the standing rate the hall's board prints for that beast." ;
    sh:order 6 ;
    sh:datatype xsd:decimal ;
    sh:minInclusive 0 ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "The gold paid on this slip." ;
  ] ;
  sh:property [
    sh:path gs:leagues ;
    sh:name "Leagues" ;
    sh:description "How far from the nearest road the sighting was, printed as the hall's surveyors measured it. Confirm with the archivist whether this is the road or the hall." ;
    sh:order 7 ;
    sh:datatype xsd:decimal ;
    sh:minInclusive 0 ;
    sh:maxCount 1 ;
    sh:message "Distance from the nearest road." ;
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
@prefix gs:   <https://kanzo.tech/ns/sighting#> .

gs:SightingSlipShape a sh:NodeShape ;
  sh:targetClass gs:SightingSlip ;
  sh:property [
    sh:path gs:date ;
    sh:name "Date" ;
    sh:description "The date the hall filed the slip." ;
    sh:order 1 ;
    sh:datatype xsd:date ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "Every slip carries the date it was filed." ;
  ] ;
  sh:property [
    sh:path gs:slip ;
    sh:name "Slip no." ;
    sh:description "The twelve digits printed after «No.»." ;
    sh:order 2 ;
    sh:datatype xsd:string ;
    sh:pattern "^[0-9]{12}$" ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "A slip number is twelve digits." ;
  ] ;
  sh:property [
    sh:path gs:bounty ;
    sh:name "Bounty" ;
    sh:description "The gold actually paid, printed at the foot." ;
    sh:order 3 ;
    sh:datatype xsd:decimal ;
    sh:minInclusive 0 ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "The gold paid on this slip." ;
  ] .
`;

/** What the strip offers, the way `metadata-form` offers its example shapes. */
export const SHAPES = [
  { id: "slip", label: "Sighting slip — seven columns", source: SLIP_SHAPE },
  { id: "minimal", label: "Minimal — three columns", source: MINIMAL_SHAPE },
] as const;
