export const siteConfig = {
  name: "INKs & Walls",
  description: "Bespoke Wallpapers, Blinds & Custom Wall Art",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://inksandwalls.com",
  googleSiteVerification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  address: {
    streetAddress: process.env.NEXT_PUBLIC_STREET_ADDRESS,
    addressLocality: process.env.NEXT_PUBLIC_ADDRESS_LOCALITY,
    addressRegion: process.env.NEXT_PUBLIC_ADDRESS_REGION,
    postalCode: process.env.NEXT_PUBLIC_POSTAL_CODE,
    addressCountry: process.env.NEXT_PUBLIC_ADDRESS_COUNTRY || "IN",
  },
  gbpUrl: process.env.NEXT_PUBLIC_GBP_URL,
  navLinks: [
    { label: "Home", href: "/" },
    { label: "Catalogue", href: "/products" },
  ],
  footerLinks: {
    explore: [
      { label: "Wallpapers", href: "#" },
      { label: "Blinds", href: "#" },
      { label: "Custom Wall Art", href: "#" },
    ],
    support: [
      { label: "Size & Measurement Guide", href: "#" },
      { label: "FAQ & Help", href: "#" },
      { label: "Consultation", href: "#" },
    ],
    legal: [
      { label: "Terms of Service", href: "#" },
      { label: "Privacy Policy", href: "#" },
      { label: "Shipping Policy", href: "#" },
    ],
  },
  contact: {
    email: "contact@inksandwalls.com",
    phone: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ? `+${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}` : undefined,
    supportHours: "Mon - Sat: 9:00 AM - 6:00 PM IST",
  },
} as const;

export type SiteConfig = typeof siteConfig;
