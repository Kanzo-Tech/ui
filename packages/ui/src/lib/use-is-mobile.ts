"use client";

// The directive is not optional here even though the hook is internal: it calls `useState` /
// `useEffect` and registers a `matchMedia` listener. It was contained only by the accident that its
// single importer is a client module, which is one import away from a break.

import React from "react";

const mobileBreakpoint = 768;

export const useIsMobile = () => {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${mobileBreakpoint - 1}px)`);

    const onChange = () => {
      setIsMobile(window.innerWidth < mobileBreakpoint);
    };

    mql.addEventListener("change", onChange);

    setIsMobile(window.innerWidth < mobileBreakpoint);

    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
};
