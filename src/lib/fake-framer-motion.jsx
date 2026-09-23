import React from 'react';

/**
 * @typedef {Object} MotionProps
 * @property {Object} [initial]
 * @property {Object} [animate]
 * @property {Object} [exit]
 * @property {Object} [transition]
 * @property {Object} [whileHover]
 * @property {Object} [whileTap]
 * @property {boolean|string} [layout]
 * @property {string} [layoutId]
 * @property {Object} [variants]
 * @property {React.CSSProperties} [style]
 * @property {*} [custom]
 * @property {boolean|string} [drag]
 * @property {Object} [dragConstraints]
 * @property {Object} [whileInView]
 * @property {Object} [viewport]
 */

// Elements de tableau et de SVG : pas d'animation d'entree (mise en page).
const BALISES_SANS_ANIMATION = new Set(["tr", "td", "th", "tbody", "thead", "table", "svg", "path"]);

const createMotionComponent = (Tag) => {
  return React.forwardRef(
    /**
     * @param {MotionProps & Record<string, any>} props
     * @param {React.Ref<any>} ref
     */
    ({ initial, animate, exit, transition, whileHover, whileTap, layout, layoutId, variants, style, custom, drag, dragConstraints, whileInView, viewport, ...props }, ref) => {
    // Les proprietes framer-motion sont retirees ; une entree (initial/animate)
    // devient un fondu CSS (tailwindcss-animate), coupe par « motion-safe »
    // quand l'utilisateur demande moins d'animations. Sans cela, toutes les
    // animations de l'app etaient silencieusement supprimees.
    const entre = initial && typeof initial === "object" && !BALISES_SANS_ANIMATION.has(Tag);
    const decale = entre && typeof initial.y === "number" && initial.y !== 0;
    const classe = entre
      ? [props.className, "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300", decale ? "motion-safe:slide-in-from-bottom-2" : ""].filter(Boolean).join(" ")
      : props.className;
    return <Tag ref={ref} style={style} {...props} className={classe} />;
  });
};

export const motion = {
  div: createMotionComponent('div'),
  span: createMotionComponent('span'),
  h1: createMotionComponent('h1'),
  h2: createMotionComponent('h2'),
  h3: createMotionComponent('h3'),
  p: createMotionComponent('p'),
  button: createMotionComponent('button'),
  ul: createMotionComponent('ul'),
  li: createMotionComponent('li'),
  a: createMotionComponent('a'),
  svg: createMotionComponent('svg'),
  path: createMotionComponent('path'),
  section: createMotionComponent('section'),
  article: createMotionComponent('article'),
  main: createMotionComponent('main'),
  header: createMotionComponent('header'),
  footer: createMotionComponent('footer'),
  nav: createMotionComponent('nav'),
  tr: createMotionComponent('tr'),
  td: createMotionComponent('td'),
  th: createMotionComponent('th'),
  tbody: createMotionComponent('tbody'),
  thead: createMotionComponent('thead'),
  table: createMotionComponent('table'),
};

/**
 * @param {{ children?: React.ReactNode, mode?: 'sync'|'wait'|'popLayout', initial?: boolean }} props
 */
export const AnimatePresence = ({ children }) => {
  return <>{children}</>;
};
