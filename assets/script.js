/* ADIB ZAMAN — CREATIVE PORTFOLIO / vanilla + WebGL */
(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const lowPower =
    window.matchMedia("(max-width: 760px)").matches ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  const state = {
    pointerX: 0.5,
    pointerY: 0.5,
    pulse: 0,
    fieldPulse: 0,
    activeFilter: "All work",
    lastFocus: null,
  };
})();