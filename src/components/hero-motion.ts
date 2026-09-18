import type { Variants } from "framer-motion";

/**
 * Central motion system
 *
 * Keep all shared animation timing/easing here so the portfolio
 * feels like one coherent interface rather than a collection
 * of unrelated animations.
 */

/* =========================================================
   EASING
   ========================================================= */

export const EASE: [number, number, number, number] = [
  0.16,
  1,
  0.3,
  1,
];

export const EASE_SMOOTH: [number, number, number, number] = [
  0.22,
  1,
  0.36,
  1,
];

export const EASE_STANDARD: [number, number, number, number] = [
  0.2,
  0.8,
  0.2,
  1,
];

/* =========================================================
   DURATIONS
   ========================================================= */

export const FADE_UP_DURATION = 0.65;

export const MOTION_DURATION = {
  micro: 0.18,
  fast: 0.28,
  normal: 0.38,
  reveal: 0.65,
  cinematic: 0.9,
  slow: 1.1,
} as const;

/* =========================================================
   VIEWPORT
   ========================================================= */

export const VIEWPORT = {
  once: true,
  amount: 0.2,
} as const;

export const VIEWPORT_LARGE = {
  once: true,
  amount: 0.3,
} as const;

/* =========================================================
   CONTAINER REVEAL
   =========================================================
   Use on a parent containing several animated children.
 */

export const loadVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.08,
    },
  },
};

/* =========================================================
   FADE
   ========================================================= */

export const fade: Variants = {
  hidden: {
    opacity: 0,
  },

  show: {
    opacity: 1,
    transition: {
      duration: MOTION_DURATION.normal,
      ease: EASE,
    },
  },
};

/* =========================================================
   FADE UP
   ========================================================= */

export const fadeUp: Variants = {
  hidden: {
    opacity: 0,
    y: 22,
  },

  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: FADE_UP_DURATION,
      ease: EASE,
    },
  },
};

/* =========================================================
   FADE UP — SMALL
   ========================================================= */

export const fadeUpSmall: Variants = {
  hidden: {
    opacity: 0,
    y: 12,
  },

  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION_DURATION.normal,
      ease: EASE,
    },
  },
};

/* =========================================================
   FADE UP — LARGE
   ========================================================= */

export const fadeUpLarge: Variants = {
  hidden: {
    opacity: 0,
    y: 42,
  },

  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION_DURATION.reveal,
      ease: EASE,
    },
  },
};

/* =========================================================
   SCALE
   =========================================================
   A more restrained scale than the previous 0.6 → 1.
   This feels more premium and less "pop animation".
 */

export const scaleIn: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.94,
  },

  show: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: MOTION_DURATION.reveal,
      ease: EASE,
    },
  },
};

/* =========================================================
   SCALE REVEAL
   ========================================================= */

export const scaleReveal: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.965,
  },

  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: MOTION_DURATION.reveal,
      ease: EASE,
    },
  },
};

/* =========================================================
   BADGE / STATUS POP
   ========================================================= */

export const badgePop: Variants = {
  hidden: {
    opacity: 0,
    y: 8,
    scale: 0.94,
  },

  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 22,
      mass: 0.7,
    },
  },
};

/* =========================================================
   CLIP REVEAL
   =========================================================
   Excellent for headings and editorial text blocks.
 */

export const clipUp: Variants = {
  hidden: {
    opacity: 0,
    y: 28,
    clipPath: "inset(0 0 100% 0)",
  },

  show: {
    opacity: 1,
    y: 0,
    clipPath: "inset(0 0 0% 0)",
    transition: {
      duration: MOTION_DURATION.reveal,
      ease: EASE,
    },
  },
};

/* =========================================================
   CLIP REVEAL — FAST
   ========================================================= */

export const clipUpFast: Variants = {
  hidden: {
    opacity: 0,
    y: 18,
    clipPath: "inset(0 0 100% 0)",
  },

  show: {
    opacity: 1,
    y: 0,
    clipPath: "inset(0 0 0% 0)",
    transition: {
      duration: MOTION_DURATION.normal,
      ease: EASE,
    },
  },
};

/* =========================================================
   BLUR REVEAL
   =========================================================
   Best used sparingly for premium section entrances.
 */

export const blurReveal: Variants = {
  hidden: {
    opacity: 0,
    y: 18,
    filter: "blur(10px)",
  },

  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: MOTION_DURATION.reveal,
      ease: EASE,
    },
  },
};

/* =========================================================
   SLIDE FROM LEFT
   ========================================================= */

export const slideFromLeft: Variants = {
  hidden: {
    opacity: 0,
    x: -28,
  },

  show: {
    opacity: 1,
    x: 0,
    transition: {
      duration: MOTION_DURATION.reveal,
      ease: EASE,
    },
  },
};

/* =========================================================
   SLIDE FROM RIGHT
   ========================================================= */

export const slideFromRight: Variants = {
  hidden: {
    opacity: 0,
    x: 28,
  },

  show: {
    opacity: 1,
    x: 0,
    transition: {
      duration: MOTION_DURATION.reveal,
      ease: EASE,
    },
  },
};

/* =========================================================
   PROJECT IMAGE REVEAL
   ========================================================= */

export const imageReveal: Variants = {
  hidden: {
    opacity: 0,
    scale: 1.06,
    clipPath: "inset(8% 8% 8% 8% round 16px)",
  },

  show: {
    opacity: 1,
    scale: 1,
    clipPath: "inset(0% 0% 0% 0% round 16px)",
    transition: {
      duration: MOTION_DURATION.cinematic,
      ease: EASE,
    },
  },
};

/* =========================================================
   CARD REVEAL
   ========================================================= */

export const cardReveal: Variants = {
  hidden: {
    opacity: 0,
    y: 26,
    scale: 0.985,
  },

  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: MOTION_DURATION.reveal,
      ease: EASE,
    },
  },
};

/* =========================================================
   CHILD STAGGER
   ========================================================= */

export const staggerVariants: Variants = {
  hidden: {},

  show: {
    transition: {
      staggerChildren: 0.07,
    },
  },
};

/* =========================================================
   SLOW STAGGER
   ========================================================= */

export const cinematicStaggerVariants: Variants = {
  hidden: {},

  show: {
    transition: {
      staggerChildren: 0.11,
      delayChildren: 0.12,
    },
  },
};