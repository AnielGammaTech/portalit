import { useEffect, useRef } from 'react';
import { useSpring, useTransform, motion, useMotionValue } from 'framer-motion';

/**
 * Animated number counter — counts up from 0 to target value.
 * Inspired by HeroUI dashboard stat counters.
 *
 * @param {number} value - Target number to count to
 * @param {number} duration - Animation duration in seconds (default 1)
 * @param {string} className - Additional CSS classes
 */
export function AnimatedCounter({ value = 0, duration = 1, className = '' }) {
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    duration: duration * 1000,
    bounce: 0,
  });
  const displayValue = useTransform(springValue, (v) => Math.round(v));
  const ref = useRef(null);

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  useEffect(() => {
    const unsubscribe = displayValue.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = latest.toLocaleString();
      }
    });
    return unsubscribe;
  }, [displayValue]);

  return <motion.span ref={ref} className={className}>0</motion.span>;
}
