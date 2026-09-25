"use client";

import { BlogForm } from "../blog-form";

export default function NewBlogPostPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Write Blog Post</h1>
        <p className="text-sm text-muted-foreground">
          Create a new article or editorial piece.
        </p>
      </div>
      <BlogForm />
    </div>
  );
}
