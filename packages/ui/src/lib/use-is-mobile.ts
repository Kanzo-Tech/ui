"use client";

// The directive is not optional here even though the hook is internal: it calls `useState` /
// `useEffect` and registers a `matchMedia` listener. It was contained only by the accident that its
// single importer is a client module, which is one import away from a break.

import React from "react";

// Tailwind's `md`, read off the page so a `md:` class and this hook cannot disagree. Tailwind emits
// the variable because this file names it: `tailwind.css` scans `dist/`.
const BREAKPOINT = "--breakpoint-md";

export const useIsMobile = () => {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined
  );

  React.useEffect(() => {
    const md = getComputedStyle(document.documentElement).getPropertyValue(BREAKPOINT).trim();
    const mql = window.matchMedia(`(width < ${md})`);
    const onChange = () => setIsMobile(mql.matches);

    mql.addEventListener("change", onChange);
    onChange();

    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
};
