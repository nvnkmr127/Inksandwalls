export function getOrderConfirmationTemplate(order: any) {
  const currency = "₹";
  const itemsHtml = order.items.map((item: any) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.productName} (Qty: ${item.quantity})</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${currency}${(item.totalPricePaise / 100).toFixed(2)}</td>
    </tr>
  `).join("");

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Order Confirmation - ${order.orderNumber}</h2>
      <p>Dear ${order.customerName},</p>
      <p>Thank you for your order! We have received your order placed on ${new Date(order.createdAt).toLocaleDateString()}.</p>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background-color: #f8f9fa;">
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Item</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td style="padding: 10px; text-align: right; font-weight: bold;">Total:</td>
            <td style="padding: 10px; text-align: right; font-weight: bold;">${currency}${(order.totalPaise / 100).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      ${order.invoiceUrl ? `<p style="margin-top: 20px;"><a href="${order.invoiceUrl}" style="color: #0f172a;">Download your invoice</a></p>` : ""}
      
      <p style="margin-top: 30px; font-size: 12px; color: #666;">
        If you have any questions, please contact us at support@inksandwalls.com.
      </p>
    </div>
  `;
}

export function getShippingTemplate(order: any) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Your order has been shipped!</h2>
      <p>Dear ${order.customerName},</p>
      <p>Your order <strong>${order.orderNumber}</strong> has been shipped.</p>
      
      <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p><strong>Courier:</strong> ${order.courierName || "Standard Shipping"}</p>
        <p><strong>Tracking Number (AWB):</strong> ${order.awb || "N/A"}</p>
        ${order.trackingUrl ? `<p><a href="${order.trackingUrl}" style="color: #2563eb; text-decoration: none;">Track your package</a></p>` : ""}
      </div>
      
      <p style="margin-top: 30px; font-size: 12px; color: #666;">
        Thank you for shopping with INKs & Walls!
      </p>
    </div>
  `;
}

export function getDeliveryTemplate(order: any) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Your order has been delivered!</h2>
      <p>Dear ${order.customerName},</p>
      <p>Your order <strong>${order.orderNumber}</strong> has been successfully delivered.</p>
      <p>We hope you love your new purchase! If you have any feedback or issues, please do not hesitate to contact us.</p>
      
      <p style="margin-top: 30px; font-size: 12px; color: #666;">
        Thank you for choosing INKs & Walls.
      </p>
    </div>
  `;
}

export function getConsultationEnquiryTemplate(enquiry: any) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">New Consultation Enquiry</h2>
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px;">
        <p><strong>Name:</strong> ${enquiry.name}</p>
        <p><strong>Phone:</strong> ${enquiry.phone}</p>
        <p><strong>Source:</strong> ${enquiry.source || "web"}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap;">${enquiry.message || "N/A"}</p>
      </div>
    </div>
  `;
}
