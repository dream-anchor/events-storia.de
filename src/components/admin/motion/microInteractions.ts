import type { Transition, Variants } from "framer-motion";

/**
 * Apple 2026 Experience: Micro-Interaction Presets
 *
 * Reusable spring configurations and animation presets
 * for consistent, premium motion throughout the admin UI.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Spring Configurations
// ═══════════════════════════════════════════════════════════════════════════

/** Standard Apple-style spring: natural bounce with controlled overshoot */
export const appleSpring: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 30,
  mass: 0.8,
};

/** Snappy spring for quick interactions (buttons, toggles) */
export const snappySpring: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 25,
};

/** Gentle spring for larger elements (modals, sheets) */
export const gentleSpring: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 35,
};

/** Bouncy spring for playful feedback */
export const bouncySpring: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 20,
};

// ═══════════════════════════════════════════════════════════════════════════
// Common Animation Presets
// ═══════════════════════════════════════════════════════════════════════════

/** Tap feedback - instant scale reduction */
export const tapAnimation = {
  scale: 0.97,
  transition: { duration: 0.1 },
};

/** Hover lift - subtle elevation with shadow */
export const liftAnimation = {
  y: -4,
  boxShadow: "0 16px 32px -12px rgba(0, 0, 0, 0.15)",
  transition: snappySpring,
};

/** Breathe effect - subtle scale increase */
export const breatheAnimation = {
  scale: 1.02,
  transition: snappySpring,
};

/** Glow pulse for CTAs (infinite loop) */
export const glowPulseAnimation = {
  boxShadow: [
    "0 0 0 0 rgba(234, 179, 8, 0)",
    "0 0 0 8px rgba(234, 179, 8, 0.2)",
    "0 0 0 0 rgba(234, 179, 8, 0)",
  ],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: "easeInOut",
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Variant Presets (for motion components)
// ═══════════════════════════════════════════════════════════════════════════

/** Fade in from bottom */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: appleSpring,
  },
  exit: {
    opacity: 0,
    y: -12,
    transition: { duration: 0.15 },
  },
};

/** Fade in with scale */
export const fadeInScale: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: appleSpring,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

/** Stagger container */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.1,
    },
  },
};

/** Stagger item */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: appleSpring,
  },
};

/** Slide in from right */
export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: appleSpring,
  },
  exit: {
    opacity: 0,
    x: -24,
    transition: { duration: 0.15 },
  },
};

/** Modal/sheet entrance */
export const modalVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    y: 8,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: gentleSpring,
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 8,
    transition: { duration: 0.15 },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a stagger delay based on index
 * @param index - Item index in list
 * @param baseDelay - Base delay in seconds (default: 0.04)
 */
export const getStaggerDelay = (index: number, baseDelay = 0.04): number =>
  index * baseDelay;

/**
 * Create custom spring with overrides
 */
export const createSpring = (
  overrides: Partial<{
    stiffness: number;
    damping: number;
    mass: number;
  }> = {}
): Transition => ({
  type: "spring",
  stiffness: 380,
  damping: 30,
  mass: 0.8,
  ...overrides,
});
