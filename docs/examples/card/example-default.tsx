import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>customers.ttl</CardTitle>
        <CardDescription>1,204 triples · updated 2h ago</CardDescription>
      </CardHeader>
      <CardContent>Mapped to the Customer shape.</CardContent>
    </Card>
  );
}
