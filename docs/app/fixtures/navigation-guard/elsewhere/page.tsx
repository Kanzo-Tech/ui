import { Link } from "@kanzo-tech/navigation/next";

export default function Page() {
  return (
    <div className="flex flex-col gap-4 p-8">
      <h1>Elsewhere</h1>
      <Link href="/fixtures/navigation-guard">To the form</Link>
    </div>
  );
}

export const metadata = { title: "Navigation guard fixture", robots: { index: false } };
