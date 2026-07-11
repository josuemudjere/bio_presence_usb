import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  // Je démarre à undefined pour éviter un faux calcul avant le premier accès navigateur.
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined
  );

  React.useEffect(() => {
    // Le hook s'aligne sur le breakpoint Tailwind mobile pour garder un comportement cohérent.
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
