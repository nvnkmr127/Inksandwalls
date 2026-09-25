export const analyticsConfig = {
  ga4MeasurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "",
  gtmContainerId: process.env.NEXT_PUBLIC_GTM_CONTAINER_ID || "",
  metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID || "",
};

export function isAnalyticsEnabled() {
  return (
    !!analyticsConfig.ga4MeasurementId ||
    !!analyticsConfig.gtmContainerId ||
    !!analyticsConfig.metaPixelId
  );
}
