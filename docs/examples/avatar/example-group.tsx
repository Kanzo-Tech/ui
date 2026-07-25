import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <AvatarGroup>
      {["ÁI", "MR", "JD"].map((initials) => (
        <Avatar key={initials}>
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      ))}
      <AvatarGroupCount>+7</AvatarGroupCount>
    </AvatarGroup>
  );
}
