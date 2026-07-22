import { Heading } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-col gap-3">
      {/* An h1 that looks small: the tag is the document outline, `size` is the type scale. */}
      <Heading as="h1" size="sm">
        h1, rendered at the small size
      </Heading>
      <Heading as="h3" size="2xl" weight="bold">
        h3, rendered at the largest size
      </Heading>
    </div>
  );
}
