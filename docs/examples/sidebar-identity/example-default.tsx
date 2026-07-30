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

/**
 * Two specimens rather than a shell, because the point is the two SHAPES this row takes: a round
 * avatar reads as a person, a square tile reads as a thing. Put a `Menu` around either and you
 * have the sidebar's footer or its header switcher.
 */
export default function Example() {
  return (
    <div className="flex w-64 flex-col gap-4">
      {/* The avatar takes the real `Avatar` parts as children, so an image, initials, a badge
          or a presence dot are all available — not just a URL plus a fallback. */}
      <SidebarIdentity>
        <SidebarIdentityAvatar>
          <AvatarFallback>ÁI</AvatarFallback>
        </SidebarIdentityAvatar>
        <SidebarIdentityText>
          <SidebarIdentityLabel>Ángel Iglesias</SidebarIdentityLabel>
          <SidebarIdentityDescription>angel@kanzo.tech</SidebarIdentityDescription>
        </SidebarIdentityText>
      </SidebarIdentity>

      {/* `SidebarIdentityIcon` swaps the round avatar for a square brand tile — the shape that
          reads as a workspace or org rather than a person. */}
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
