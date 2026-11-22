import { createDefaultCanvasByViewport } from './responsiveUtils.js';
import { detectInitializedViewports } from './projectStorage.js';

/**
 * Builds a normalized tab state object with per-viewport canvas geometry and initialized breakpoint flags.
 */
export function buildTabState(id, name, elems = [], canvasOrByViewport = {}) {
  const hasPerViewport = canvasOrByViewport && (canvasOrByViewport.desktop || canvasOrByViewport.tablet || canvasOrByViewport.mobile);
  const baseDefaults = createDefaultCanvasByViewport(hasPerViewport ? canvasOrByViewport.desktop : canvasOrByViewport);
  const canvasByViewport = hasPerViewport
    ? {
        desktop: { ...baseDefaults.desktop, ...(canvasOrByViewport.desktop || {}) },
        tablet: { ...baseDefaults.tablet, ...(canvasOrByViewport.tablet || {}) },
        mobile: { ...baseDefaults.mobile, ...(canvasOrByViewport.mobile || {}) },
      }
    : baseDefaults;

  return {
    id,
    name,
    elements: elems,
    canvasByViewport,
    initializedViewports: detectInitializedViewports(elems, true),
  };
}
