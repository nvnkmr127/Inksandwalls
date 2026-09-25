"use client";

import { PageForm } from "../page-form";

export default function NewPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Write Page Page</h1>
        <p className="text-sm text-muted-foreground">
          Create a new article or editorial piece.
        </p>
      </div>
      <PageForm />
    </div>
  );
}
