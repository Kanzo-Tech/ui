import {
  Avatar,
  AvatarFallback,
  Button,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@kanzo-tech/ui";
import { initialsOf, member } from "@/example/people";
import { hall, role } from "@/example/world";

export default function Example() {
  const ravenna = member("ravenna");

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant="link">@{ravenna.handle}</Button>
      </HoverCardTrigger>

      <HoverCardContent>
        <div className="flex gap-3">
          <Avatar>
            <AvatarFallback>{initialsOf(ravenna.name)}</AvatarFallback>
          </Avatar>

          <div className="flex flex-col gap-1">
            <p className="font-medium text-sm">{ravenna.name}</p>
            <p className="text-muted-foreground text-sm">
              {role(ravenna.role).label} · {hall(ravenna.hall).name}. {role(ravenna.role).duty}.
            </p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
