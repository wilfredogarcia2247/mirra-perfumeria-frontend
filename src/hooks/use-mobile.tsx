import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
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

// Tablet en vertical (p. ej. Redmi Pad 2, ~800 px): pantalla táctil, ancha y alta.
// Misma condición que la variante `tabletv` de tailwind.config.ts.
const TABLET_VERTICAL = "(pointer: coarse) and (min-width: 700px) and (max-width: 1023px) and (min-height: 600px)";

export function useIsTabletVertical() {
  // Se lee de entrada para que el menú lateral no aparezca abierto un instante y luego se esconda
  const [esTablet, setEsTablet] = React.useState(() => typeof window !== "undefined" && window.matchMedia(TABLET_VERTICAL).matches);

  React.useEffect(() => {
    const mql = window.matchMedia(TABLET_VERTICAL);
    const onChange = () => setEsTablet(mql.matches);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return esTablet;
}
