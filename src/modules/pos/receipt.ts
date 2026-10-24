import { ReceiptPayloadDto, ReceiptItemDto } from "./dto";

export function formatBdt(paisa: number): string {
  const bdt = (paisa / 100).toFixed(2);
  return `৳${bdt}`;
}

export function buildThermalReceipt(params: {
  receiptNumber: string;
  orderNumber: string;
  orderId: string;
  channel: string;
  fulfillment: string;
  customerName: string;
  customerPhoneMasked: string;
  items: ReceiptItemDto[];
  subtotalPaisa: number;
  discountPaisa: number;
  vatPaisa: number;
  totalPaisa: number;
  paidAmountPaisa: number;
  paymentMode: string;
  paymentReference?: string;
  printedAt?: Date;
}): ReceiptPayloadDto {
  const printedAt = (params.printedAt ?? new Date()).toISOString();
  const width = 48;
  const divider = "=".repeat(width);
  const dashed = "-".repeat(width);

  const center = (text: string) => {
    const pad = Math.max(0, Math.floor((width - text.length) / 2));
    return " ".repeat(pad) + text;
  };

  const line2Col = (left: string, right: string) => {
    const space = Math.max(1, width - left.length - right.length);
    return left + " ".repeat(space) + right;
  };

  const textLines: string[] = [
    divider,
    center("NAWABPUR COMPLEX ACCESSORIES"),
    center("24/B Nawabpur Road, Kotwali, Dhaka-1100"),
    center("Hotline: +880 9612-888999 | www.ncamart.com"),
    center("VAT BIN: 001928374-0101"),
    divider,
    line2Col(`Receipt: ${params.receiptNumber}`, `Date: ${new Date(printedAt).toLocaleDateString("en-GB")}`),
    line2Col(`Order: ${params.orderNumber}`, `Time: ${new Date(printedAt).toLocaleTimeString("en-GB")}`),
    line2Col(`Customer: ${params.customerName}`, `Phone: ${params.customerPhoneMasked}`),
    line2Col(`Channel: ${params.channel}`, `Fulfill: ${params.fulfillment}`),
    dashed,
    line2Col("ITEM / SEAL ID", "QTY   PRICE     TOTAL"),
    dashed,
  ];

  for (const item of params.items) {
    textLines.push(item.title);
    const itemMeta = line2Col(
      ` Seal: ${item.seal_id} (${item.warranty_days}d)`,
      `${item.qty}  ${formatBdt(item.unit_price_paisa)}  ${formatBdt(item.line_total_paisa)}`
    );
    textLines.push(itemMeta);
  }

  textLines.push(dashed);
  textLines.push(line2Col("Subtotal:", formatBdt(params.subtotalPaisa)));

  if (params.discountPaisa > 0) {
    textLines.push(line2Col("Coupon Discount:", `-${formatBdt(params.discountPaisa)}`));
  }

  textLines.push(line2Col("VAT (15% component included):", formatBdt(params.vatPaisa)));
  textLines.push(divider);
  textLines.push(line2Col("NET TOTAL PAYABLE:", formatBdt(params.totalPaisa)));
  textLines.push(
    line2Col(
      `Paid (${params.paymentMode}${params.paymentReference ? ` - ${params.paymentReference}` : ""}):`,
      formatBdt(params.paidAmountPaisa)
    )
  );

  const changePaisa = Math.max(0, params.paidAmountPaisa - params.totalPaisa);
  if (changePaisa > 0) {
    textLines.push(line2Col("Change Returned:", formatBdt(changePaisa)));
  }

  textLines.push(dashed);
  textLines.push(center("HOLOGRAPHIC SEAL WARRANTY ACTIVATED"));
  textLines.push(center("Verify anytime at https://ncamart.com/verify"));
  textLines.push(center("Goods once tested and handed over are guaranteed"));
  textLines.push(center("per manufacturer & NCAMart warranty policies."));
  textLines.push(center("Thank you for shopping at Nawabpur! (ধন্যবাদ)"));
  textLines.push(divider);

  const escposText = textLines.join("\n");

  return {
    receipt_number: params.receiptNumber,
    printed_at: printedAt,
    store: {
      name: "Nawabpur Complex Accessories",
      address: "24/B Nawabpur Road, Kotwali, Dhaka-1100",
      hotline: "+880 9612-888999",
      vat_bin: "001928374-0101",
    },
    order: {
      order_id: params.orderId,
      order_number: params.orderNumber,
      channel: params.channel,
      fulfillment: params.fulfillment,
      subtotal_paisa: params.subtotalPaisa,
      discount_paisa: params.discountPaisa,
      vat_paisa: params.vatPaisa,
      total_paisa: params.totalPaisa,
      paid_paisa: params.paidAmountPaisa,
    },
    customer: {
      name: params.customerName,
      phone_masked: params.customerPhoneMasked,
    },
    items: params.items,
    payment: {
      mode: params.paymentMode,
      paid_amount_paisa: params.paidAmountPaisa,
      reference: params.paymentReference,
    },
    warranty_notice: "Holographic warranty active from counter handover time.",
    escpos_text: escposText,
  };
}
