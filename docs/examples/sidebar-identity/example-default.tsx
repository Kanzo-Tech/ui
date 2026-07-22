"use client";

import { BoxesIcon } from "lucide-react";
import {
  AvatarFallback,
  SidebarIdentity,
  SidebarIdentityAvatar,
  SidebarIdentityDescription,
  SidebarIdentityIcon,
  SidebarIdentityLabel,
  SidebarIdentityText,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex w-64 flex-col gap-4">
      <SidebarIdentity>
        {/* The avatar takes the real `Avatar` parts as children, so an image, initials, a
            badge or a presence dot are all available — not just a URL plus a fallback. */}
        <SidebarIdentityAvatar>
          <AvatarFallback>ÁI</AvatarFallback>
        </SidebarIdentityAvatar>
        <SidebarIdentityText>
          <SidebarIdentityLabel>Ángel Iglesias</SidebarIdentityLabel>
          <SidebarIdentityDescription>angel@kanzo.tech</SidebarIdentityDescription>
        </SidebarIdentityText>
      </SidebarIdentity>

      {/* `SidebarIdentityIcon` swaps the round avatar for a square brand tile — the shape
          that reads as a workspace or org rather than a person. */}
      <SidebarIdentity>
        <SidebarIdentityIcon>
          <BoxesIcon />
        </SidebarIdentityIcon>
        <SidebarIdentityText>
          <SidebarIdentityLabel>Kanzo</SidebarIdentityLabel>
          <SidebarIdentityDescription>Owner</SidebarIdentityDescription>
        </SidebarIdentityText>
      </SidebarIdentity>
    </div>
  );
}
