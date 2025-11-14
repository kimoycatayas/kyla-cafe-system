import type { BusinessProfile } from "../generated/prisma/client";
import { receiptConfig } from "../config/receiptConfig";
import type { OrderReceiptDetails } from "./orderService";

export type ReceiptRender = {
  content: string;
  filename: string;
  mimeType: string;
};

type ReceiptBuildInput = {
  receipt: OrderReceiptDetails;
  cashierName?: string;
  businessProfile?: BusinessProfile | null;
};

const RECEIPT_WIDTH = 42;

const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

const formatCurrency = (amount: number): string =>
  pesoFormatter.format(Number.isFinite(amount) ? amount : 0);

const formatDateTime = (value: Date): string =>
  new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);

const clamp = (value: string, width: number): string =>
  value.length <= width ? value : value.slice(0, width);

const padRight = (value: string, width: number): string =>
  clamp(value, width).padEnd(width, " ");

const padLeft = (value: string, width: number): string =>
  clamp(value, width).padStart(width, " ");

const centerText = (value: string, width = RECEIPT_WIDTH): string => {
  const text = clamp(value, width);
  if (text.length >= width) {
    return text;
  }
  const padding = width - text.length;
  const left = Math.floor(padding / 2);
  const right = padding - left;
  return `${" ".repeat(left)}${text}${" ".repeat(right)}`;
};

const divider = (char = "-"): string => char.repeat(RECEIPT_WIDTH);

const formatKeyValue = (key: string, value: string): string => {
  const normalizedKey = clamp(key, RECEIPT_WIDTH - 2);
  const normalizedValue = clamp(value, RECEIPT_WIDTH - normalizedKey.length);
  const spacing =
    RECEIPT_WIDTH - (normalizedKey.length + normalizedValue.length);
  return `${normalizedKey}${" ".repeat(
    Math.max(spacing, 1)
  )}${normalizedValue}`;
};

const splitIntoLines = (text: string, width = RECEIPT_WIDTH): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) {
    return [""];
  }

  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (!currentLine.length) {
      currentLine = clamp(word, width);
      continue;
    }

    const withWord = `${currentLine} ${word}`;
    if (withWord.length <= width) {
      currentLine = withWord;
      continue;
    }

    lines.push(padRight(currentLine, width));
    currentLine = clamp(word, width);
  }

  if (currentLine.length) {
    lines.push(padRight(currentLine, width));
  }

  return lines.length ? lines : [""];
};

const buildItemLines = (order: OrderReceiptDetails["items"]): string[] => {
  const lines: string[] = [];

  for (const item of order) {
    const itemNameLines = splitIntoLines(item.nameSnapshot);
    lines.push(...itemNameLines);

    const qtyPrice = `${item.qty} x ${formatCurrency(item.unitPrice)}`;
    lines.push(formatKeyValue(qtyPrice, formatCurrency(item.lineTotal)));

    if (item.lineDiscountTotal > 0) {
      lines.push(
        formatKeyValue(
          "  Less Item Discount",
          `-${formatCurrency(item.lineDiscountTotal)}`
        )
      );
    }
  }

  return lines;
};

const buildDiscountLines = (
  discounts: OrderReceiptDetails["discounts"]
): string[] => {
  if (!discounts.length) {
    return [];
  }

  return discounts.map((discount) =>
    formatKeyValue(
      `Less ${discount.discountType?.name ?? "Discount"}`,
      `-${formatCurrency(discount.amount)}`
    )
  );
};

const buildPaymentLines = (
  payments: OrderReceiptDetails["payments"]
): string[] => {
  const lines: string[] = [];

  payments.forEach((payment, index) => {
    const label = `Payment ${index + 1} (${payment.method})`;
    lines.push(formatKeyValue(label, formatCurrency(payment.amount)));

    if (payment.tenderedAmount !== null) {
      lines.push(
        formatKeyValue("  Tendered", formatCurrency(payment.tenderedAmount))
      );
    }

    if (payment.changeGiven !== null && payment.changeGiven > 0) {
      lines.push(
        formatKeyValue("  Change", formatCurrency(payment.changeGiven))
      );
    }
  });

  return lines;
};

const buildVatLines = (total: number, vatRate: number): string[] => {
  const vatSales = total / (1 + vatRate);
  const vatAmount = total - vatSales;

  return [
    formatKeyValue("VAT Sales", formatCurrency(vatSales)),
    formatKeyValue("Non-VAT Sales", formatCurrency(0)),
    formatKeyValue("Zero-Rated Sales", formatCurrency(0)),
    formatKeyValue("Total Sales", formatCurrency(total)),
    formatKeyValue("VAT Amount", formatCurrency(vatAmount)),
  ];
};

const buildBusinessSection = (
  profile: BusinessProfile | null | undefined
): string[] => {
  const lines: string[] = [];
  const name = profile?.businessName?.trim() || receiptConfig.businessName;
  lines.push(centerText(name));

  const addressLines =
    profile?.fullName && profile?.fullName !== name
      ? [profile.fullName, ...receiptConfig.addressLines]
      : receiptConfig.addressLines;

  lines.push(...addressLines.map((line) => centerText(line)));

  lines.push(centerText(receiptConfig.vatRegistration));
  receiptConfig.permitInfo.forEach((entry) => lines.push(centerText(entry)));

  return lines;
};

const buildLinksSection = (): string[] => {
  const lines: string[] = [];
  lines.push(centerText("FOR ONGOING PROMOS"));
  lines.push(centerText("please visit our website"));

  if (receiptConfig.links.website) {
    lines.push(centerText(receiptConfig.links.website));
  }

  if (receiptConfig.links.facebook) {
    lines.push(centerText("FB page:"));
    lines.push(centerText(receiptConfig.links.facebook));
  }

  return lines;
};

const buildFooterSection = (): string[] =>
  receiptConfig.receiptFooter.map((line) => centerText(line));

const buildPosProviderSection = (): string[] => {
  const provider = receiptConfig.posProvider;
  return [
    centerText(provider.name),
    centerText(provider.address),
    centerText(provider.tin),
    centerText(provider.accreditation),
    centerText(provider.permitValidity),
    centerText(provider.ptNumber),
  ];
};

export const buildReceipt = ({
  receipt,
  cashierName,
  businessProfile,
}: ReceiptBuildInput): ReceiptRender => {
  const lines: string[] = [];

  lines.push(...buildBusinessSection(businessProfile));
  lines.push(divider());

  const heading = receiptConfig.receiptHeading;
  if (heading.length > 0) {
    const first = heading[0]!;
    const rest = heading.slice(1);
    lines.push(formatKeyValue(first, receiptConfig.terminalLabel));
    rest.forEach((line) => lines.push(centerText(line)));
  }

  lines.push(formatKeyValue("Cashier", cashierName ?? receipt.cashierId));
  lines.push(formatKeyValue("Customer Type", receiptConfig.customerTypeLabel));
  lines.push(divider());
  lines.push(padRight("Item", RECEIPT_WIDTH));
  lines.push(divider());

  lines.push(...buildItemLines(receipt.items));
  lines.push(divider());

  const totalItems = receipt.items.reduce((sum, item) => sum + item.qty, 0);
  lines.push(formatKeyValue("TOTAL", `${totalItems} item(s)`));
  lines.push(
    formatKeyValue("Subtotal", formatCurrency(receipt.totals.subtotal))
  );
  buildDiscountLines(receipt.discounts).forEach((line) => lines.push(line));
  lines.push(
    formatKeyValue(
      "Total Discount",
      formatCurrency(receipt.totals.discountTotal)
    )
  );
  lines.push(
    formatKeyValue("Total Due", formatCurrency(receipt.totals.totalDue))
  );

  buildPaymentLines(receipt.payments).forEach((line) => lines.push(line));
  lines.push(
    formatKeyValue("Total Paid", formatCurrency(receipt.totals.totalPaid))
  );
  lines.push(
    formatKeyValue("Change", formatCurrency(receipt.totals.changeDue))
  );
  lines.push(divider());

  buildVatLines(receipt.totals.totalDue, receiptConfig.vatRate).forEach(
    (line) => lines.push(line)
  );

  lines.push(divider());
  lines.push(
    formatKeyValue(
      "Trans No.",
      `${receipt.orderNumber} ${formatDateTime(receipt.createdAt)}`
    )
  );
  lines.push(divider());
  lines.push(centerText("THIS IS YOUR OFFICIAL RECEIPT"));
  lines.push(divider());
  lines.push(...buildLinksSection());
  lines.push(divider());
  lines.push(...buildFooterSection());
  lines.push(divider());
  lines.push(...buildPosProviderSection());

  const content = lines.join("\n");
  const filename = `${receipt.orderNumber}-receipt.txt`;

  return {
    content,
    filename,
    mimeType: "text/plain",
  };
};
