"use client";

import { PreferencesSections } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <PreferencesSections namespace="theme" />
    </div>
  );
}
