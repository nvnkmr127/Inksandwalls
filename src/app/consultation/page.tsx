import { ConsultationForm } from "@/components/enquiry/consultation-form";
import { WhatsAppButton } from "@/components/enquiry/whatsapp-button";

export const metadata = {
  title: "Book Free Consultation | INKs & Walls",
  description: "Book a free consultation with our experts for your wallpaper and blinds needs.",
};

export default function ConsultationPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Book a Free Consultation</h1>
        <p className="text-muted-foreground">
          Leave your details below and our experts will get in touch with you to discuss your requirements.
        </p>
        <div className="mt-8 bg-card p-6 rounded-xl border shadow-sm">
          <ConsultationForm />
        </div>

        <div className="mt-8 flex flex-col items-center space-y-4 pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground">Prefer instant messaging?</p>
          <WhatsAppButton 
            className="w-full max-w-md bg-[#25D366] text-white hover:bg-[#1DA851] border-transparent" 
            message="Hi, I would like to book a free consultation for wallpaper and blinds."
          />
        </div>
      </div>
    </div>
  );
}
