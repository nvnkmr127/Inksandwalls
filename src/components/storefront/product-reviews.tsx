import { Star } from "lucide-react";

interface Review {
  id: string;
  rating: number;
  content: string | null;
  createdAt: Date;
  customer: {
    user: {
      name: string | null;
    };
  };
}

interface ProductReviewsProps {
  reviews: Review[];
  summary: {
    averageRating: number;
    totalCount: number;
  };
}

export function ProductReviews({ reviews, summary }: ProductReviewsProps) {
  if (summary.totalCount === 0) {
    return (
      <div className="text-center py-12 border rounded-xl bg-muted/20">
        <h3 className="text-lg font-medium">No reviews yet</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Be the first to review this product after purchase.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 border-b pb-6">
        <div className="flex items-center text-4xl font-bold">
          {summary.averageRating.toFixed(1)}
        </div>
        <div>
          <div className="flex text-yellow-500">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-5 w-5 ${
                  star <= Math.round(summary.averageRating)
                    ? "fill-current"
                    : "text-muted stroke-current"
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Based on {summary.totalCount} {summary.totalCount === 1 ? "review" : "reviews"}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {reviews.map((review) => (
          <div key={review.id} className="border-b pb-6 last:border-0 last:pb-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex text-yellow-500">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-4 w-4 ${
                      star <= review.rating ? "fill-current" : "text-muted stroke-current"
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm font-medium">
                {review.customer.user.name || "Anonymous Customer"}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                {new Date(review.createdAt).toLocaleDateString()}
              </span>
            </div>
            {review.content && (
              <p className="text-sm text-foreground/90 mt-2 whitespace-pre-wrap">
                {review.content}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
