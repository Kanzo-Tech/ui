import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-col gap-8">
      <Tabs defaultValue="terms">
        <TabsList>
          <TabsTrigger value="terms">Terms</TabsTrigger>
          <TabsTrigger value="party">Party</TabsTrigger>
        </TabsList>
        <TabsContent className="text-muted-foreground text-sm" value="terms">
          Default — a filled pill follows the active tab.
        </TabsContent>
        <TabsContent className="text-muted-foreground text-sm" value="party">
          Default — a filled pill follows the active tab.
        </TabsContent>
      </Tabs>

      <Tabs defaultValue="terms">
        <TabsList variant="underline">
          <TabsTrigger value="terms">Terms</TabsTrigger>
          <TabsTrigger value="party">Party</TabsTrigger>
        </TabsList>
        <TabsContent className="text-muted-foreground text-sm" value="terms">
          Underline — a rule under the active tab.
        </TabsContent>
        <TabsContent className="text-muted-foreground text-sm" value="party">
          Underline — a rule under the active tab.
        </TabsContent>
      </Tabs>
    </div>
  );
}
