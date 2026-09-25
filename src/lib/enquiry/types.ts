import { z } from "zod";

export const createEnquirySchema = z.object({
  name: z.string().min(2, "Name is too short").max(100, "Name is too long"),
  phone: z.string().min(10, "Valid phone number required").max(15, "Valid phone number required"),
  message: z.string().optional(),
  source: z.string().optional(),
});

export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;
