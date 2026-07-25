import { Avatar, AvatarFallback } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex items-end gap-6">
      {(["sm", "md", "lg"] as const).map((size) => (
        <div className="flex flex-col items-center gap-2" key={size}>
          <Avatar size={size}>
            <AvatarFallback>ÁI</AvatarFallback>
          </Avatar>
          <span className="text-muted-foreground text-xs">{size}</span>
        </div>
      ))}
    </div>
  );
}
