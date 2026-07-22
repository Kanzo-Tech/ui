import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-col gap-8">
      <Tabs defaultValue="preview">
        <TabsList>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
        </TabsList>
        <TabsContent className="text-muted-foreground text-sm" value="preview">
          Default — a filled pill follows the active tab.
        </TabsContent>
        <TabsContent className="text-muted-foreground text-sm" value="code">
          Default — a filled pill follows the active tab.
        </TabsContent>
      </Tabs>

      <Tabs defaultValue="preview">
        <TabsList variant="underline">
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
        </TabsList>
        <TabsContent className="text-muted-foreground text-sm" value="preview">
          Underline — a rule under the active tab.
        </TabsContent>
        <TabsContent className="text-muted-foreground text-sm" value="code">
          Underline — a rule under the active tab.
        </TabsContent>
      </Tabs>
    </div>
  );
}
