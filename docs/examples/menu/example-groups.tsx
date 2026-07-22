import {
  Button,
  Menu,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="outline">Export</Button>
      </MenuTrigger>

      <MenuContent className="w-48">
        <MenuGroup heading="Serialisations">
          <MenuItem value="turtle">Turtle</MenuItem>
          <MenuItem value="jsonld">JSON-LD</MenuItem>
          <MenuItem value="ntriples">N-Triples</MenuItem>
        </MenuGroup>

        <MenuSeparator />

        <MenuGroup heading="Tabular">
          <MenuItem value="csv">CSV</MenuItem>
          <MenuItem value="parquet">Parquet</MenuItem>
        </MenuGroup>
      </MenuContent>
    </Menu>
  );
}
