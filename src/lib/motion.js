/**
 * Reusable Framer Motion presets matching HeroUI's 250ms ease aesthetic.
 * Import these in any component that needs consistent animation behavior.
 */

// Standard 250ms HeroUI transition
export const heroTransition = {
  duration: 0.25,
  ease: 'easeOut',
};

// Spring transition for tab indicators and layout animations
export const heroSpring = {
  type: 'spring',
  bounce: 0.15,
  duration: 0.5,
};

// Card / element entrance — fades in while sliding up
export const fadeInUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -5 },
  transition: heroTransition,
};

// Stagger container — wraps children that each use fadeInUp
export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

// Stagger child — pair with staggerContainer
export const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: heroTransition,
};

// Panel slide-in from right (drill-in navigation)
export const slideIn = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: heroTransition,
};

// Scale-in pop (badges, toasts, modals)
export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: heroTransition,
};

// HeroUI press animation — apply as whileTap prop
export const pressAnimation = { scale: 0.97 };

// HeroUI hover animation — apply as whileHover prop
export const hoverAnimation = { opacity: 0.8 };

// Tab content transition — cross-fade between tabs
export const tabContentVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};
