import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Tabs className="w-96" defaultValue="general" orientation="vertical">
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="members">Members</TabsTrigger>
        <TabsTrigger value="billing">Billing</TabsTrigger>
      </TabsList>

      <TabsContent className="text-muted-foreground text-sm" value="general">
        Workspace name, description and default locale.
      </TabsContent>
      <TabsContent className="text-muted-foreground text-sm" value="members">
        4 members, 1 pending invitation.
      </TabsContent>
      <TabsContent className="text-muted-foreground text-sm" value="billing">
        Team plan, renews on the 1st.
      </TabsContent>
    </Tabs>
  );
}
