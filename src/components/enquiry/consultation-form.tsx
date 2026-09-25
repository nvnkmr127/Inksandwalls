"use client";

import * as React from "react";
import { submitEnquiry } from "@/app/actions/enquiry";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/feedback/toast";
import { Loader2 } from "lucide-react";

export function ConsultationForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const phone = formData.get("phone") as string;
    const message = formData.get("message") as string;

    const res = await submitEnquiry({ name, phone, message });

    if (res.success) {
      setIsSuccess(true);
      toast.success("Enquiry Sent", "We will get back to you shortly.");
    } else {
      toast.error("Error", res.error || "Failed to submit enquiry.");
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="p-6 text-center space-y-4 bg-emerald-50/50 rounded-lg border border-emerald-100">
        <h3 className="text-lg font-semibold text-emerald-800">Thank you!</h3>
        <p className="text-emerald-700">Your consultation request has been received. Our team will contact you soon.</p>
        <Button variant="outline" onClick={() => setIsSuccess(false)}>Submit another</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md w-full">
      <FormField label="Name" required htmlFor="name">
        <Input 
          id="name"
          name="name"
          required
          placeholder="Enter your name"
          disabled={isSubmitting}
        />
      </FormField>
      
      <FormField label="Phone Number" required htmlFor="phone">
        <Input 
          id="phone"
          name="phone"
          required
          type="tel"
          placeholder="Enter your phone number"
          disabled={isSubmitting}
        />
      </FormField>

      <FormField label="Message (Optional)" htmlFor="message">
        <Textarea 
          id="message"
          name="message"
          placeholder="Tell us what you're looking for..."
          disabled={isSubmitting}
        />
      </FormField>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          "Book Free Consultation"
        )}
      </Button>
    </form>
  );
}
