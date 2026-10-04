const ADS_ID = 'AW-18485052126';
const PAGE_VIEW_SEND_TO = 'AW-18485052126/ZqniCKqtv40dEN6Fru5E';

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

let tagPromise: Promise<void> | null = null;
let pageViewSent = false;

export function loadGoogleAdsTag(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (tagPromise) return tagPromise;

  tagPromise = new Promise((resolve) => {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer?.push(arguments);
    } as Gtag;
    window.gtag('js', new Date());
    window.gtag('config', ADS_ID);

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${ADS_ID}`;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });

  return tagPromise;
}

export function trackCatalogPageView() {
  if (pageViewSent) return;
  pageViewSent = true;
  void loadGoogleAdsTag().then(() => {
    window.gtag?.('event', 'conversion', { send_to: PAGE_VIEW_SEND_TO });
  });
}
