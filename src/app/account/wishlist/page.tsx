import { Metadata } from "next";
import Link from "next/link";
import { getCustomerWishlist } from "@/lib/wishlist/wishlist-service";
import { formatPaiseToRupees } from "@/lib/money";
import { WishlistRemoveButton } from "./wishlist-remove-button";

export const metadata: Metadata = {
  title: "Wishlist | INKs & Walls",
  description: "View your saved products",
};

export default async function WishlistPage() {
  const wishlistItems = await getCustomerWishlist();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Wishlist</h1>
      
      {wishlistItems.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <h2 className="text-lg font-medium">Your wishlist is empty</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Save items you like to your wishlist to easily find them later.
          </p>
          <Link href="/products" className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {wishlistItems.map((item) => {
            const product = item.product;
            const primaryImage = product.media?.[0]?.objectKey;
            
            return (
              <div key={item.id} className="rounded-lg border overflow-hidden flex flex-col">
                <div className="aspect-square bg-muted relative">
                  {primaryImage ? (
                    <img 
                      src={`https://pub-your-bucket.r2.dev/${primaryImage}`} 
                      alt={product.name} 
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      No Image
                    </div>
                  )}
                </div>
                <div className="p-4 flex flex-col flex-grow">
                  <h3 className="font-medium truncate">{product.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {product.price ? formatPaiseToRupees(product.price) : (product.rate ? formatPaiseToRupees(product.rate) + "/sqft" : "Price unavailable")}
                  </p>
                  
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <Link 
                      href={`/products/${product.slug}`}
                      className="flex-grow inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      View Product
                    </Link>
                    <WishlistRemoveButton productId={product.id} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
