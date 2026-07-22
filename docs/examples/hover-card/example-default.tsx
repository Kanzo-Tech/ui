import {
  Avatar,
  AvatarFallback,
  Button,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant="link">@ada</Button>
      </HoverCardTrigger>

      <HoverCardContent>
        <div className="flex gap-3">
          <Avatar>
            <AvatarFallback>AL</AvatarFallback>
          </Avatar>

          <div className="flex flex-col gap-1">
            <p className="font-medium text-sm">Ada Lovelace</p>
            <p className="text-muted-foreground text-sm">
              Maintains the customers and invoices mappings.
            </p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
