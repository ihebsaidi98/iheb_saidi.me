"use client";

import { MotionConfig } from "framer-motion";
import { createContext, useContext, useEffect, useState } from "react";

const A11yModeContext = createContext(false);
type A11yWindow = Window & { __A11Y_READY?: boolean };

export function useA11yMode() {
  return useContext(A11yModeContext);
}

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [a11yMode, setA11yMode] = useState(false);

  useEffect(() => {
    const enabled = new URLSearchParams(window.location.search).has("a11y");
    (window as A11yWindow).__A11Y_READY = false;
    setA11yMode(enabled);
  }, []);

  useEffect(() => {
    if (!a11yMode) return;

    let cancelled = false;
    void document.fonts.ready.then(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) (window as A11yWindow).__A11Y_READY = true;
        });
      });
    });

    return () => {
      cancelled = true;
    };
  }, [a11yMode]);

  return (
    <A11yModeContext.Provider value={a11yMode}>
      <MotionConfig
        reducedMotion={a11yMode ? "always" : "user"}
        transition={a11yMode ? { duration: 0 } : undefined}
      >
        {children}
      </MotionConfig>
    </A11yModeContext.Provider>
  );
}
