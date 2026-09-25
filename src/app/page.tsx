import { Metadata } from "next"
import { siteConfig } from "@/config/site"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
  alternates: {
    canonical: "/",
  },
}

export default function HomePage() {
  return (
    <div className="flex flex-col gap-12 py-8 md:py-16">
      {/* Hero / System Foundation Header */}
      <section className="container max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start gap-4 max-w-3xl">
          <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground border border-border">
            Application Foundation Scaffold
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl text-foreground">
            {siteConfig.name}
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            {siteConfig.description}. Reusable design system foundation, typography hierarchy, and accessible layout shell.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button variant="default">Primary Action</Button>
            <Button variant="outline">Secondary Action</Button>
            <Button variant="ghost">Ghost Option</Button>
          </div>
        </div>
      </section>

      <div className="container max-w-7xl px-4 sm:px-6 lg:px-8">
        <Separator />
      </div>

      {/* Design Tokens & Surfaces Demo */}
      <section className="container max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Design Token Foundation
            </h2>
            <p className="text-sm text-muted-foreground">
              Structural primitives for typography, interactive elements, surfaces, and spacing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Typography */}
            <div className="rounded-xl border bg-card text-card-foreground p-6 shadow-sm space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Typography Hierarchy</h3>
              <div className="space-y-2 text-sm">
                <p className="text-2xl font-bold">Heading 1</p>
                <p className="text-xl font-semibold">Heading 2</p>
                <p className="text-base font-medium">Subheading Body</p>
                <p className="text-xs text-muted-foreground">Muted caption text</p>
              </div>
            </div>

            {/* Card 2: Surfaces & Borders */}
            <div className="rounded-xl border bg-card text-card-foreground p-6 shadow-sm space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Surfaces & Accents</h3>
              <div className="space-y-2">
                <div className="p-3 bg-muted rounded-md text-xs font-medium text-muted-foreground">
                  Muted Surface (bg-muted)
                </div>
                <div className="p-3 bg-secondary rounded-md text-xs font-medium text-secondary-foreground">
                  Secondary Surface (bg-secondary)
                </div>
                <div className="p-3 bg-accent rounded-md text-xs font-medium text-accent-foreground">
                  Accent Highlight (bg-accent)
                </div>
              </div>
            </div>

            {/* Card 3: Form Controls Primitives */}
            <div className="rounded-xl border bg-card text-card-foreground p-6 shadow-sm space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Input Primitives</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sample-input">Sample Field Label</Label>
                  <Input
                    id="sample-input"
                    type="text"
                    placeholder="Enter placeholder text..."
                  />
                </div>
                <Button className="w-full">Submit Form</Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
