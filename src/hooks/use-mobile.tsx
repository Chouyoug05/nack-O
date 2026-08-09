import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Safari < 14 (iOS 12) : addListener/removeListener au lieu de addEventListener
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
    } else if (typeof (mql as any).addListener === "function") {
      (mql as any).addListener(onChange);
    }

    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);

    return () => {
      if (typeof mql.removeEventListener === "function") {
        mql.removeEventListener("change", onChange);
      } else if (typeof (mql as any).removeListener === "function") {
        (mql as any).removeListener(onChange);
      }
    };
  }, []);

  return !!isMobile;
}

/** Tablette = entre mobile et desktop (768px-1024px) */
export function useIsTablet() {
  const [isTablet, setIsTablet] = React.useState(false);

  React.useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setIsTablet(w >= MOBILE_BREAKPOINT && w < TABLET_BREAKPOINT);
    };
    check();

    const mqlMobile = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const mqlTablet = window.matchMedia(`(max-width: ${TABLET_BREAKPOINT - 1}px)`);
    const onChange = () => check();

    if (typeof mqlMobile.addEventListener === "function") {
      mqlMobile.addEventListener("change", onChange);
      mqlTablet.addEventListener("change", onChange);
    } else if (typeof (mqlMobile as any).addListener === "function") {
      (mqlMobile as any).addListener(onChange);
      (mqlTablet as any).addListener(onChange);
    }

    return () => {
      if (typeof mqlMobile.removeEventListener === "function") {
        mqlMobile.removeEventListener("change", onChange);
        mqlTablet.removeEventListener("change", onChange);
      } else if (typeof (mqlMobile as any).removeListener === "function") {
        (mqlMobile as any).removeListener(onChange);
        (mqlTablet as any).removeListener(onChange);
      }
    };
  }, []);

  return isTablet;
}
