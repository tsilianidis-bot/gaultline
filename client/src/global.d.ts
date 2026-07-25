/**
 * Global type augmentations for the FAULTLINE client.
 * Centralises Window interface extensions to avoid TS2687 duplicate-modifier errors.
 */

// Build-time constants injected by vite.config.ts define block
declare const __BUILD_COMMIT__: string;
declare const __BUILD_TIME__: string;

declare global {
  interface Window {
    /** Google Analytics 4 gtag function */
    gtag: (...args: unknown[]) => void;
    /** GA4 dataLayer array */
    dataLayer: unknown[];
  }
}

export {};
