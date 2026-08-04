import { Link } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <Link href="#">Q-1058 — A basilisk, and it knows the route</Link>
      <Link href="#" variant="subtle">
        Ashfall Reach
      </Link>
      <span>
        Posted by{" "}
        <Link href="#" variant="plain">
          Ash &amp; Company
        </Link>
        , which is the hall that takes the worst work.
      </span>
    </div>
  );
}
