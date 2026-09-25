"use client";

import { useState } from "react";
import { updateProfileAction, type ProfileInput } from "@/app/actions/profile";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ProfileForm({ initialData }: { initialData: ProfileInput }) {
  const [formData, setFormData] = useState<ProfileInput>(initialData);
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "success" | "error", message?: string }>({ type: "idle" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: "loading" });

    const res = await updateProfileAction(formData);

    if (res.success) {
      setStatus({ type: "success", message: "Profile updated successfully." });
      setTimeout(() => setStatus({ type: "idle" }), 3000);
    } else {
      setStatus({ type: "error", message: res.error || "An error occurred." });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-neutral-200 max-w-2xl space-y-4">
      {status.type === "success" && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{status.message}</span>
        </div>
      )}

      {status.type === "error" && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{status.message}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Full Name</Label>
        <Input 
          id="name" 
          value={formData.name || ""} 
          onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
          placeholder="e.g. John Doe"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input 
          id="email" 
          type="email" 
          value={formData.email || ""} 
          onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
          placeholder="e.g. john@example.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
        <Input 
          id="phone" 
          type="tel" 
          value={formData.phone || ""} 
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
          placeholder="10 digit number"
          maxLength={10}
        />
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={status.type === "loading"}>
          {status.type === "loading" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </form>
  );
}
