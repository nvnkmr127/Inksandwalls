"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/feedback/toast";
import { BlogPostView, CreateBlogPostInput } from "@/lib/blog/types";
import { Loader2 } from "lucide-react";

interface BlogFormProps {
  initialData?: BlogPostView;
}

export function BlogForm({ initialData }: BlogFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formData, setFormData] = React.useState<CreateBlogPostInput>({
    title: initialData?.title || "",
    slug: initialData?.slug || "",
    excerpt: initialData?.excerpt || "",
    content: initialData?.content || "",
    status: initialData?.status || "DRAFT",
    featuredImage: initialData?.featuredImage || "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = new FormData();
      data.append("file", file);
      data.append("resource", "blog");

      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: data,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to upload image");
      }

      // Use the first variant objectKey
      const key = json.variants?.[0]?.objectKey || "";
      if (key) {
        setFormData((prev) => ({ ...prev, featuredImage: key }));
        toast.success("Image Uploaded", "Featured image uploaded successfully.");
      }
    } catch (err: any) {
      toast.error("Upload Failed", err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = initialData ? `/api/admin/blog/${initialData.id}` : "/api/admin/blog";
      const method = initialData ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error?.message || "An error occurred");
      }

      toast.success("Success", `Blog post ${initialData ? "updated" : "created"}.`);
      router.push("/admin/blog");
      router.refresh();
    } catch (err: any) {
      toast.error("Failed", err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Title" required htmlFor="title">
          <Input id="title" name="title" required value={formData.title} onChange={handleChange} disabled={isSubmitting} />
        </FormField>
        
        <FormField label="Slug" required htmlFor="slug" description="Unique URL path (e.g. my-post)">
          <Input id="slug" name="slug" required value={formData.slug} onChange={handleChange} disabled={isSubmitting} />
        </FormField>
      </div>

      <FormField label="Excerpt" htmlFor="excerpt">
        <Textarea id="excerpt" name="excerpt" value={formData.excerpt} onChange={handleChange} disabled={isSubmitting} rows={2} />
      </FormField>

      <FormField label="Content (Markdown supported)" required htmlFor="content">
        <Textarea id="content" name="content" required value={formData.content} onChange={handleChange} disabled={isSubmitting} rows={12} className="font-mono text-sm" />
      </FormField>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Status" required htmlFor="status">
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            disabled={isSubmitting}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </FormField>

        <FormField label="Featured Image" htmlFor="featuredImageFile">
          <div className="space-y-2">
            <Input id="featuredImageFile" type="file" accept="image/*" onChange={handleFileChange} disabled={isSubmitting} />
            {formData.featuredImage && (
              <p className="text-xs text-muted-foreground truncate">
                Current: {formData.featuredImage}
              </p>
            )}
          </div>
        </FormField>
      </div>

      <div className="flex gap-4 pt-4">
        <Button type="button" variant="outline" onClick={() => router.push("/admin/blog")} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initialData ? "Save Changes" : "Create Post"}
        </Button>
      </div>
    </form>
  );
}
