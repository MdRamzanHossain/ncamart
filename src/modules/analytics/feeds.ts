export interface FeedProductItem {
  id: string;
  skuCode: string;
  title: string;
  description: string;
  slug: string;
  pricePaisa: number;
  availability: "in_stock" | "out_of_stock" | "preorder";
  brand: string;
  barcodeEan13?: string | null;
  tier: "AUTHENTIC" | "BUDGET_SMART";
  imageUrl?: string | null;
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function escapeCsvField(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Builds standard Google Merchant Center RSS 2.0 XML with the g: namespace.
 */
export function buildGoogleMerchantXml(
  items: FeedProductItem[],
  baseUrl = "https://ncamart.com"
): string {
  const xmlItems = items
    .map((item) => {
      const priceFormatted = `${(item.pricePaisa / 100).toFixed(2)} BDT`;
      const link = `${baseUrl}/catalog/products/${item.slug}`;
      const imageLink = item.imageUrl || `${baseUrl}/images/placeholder.png`;
      const gtinElement = item.barcodeEan13
        ? `<g:gtin>${escapeXml(item.barcodeEan13)}</g:gtin>`
        : `<g:identifier_exists>no</g:identifier_exists>`;

      return `    <item>
      <g:id>${escapeXml(item.skuCode || item.id)}</g:id>
      <g:title>${escapeXml(item.title)}</g:title>
      <g:description>${escapeXml(item.description)}</g:description>
      <g:link>${escapeXml(link)}</g:link>
      <g:image_link>${escapeXml(imageLink)}</g:image_link>
      <g:price>${priceFormatted}</g:price>
      <g:availability>${item.availability}</g:availability>
      <g:brand>${escapeXml(item.brand)}</g:brand>
      ${gtinElement}
      <g:condition>new</g:condition>
      <g:custom_label_0>${item.tier}</g:custom_label_0>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>NCAMart Products</title>
    <link>${baseUrl}</link>
    <description>NCAMart Verified Accessories &amp; Hardware</description>
${xmlItems}
  </channel>
</rss>`;
}

/**
 * Builds Meta Catalog CSV according to Meta Product Feed specifications.
 */
export function buildMetaCatalogCsv(
  items: FeedProductItem[],
  baseUrl = "https://ncamart.com"
): string {
  const header = "id,title,description,availability,condition,price,link,image_link,brand,custom_label_0";

  const rows = items.map((item) => {
    const priceFormatted = `${(item.pricePaisa / 100).toFixed(2)} BDT`;
    const link = `${baseUrl}/catalog/products/${item.slug}`;
    const imageLink = item.imageUrl || `${baseUrl}/images/placeholder.png`;
    const availabilityFormatted = item.availability === "in_stock" ? "in stock" : item.availability;

    return [
      escapeCsvField(item.skuCode || item.id),
      escapeCsvField(item.title),
      escapeCsvField(item.description),
      escapeCsvField(availabilityFormatted),
      escapeCsvField("new"),
      escapeCsvField(priceFormatted),
      escapeCsvField(link),
      escapeCsvField(imageLink),
      escapeCsvField(item.brand),
      escapeCsvField(item.tier),
    ].join(",");
  });

  return [header, ...rows].join("\n");
}
