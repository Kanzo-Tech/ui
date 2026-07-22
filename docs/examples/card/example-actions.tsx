import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@kanzo-tech/ui";

/** `CardAction` sits in the header, opposite the title; `CardFooter` sits at the bottom. Both
 *  exist because "an action on a card" means two different placements. */
export default function Example() {
  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>aemet.fossil</CardTitle>
        <CardDescription>Weather observations, updated hourly.</CardDescription>
        <CardAction>
          <Badge variant="success">Live</Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="text-muted-foreground text-sm">
        1,204 triples across 61 predicates.
      </CardContent>

      <CardFooter>
        <Button size="sm" variant="outline">
          Export
        </Button>
        <Button size="sm">Open</Button>
      </CardFooter>
    </Card>
  );
}
