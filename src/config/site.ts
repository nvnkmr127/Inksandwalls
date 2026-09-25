export const siteConfig = {
  name: "INKs & Walls",
  description: "Bespoke Wallpapers, Blinds & Custom Wall Art",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://inksandwalls.com",
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
    supportHours: "Mon - Sat: 9:00 AM - 6:00 PM IST",
  },
} as const;

export type SiteConfig = typeof siteConfig;
