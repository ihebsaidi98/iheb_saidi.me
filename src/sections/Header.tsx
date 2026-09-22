"use client";

import {
  motion,
  useMotionValueEvent,
  useScroll,
} from "framer-motion";
import { useEffect, useState } from "react";

const navItems = [
  { name: "Home", href: "#top" },
  { name: "Work", href: "#projects" },
  { name: "Experience", href: "#experience" },
  // 'Stack' section maps to the Tape section; ensure anchor exists
  { name: "Stack", href: "#stack" },
  { name: "About", href: "#about" },
  { name: "Contact", href: "#contact" },
] as const;

const EASE = [0.16, 1, 0.3, 1] as const;

export const Header = () => {
  const [active, setActive] = useState("Home");
  const [hidden, setHidden] = useState(false);

  const { scrollY } = useScroll();

  /*
   * ---------------------------------------------------------
   * SCROLL VISIBILITY
   * ---------------------------------------------------------
   *
   * Hide the header while scrolling down, reveal it when
   * scrolling back up.
   */

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() ?? latest;
    const direction = latest - previous;

    if (latest < 80) {
      setHidden(false);
      setActive("Home");
      return;
    }

    if (direction > 0 && latest > 150) {
      setHidden(true);
    } else if (direction < 0) {
      setHidden(false);
    }
  });

  /*
   * ---------------------------------------------------------
   * ACTIVE SECTION
   * ---------------------------------------------------------
   */

  useEffect(() => {
    const sections = navItems
      .map((item) => document.querySelector(item.href))
      .filter((element): element is Element => Boolean(element));

    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              b.intersectionRatio - a.intersectionRatio,
          );

        const current = visibleEntries[0];

        if (!current) return;

        const match = navItems.find(
          (item) => item.href === `#${current.target.id}`,
        );

        if (match) {
          setActive(match.name);
        }
      },
      {
        root: null,
        rootMargin: "-38% 0px -52% 0px",
        threshold: [0, 0.2, 0.5, 0.8],
      },
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  /*
   * ---------------------------------------------------------
   * NAVIGATION
   * ---------------------------------------------------------
   */

  const handleNavigation = (name: string) => {
    setActive(name);
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -18 }}
      animate={{
        opacity: 1,
        y: hidden ? "-150%" : "0%",
      }}
      transition={{
        duration: 0.5,
        ease: EASE,
      }}
      className="fixed inset-x-0 top-3 z-40 flex justify-center px-3 sm:top-4"
    >
      <nav
        aria-label="Primary navigation"
        className="
          group relative flex max-w-full items-center
          overflow-x-auto rounded-full
          border border-white/[0.09]
          bg-[#080d12]/80
          p-1
          shadow-[0_12px_40px_rgba(0,0,0,0.28)]
          backdrop-blur-2xl
          backdrop-saturate-150
          scrollbar-none
        "
      >
        {/* Ambient border glow */}
        <div
          aria-hidden="true"
          className="
            pointer-events-none absolute inset-0
            rounded-full
            bg-gradient-to-r
            from-emerald-300/[0.035]
            via-transparent
            to-sky-400/[0.035]
          "
        />

        {/* Subtle top highlight */}
        <div
          aria-hidden="true"
          className="
            pointer-events-none absolute inset-x-5 top-0
            h-px
            bg-gradient-to-r
            from-transparent
            via-white/15
            to-transparent
          "
        />

        {/* Brand */}
        <span
          className="
            relative hidden shrink-0
            border-r border-white/[0.08]
            px-4
            text-xs font-medium
            tracking-[-0.01em]
            text-white/70
            lg:block
          "
        >
          Iheb Saidi
        </span>

        {/* Navigation */}
        <div className="relative flex items-center gap-0.5">
          {navItems.map((item) => {
            const isActive = active === item.name;

            return (
              <a
                key={item.name}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onClick={() => handleNavigation(item.name)}
                className="
                  relative shrink-0
                  rounded-full
px-3 py-2.5
                  text-xs
                  font-medium
                  tracking-[-0.01em]
                  text-white/50
                  transition-colors
                  duration-200
                  hover:text-white/90
                  focus-visible:text-white
                  sm:px-4
                "
              >
                {isActive && (
                  <motion.span
                    layoutId="active-pill"
                    aria-hidden="true"
                    className="
                      absolute inset-0
                      rounded-full
                      border border-white/[0.06]
                      bg-white/[0.075]
                      shadow-[0_2px_12px_rgba(0,0,0,0.16)]
                    "
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 38,
                      mass: 0.7,
                    }}
                  />
                )}

                {/* Hover surface */}
                <span
                  aria-hidden="true"
                  className="
                    absolute inset-0
                    rounded-full
                    bg-white/[0.035]
                    opacity-0
                    transition-opacity
                    duration-200
                    hover:opacity-100
                  "
                />

                <span className="relative z-10">
                  {item.name}
                </span>
              </a>
            );
          })}
        </div>
      </nav>
    </motion.header>
  );
};