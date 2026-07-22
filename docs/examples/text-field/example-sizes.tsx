import { TextField } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex w-72 flex-col gap-3">
      {(["sm", "md", "lg"] as const).map((size) => (
        <TextField key={size} placeholder={size} size={size} />
      ))}
    </div>
  );
}
