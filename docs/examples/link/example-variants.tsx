import { Link } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <Link href="#">Default</Link>
      <Link href="#" variant="subtle">
        Subtle
      </Link>
      <span>
        Inherits the surrounding colour:{" "}
        <Link href="#" variant="plain">
          plain
        </Link>
      </span>
    </div>
  );
}
