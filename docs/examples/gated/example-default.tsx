import { SearchIcon } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  GatedBadge,
  GatedContent,
  GatedRoot,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@kanzo-tech/ui";
import { archiveScale } from "@/example/archive";

const { contracts, reports } = archiveScale();

export default function Example() {
  return (
    // The visible title is inside the inert content, so it names nothing: the group is named here.
    <GatedRoot aria-label="Search the archive" className="w-full max-w-md">
      <GatedContent>
        <Card>
          <CardHeader>
            <CardTitle>Search the archive</CardTitle>
            <CardDescription>
              {contracts.toLocaleString("en")} settled contracts and{" "}
              {reports.toLocaleString("en")} field reports, by beast, region or party.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput aria-label="Search the archive" placeholder="Revenant, Duskfen…" />
            </InputGroup>
            <Button variant="outline">Search</Button>
          </CardContent>
        </Card>
      </GatedContent>
      <GatedBadge>Coming soon</GatedBadge>
    </GatedRoot>
  );
}
