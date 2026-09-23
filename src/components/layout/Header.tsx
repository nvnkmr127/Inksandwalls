"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, Search, X } from "lucide-react";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthStatus } from "@/components/auth/AuthStatus";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CartDrawer } from "@/components/cart/cart-drawer";

export interface HeaderProps {
  categories?: Array<{ id: string; name: string; slug: string }>;
  collections?: Array<{ id: string; name: string; slug: string }>;
}

export function Header({ categories = [], collections = [] }: HeaderProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const router = useRouter();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
      setIsOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 gap-4">
        {/* Brand Logo / Title */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-foreground transition-colors hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
          >
            {siteConfig.name}
          </Link>

          {/* Desktop Primary Navigation */}
          <nav
            aria-label="Main Navigation"
            className="hidden md:flex items-center gap-5"
          >
            <Link
              href="/"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1.5 py-1"
            >
              Home
            </Link>
            <Link
              href="/products"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1.5 py-1"
            >
              Catalogue
            </Link>

            {/* Active Categories Links (Top 3) */}
            {categories.slice(0, 3).map((cat) => (
              <Link
                key={cat.id}
                href={`/products?category=${cat.slug}`}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1.5 py-1"
              >
                {cat.name}
              </Link>
            ))}

            {/* Collections Link if available */}
            {collections.length > 0 && (
              <Link
                href={`/products?collection=${collections[0].slug}`}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1.5 py-1"
              >
                Collections
              </Link>
            )}
          </nav>
        </div>

        {/* Desktop Header Actions */}
        <div className="hidden md:flex items-center gap-3">
          {/* Quick Search */}
          {isSearchOpen ? (
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <Input
                type="search"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-48 lg:w-64 h-9 pr-8 text-sm"
                aria-label="Search catalog"
              />
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="absolute right-2 text-muted-foreground hover:text-foreground"
                aria-label="Close search"
              >
                <X className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Open search input"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
            >
              <Search className="h-4 w-4" />
            </Button>
          )}

          {/* Cart Entry Point */}
          <CartDrawer />

          {/* Account Authentication State */}
          <AuthStatus />
        </div>

        {/* Mobile Header Actions & Menu Trigger */}
        <div className="flex md:hidden items-center gap-1">
          <CartDrawer />

          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open Navigation Menu"
                  className="h-9 w-9"
                />
              }
            >
              <Menu className="h-6 w-6" />
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[350px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-left font-bold text-lg">
                  {siteConfig.name}
                </SheetTitle>
              </SheetHeader>

              {/* Mobile Search */}
              <form onSubmit={handleSearchSubmit} className="relative mt-4">
                <Input
                  type="search"
                  placeholder="Search catalogue..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pr-9 text-sm"
                  aria-label="Search catalog on mobile"
                />
                <button
                  type="submit"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Submit search"
                >
                  <Search className="h-4 w-4" />
                </button>
              </form>

              <nav
                aria-label="Mobile Navigation"
                className="flex flex-col gap-4 mt-6"
              >
                <div className="flex flex-col gap-1 border-b border-border/50 pb-4">
                  <Link
                    href="/"
                    onClick={() => setIsOpen(false)}
                    className="text-base font-medium py-1.5 px-2 rounded-md hover:bg-muted text-foreground transition-colors"
                  >
                    Home
                  </Link>
                  <Link
                    href="/products"
                    onClick={() => setIsOpen(false)}
                    className="text-base font-medium py-1.5 px-2 rounded-md hover:bg-muted text-foreground transition-colors"
                  >
                    All Catalogue
                  </Link>
                </div>

                {/* Categories */}
                {categories.length > 0 && (
                  <div className="flex flex-col gap-1 border-b border-border/50 pb-4">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">
                      Categories
                    </span>
                    {categories.map((cat) => (
                      <Link
                        key={cat.id}
                        href={`/products?category=${cat.slug}`}
                        onClick={() => setIsOpen(false)}
                        className="text-sm font-medium py-1.5 px-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {cat.name}
                      </Link>
                    ))}
                  </div>
                )}

                {/* Collections */}
                {collections.length > 0 && (
                  <div className="flex flex-col gap-1 border-b border-border/50 pb-4">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">
                      Collections
                    </span>
                    {collections.map((col) => (
                      <Link
                        key={col.id}
                        href={`/products?collection=${col.slug}`}
                        onClick={() => setIsOpen(false)}
                        className="text-sm font-medium py-1.5 px-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {col.name}
                      </Link>
                    ))}
                  </div>
                )}

                {/* Account & Session Controls */}
                <div className="pt-2 flex flex-col gap-3">
                  <AuthStatus mobile onNavClick={() => setIsOpen(false)} />
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
