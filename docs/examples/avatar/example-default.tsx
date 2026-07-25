import { Avatar, AvatarBadge, AvatarFallback } from "@kanzo-tech/ui";
import { BuildingIcon, UserIcon } from "lucide-react";

export default function Example() {
  return (
    <div className="flex items-center gap-6">
      <Avatar size="lg">
        <AvatarFallback>ÁI</AvatarFallback>
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>MR</AvatarFallback>
        <AvatarBadge variant="success" />
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>
          <UserIcon />
        </AvatarFallback>
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>
          <BuildingIcon />
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
