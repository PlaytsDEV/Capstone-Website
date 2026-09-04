import { motion } from "framer-motion";

/**
 * Silky cubic-bezier deceleration curve for smooth, visible dissolve transitions.
 */
const EASING = [0.22, 1, 0.36, 1];

const variantsMap = {
  "fade-up": {
    hidden: { opacity: 0, y: 32 },
    visible: { opacity: 1, y: 0 },
  },
  "fade-down": {
    hidden: { opacity: 0, y: -32 },
    visible: { opacity: 1, y: 0 },
  },
  "fade-left": {
    hidden: { opacity: 0, x: -32 },
    visible: { opacity: 1, x: 0 },
  },
  "fade-right": {
    hidden: { opacity: 0, x: 32 },
    visible: { opacity: 1, x: 0 },
  },
  "scale-in": {
    hidden: { opacity: 0, scale: 0.95, y: 16 },
    visible: { opacity: 1, scale: 1, y: 0 },
  },
  zoom: {
    hidden: { opacity: 0, scale: 0.95, y: 16 },
    visible: { opacity: 1, scale: 1, y: 0 },
  },
  "blur-fade": {
    hidden: { opacity: 0, y: 28 },
    visible: { opacity: 1, y: 0 },
  },
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
};

/**
 * ScrollReveal — Hardware-composited scroll reveal engine with smooth opacity fade and 3D translation.
 */
export function ScrollReveal({
  children,
  variant = "fade-up",
  duration = 0.85,
  delay = 0,
  className = "",
  style = {},
  amount = 0.12,
  once = true,
  margin = "0px 0px -40px 0px",
  ...props
}) {
  const chosenVariant = variantsMap[variant] || variantsMap["fade-up"];

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount, margin }}
      variants={chosenVariant}
      transition={{
        duration,
        delay,
        ease: EASING,
      }}
      className={`reveal ${className}`.trim()}
      style={{ willChange: "transform, opacity", ...style }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * ScrollRevealStagger — Coordinates a sequential cascade across child ScrollRevealItem elements.
 */
export function ScrollRevealStagger({
  children,
  staggerDelay = 0.12,
  delayChildren = 0.05,
  className = "",
  style = {},
  amount = 0.12,
  once = true,
  margin = "0px 0px -50px 0px",
  ...props
}) {
  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: delayChildren,
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount, margin }}
      variants={containerVariants}
      className={className}
      style={style}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * ScrollRevealItem — An individual card or element that reveals as part of a staggered cascade.
 */
export function ScrollRevealItem({
  children,
  variant = "fade-up",
  duration = 0.85,
  delay,
  className = "",
  style = {},
  ...props
}) {
  const chosenVariant = variantsMap[variant] || variantsMap["fade-up"];

  const itemTransition = {
    duration,
    ease: EASING,
    ...(delay !== undefined ? { delay } : {}),
  };

  return (
    <motion.div
      variants={{
        hidden: chosenVariant.hidden,
        visible: {
          ...chosenVariant.visible,
          transition: itemTransition,
        },
      }}
      className={`reveal ${className}`.trim()}
      style={{ willChange: "transform, opacity", ...style }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export default ScrollReveal;
