import { Avatar, AvatarFallback, Status } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="relative w-fit">
      <Avatar size="md">
        <AvatarFallback>AL</AvatarFallback>
      </Avatar>
      {/* The ring-2 in the recipe is the background colour, so the dot punches a hole in
          whatever it overlaps rather than sitting flat on it. */}
      <Status
        className="absolute right-0 bottom-0"
        size="lg"
        variant="success"
      />
    </div>
  );
}
