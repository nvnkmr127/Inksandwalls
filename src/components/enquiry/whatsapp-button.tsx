"use client";

import * as React from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

interface WhatsAppButtonProps extends ButtonProps {
  message?: string;
  phoneNumber?: string;
}

export function getWhatsAppUrl(phoneNumber: string, message: string): string {
  const encodedMessage = encodeURIComponent(message);
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  return `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
}

export function WhatsAppButton({ 
  message = "Hi, I'd like to enquire about your products.", 
  phoneNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "",
  className,
  variant = "outline",
  size = "default",
  ...props 
}: WhatsAppButtonProps) {
  
  const handleClick = (e: React.MouseEvent) => {
    if (!phoneNumber) {
      console.warn("WhatsApp number is not configured (NEXT_PUBLIC_WHATSAPP_NUMBER)");
      return;
    }

    const url = getWhatsAppUrl(phoneNumber, message);
    
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Button 
      variant={variant} 
      size={size} 
      className={className}
      onClick={handleClick}
      type="button"
      aria-label="Enquire on WhatsApp"
      {...props}
    >
      <MessageCircle className="mr-2 h-4 w-4" />
      Enquire on WhatsApp
    </Button>
  );
}
