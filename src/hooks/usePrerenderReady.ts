import { useEffect } from "react";

/**
 * Dispatches a 'prerender-ready' event after initial render,
 * signalling to SSG tools (Puppeteer) that the page is ready for capture.
 */
export const usePrerenderReady = (delay = 100) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      document.dispatchEvent(new Event("prerender-ready"));
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);
};
