import { Avatar, AvatarBadge, AvatarFallback } from "@kanzo-tech/ui";
import { LandmarkIcon, UserIcon } from "lucide-react";
import { initialsOf, member } from "@/example/people";

export default function Example() {
  return (
    <div className="flex items-center gap-6">
      <Avatar size="lg">
        <AvatarFallback>{initialsOf(member("ravenna").name)}</AvatarFallback>
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>{initialsOf(member("grieve").name)}</AvatarFallback>
        <AvatarBadge variant="success" />
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>
          <UserIcon />
        </AvatarFallback>
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>
          <LandmarkIcon />
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
