"use client";

import { LandmarkIcon } from "lucide-react";
import {
  AvatarFallback,
  SidebarIdentity,
  SidebarIdentityAvatar,
  SidebarIdentityDescription,
  SidebarIdentityIcon,
  SidebarIdentityLabel,
  SidebarIdentityText,
} from "@kanzo-tech/ui";
import { initialsOf, VIEWER } from "@/example/people";

/**
 * Shown as specimens in the standard framed preview — this is the shared sub-part
 * `SidebarUser` and `InstanceSwitcher` are built from, not a shell, so it is presented like a
 * simple. The point of the page is the two SHAPES it takes: a round avatar for a person, a
 * square tile for a hall.
 */
export default function Example() {
  return (
    <div className="flex w-64 flex-col gap-4">
      {/* The avatar takes the real `Avatar` parts as children, so an image, initials, a badge
          or a presence dot are all available — not just a URL plus a fallback. */}
      <SidebarIdentity>
        <SidebarIdentityAvatar>
          <AvatarFallback>{initialsOf(VIEWER.name)}</AvatarFallback>
        </SidebarIdentityAvatar>
        <SidebarIdentityText>
          <SidebarIdentityLabel>{VIEWER.name}</SidebarIdentityLabel>
          <SidebarIdentityDescription>{VIEWER.email}</SidebarIdentityDescription>
        </SidebarIdentityText>
      </SidebarIdentity>

      {/* `SidebarIdentityIcon` swaps the round avatar for a square brand tile — the shape that
          reads as a hall or an org rather than a person. */}
      <SidebarIdentity>
        <SidebarIdentityIcon>
          <LandmarkIcon />
        </SidebarIdentityIcon>
        <SidebarIdentityText>
          <SidebarIdentityLabel>Amber Hall</SidebarIdentityLabel>
          <SidebarIdentityDescription>Chartered</SidebarIdentityDescription>
        </SidebarIdentityText>
      </SidebarIdentity>
    </div>
  );
}
