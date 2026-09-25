import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReviewActions } from "./review-actions";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Moderate Reviews | Admin",
};

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string };
}) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STORE_ADMIN" && session.user.role !== "SUPER_ADMIN")) {
    redirect("/login");
  }

  const page = Number(searchParams.page) || 1;
  const status = searchParams.status as "PENDING" | "APPROVED" | "REJECTED" | undefined;
  const pageSize = 20;

  const where = status ? { status } : {};

  const [totalCount, reviews] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
        product: {
          select: { name: true },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Moderate Reviews</h1>
        <div className="flex gap-2">
          <a href="/admin/reviews" className={`px-3 py-1 text-sm rounded-md border ${!status ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}>All</a>
          <a href="/admin/reviews?status=PENDING" className={`px-3 py-1 text-sm rounded-md border ${status === 'PENDING' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}>Pending</a>
          <a href="/admin/reviews?status=APPROVED" className={`px-3 py-1 text-sm rounded-md border ${status === 'APPROVED' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}>Approved</a>
          <a href="/admin/reviews?status=REJECTED" className={`px-3 py-1 text-sm rounded-md border ${status === 'REJECTED' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}>Rejected</a>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        {reviews.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No reviews found.
          </div>
        ) : (
          <div className="divide-y">
            {reviews.map((review) => (
              <div key={review.id} className="p-4 flex flex-col md:flex-row gap-4 justify-between items-start">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{review.product.name}</span>
                    <Badge variant={review.status === "APPROVED" ? "default" : review.status === "REJECTED" ? "destructive" : "secondary"}>
                      {review.status}
                    </Badge>
                  </div>
                  <div className="flex text-yellow-500 text-sm">
                    {Array.from({ length: review.rating }).map((_, i) => <span key={i}>★</span>)}
                  </div>
                  {review.content && <p className="text-sm">{review.content}</p>}
                  <p className="text-xs text-muted-foreground">
                    By {review.customer.user.name || review.customer.user.email} on {new Date(review.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <ReviewActions reviewId={review.id} currentStatus={review.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <a href={`/admin/reviews?page=${page - 1}${status ? `&status=${status}` : ''}`} className="px-4 py-2 border rounded-md">Previous</a>
          )}
          <span className="px-4 py-2 border rounded-md bg-muted">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <a href={`/admin/reviews?page=${page + 1}${status ? `&status=${status}` : ''}`} className="px-4 py-2 border rounded-md">Next</a>
          )}
        </div>
      )}
    </div>
  );
}
