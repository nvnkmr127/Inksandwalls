import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { siteConfig } from "@/config/site"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { Providers } from "@/components/providers"
import { getStorefrontNavData } from "@/lib/storefront/catalog-service"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
})

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { categories, collections } = await getStorefrontNavData();

  return (
    <html lang="en" className={`${inter.variable} h-full scroll-smooth`}>
      <body className="min-h-screen flex flex-col bg-background text-foreground antialiased font-sans">
        <Providers>
          <Header categories={categories} collections={collections} />
          <main className="flex-1 flex flex-col">{children}</main>
          <Footer categories={categories} collections={collections} />
        </Providers>
      </body>
    </html>
  )
}
