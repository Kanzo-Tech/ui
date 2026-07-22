import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Tabs className="w-80" defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="schema">Schema</TabsTrigger>
        <TabsTrigger value="issues">Issues</TabsTrigger>
      </TabsList>

      <TabsContent className="text-muted-foreground text-sm" value="overview">
        1,204 records, last synced 4 minutes ago.
      </TabsContent>
      <TabsContent className="text-muted-foreground text-sm" value="schema">
        12 fields, 3 of them required.
      </TabsContent>
      <TabsContent className="text-muted-foreground text-sm" value="issues">
        No open issues.
      </TabsContent>
    </Tabs>
  );
}
