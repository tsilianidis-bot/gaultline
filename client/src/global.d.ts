/**
 * Global type augmentations for the FAULTLINE client.
 * Centralises Window interface extensions to avoid TS2687 duplicate-modifier errors.
 */

declare global {
  interface Window {
    /** Google Analytics 4 gtag function */
    gtag: (...args: unknown[]) => void;
    /** GA4 dataLayer array */
    dataLayer: unknown[];
  }
}

export {};
