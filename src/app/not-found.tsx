import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] px-4 py-16 text-center">
      <div className="w-16 h-16 mb-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
        <Search className="w-8 h-8 text-muted-foreground" />
      </div>

      <span className="text-sm font-semibold tracking-wider text-primary uppercase mb-2">
        404 Error
      </span>
      
      <h1 className="text-4xl font-bold tracking-tight mb-3">
        Page not found
      </h1>
      
      <p className="text-muted-foreground max-w-md mb-8">
        Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved or deleted.
      </p>

      <Link
        href="/"
        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Return to Storefront
      </Link>
    </div>
  );
}
