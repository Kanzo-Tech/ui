import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Tabs className="w-96" defaultValue="charter" orientation="vertical">
      <TabsList>
        <TabsTrigger value="charter">Charter</TabsTrigger>
        <TabsTrigger value="members">Members</TabsTrigger>
        <TabsTrigger value="heraldry">Heraldry</TabsTrigger>
      </TabsList>

      <TabsContent className="text-muted-foreground text-sm" value="charter">
        Chartered 1194, seat at Thornmarch.
      </TabsContent>
      <TabsContent className="text-muted-foreground text-sm" value="members">
        Seven members, one of them resting.
      </TabsContent>
      <TabsContent className="text-muted-foreground text-sm" value="heraldry">
        A brand and a neutral. Every other colour is derived from the pair.
      </TabsContent>
    </Tabs>
  );
}
