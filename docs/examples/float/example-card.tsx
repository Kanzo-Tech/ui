import { Badge, Card, CardDescription, CardHeader, CardTitle, Float } from "@kanzo-tech/ui";

// A status tag pinned to a card corner — the "New" / "Coming soon" marker. The card is the
// positioned ancestor (Card is `relative`), so the negative offset lets the badge straddle the edge.
export default function Example() {
  return (
    <Card className="relative w-72">
      <Float className="-end-2 -top-2" placement="top-end">
        <Badge size="xs" variant="info">
          New
        </Badge>
      </Float>
      <CardHeader>
        <CardTitle>Standing bounties</CardTitle>
        <CardDescription>Post work that stays on the board until someone brings it in.</CardDescription>
      </CardHeader>
    </Card>
  );
}
