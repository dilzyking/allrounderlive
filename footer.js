
/* =========================================================
   MATCHDEKHO — FOOTER JS
   Smooth navigation + Back to Top + Dynamic Year
   ========================================================= */

(function bootMatchDekhoFooter() {
  'use strict';

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      bootMatchDekhoFooter,
      { once: true }
    );
    return;
  }

  const footer = document.getElementById(
    'matchdekhoFooter'
  );

  if (!footer || footer.dataset.initialized === 'true') {
    return;
  }

  footer.dataset.initialized = 'true';

  const backTop = document.getElementById(
    'matchdekhoBackTop'
  );

  const year = document.getElementById(
    'matchdekhoYear'
  );

  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );

  // ---------- DYNAMIC YEAR ----------

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  // ---------- SMOOTH BACK TO TOP ----------

  function scrollTop() {
    window.scrollTo({
      top: 0,
      behavior: reducedMotion.matches
        ? 'auto'
        : 'smooth'
    });
  }

  if (backTop) {
    backTop.addEventListener(
      'click',
      scrollTop
    );
  }

  // ---------- FOOTER NAVIGATION ----------

  footer.querySelectorAll(
    'a[href^="#"]'
  ).forEach(link => {

    link.addEventListener('click', event => {

      const href = link.getAttribute('href');

      if (!href) return;

      if (href === '#') {
        event.preventDefault();
        scrollTop();
        return;
      }

      const target = document.getElementById(
        href.slice(1)
      );

      if (!target) return;

      event.preventDefault();

      const header = document.querySelector(
        'body > header'
      );

      const headerHeight = header
        ? header.getBoundingClientRect().height
        : 0;

      const targetTop =
        target.getBoundingClientRect().top +
        window.scrollY -
        headerHeight -
        12;

      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: reducedMotion.matches
          ? 'auto'
          : 'smooth'
      });
    });

  });

})();
