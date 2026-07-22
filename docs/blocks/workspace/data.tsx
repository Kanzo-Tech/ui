/** The document open on the canvas — the same fake tenant as the app-shell block. */
export const SAMPLE_MAPPING = `prefix dcat: <http://www.w3.org/ns/dcat#>
prefix dct:  <http://purl.org/dc/terms/>

{ Dataset } := io.rdf("abfss://raw@kanzo/aemet", schema = shex)

Dataset {
  a             dcat:Dataset
  dct:title     .title
  dct:issued    .issued^^xsd:date
  dcat:keyword  .keywords[]
}
`;
