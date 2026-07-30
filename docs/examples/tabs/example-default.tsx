import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Tabs className="w-80" defaultValue="terms">
      <TabsList>
        <TabsTrigger value="terms">Terms</TabsTrigger>
        <TabsTrigger value="party">Party</TabsTrigger>
        <TabsTrigger value="notes">Field notes</TabsTrigger>
      </TabsList>

      <TabsContent className="text-muted-foreground text-sm" value="terms">
        Grade 5 — a writ. Six days overdue.
      </TabsContent>
      <TabsContent className="text-muted-foreground text-sm" value="party">
        Dagfinn Roe, warden. Solveig Marsh, sapper. No cantor.
      </TabsContent>
      <TabsContent className="text-muted-foreground text-sm" value="notes">
        Basilisks keep to quarries and cut stone. This one knows the route.
      </TabsContent>
    </Tabs>
  );
}
