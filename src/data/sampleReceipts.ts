export interface SampleReceipt {
  id: string;
  name: string;
  vendor: string;
  filename: string;
  description: string;
  svgDataUri: string;
}

// Generates an SVG receipt data URL representing authentic paper shop receipts
function createReceiptSvgDataUri({
  vendor,
  address,
  phone,
  invoiceNo,
  date,
  items,
  subtotal,
  tax,
  total,
}: {
  vendor: string;
  address: string;
  phone: string;
  invoiceNo: string;
  date: string;
  items: Array<{ name: string; sku: string; qty: number; unit: number; total: number; cat: string }>;
  subtotal: number;
  tax: number;
  total: number;
}): string {
  const itemRows = items
    .map(
      (it, idx) => `
    <g transform="translate(24, ${230 + idx * 46})">
      <text x="0" y="0" font-family="'Courier New', monospace" font-size="12" font-weight="bold" fill="#111827">${it.name}</text>
      <text x="0" y="16" font-family="'Courier New', monospace" font-size="10" fill="#4B5563">SKU: ${it.sku} [${it.cat}]</text>
      <text x="260" y="0" font-family="'Courier New', monospace" font-size="12" text-anchor="middle" fill="#111827">${it.qty}</text>
      <text x="330" y="0" font-family="'Courier New', monospace" font-size="12" text-anchor="end" fill="#111827">NPR ${it.unit.toFixed(2)}</text>
      <text x="410" y="0" font-family="'Courier New', monospace" font-size="12" font-weight="bold" text-anchor="end" fill="#111827">NPR ${it.total.toFixed(2)}</text>
      <line x1="0" y1="26" x2="410" y2="26" stroke="#E5E7EB" stroke-width="1" stroke-dasharray="3,3" />
    </g>
  `
    )
    .join("");

  const startY = 250 + items.length * 46;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 ${startY + 170}" width="460" height="${startY + 170}">
    <rect width="460" height="${startY + 170}" fill="#FAFAF9" />
    <!-- Paper texture border -->
    <rect x="10" y="10" width="440" height="${startY + 150}" fill="#FFFFFF" stroke="#D6D3D1" stroke-width="1.5" rx="4" />
    
    <!-- Top Header -->
    <text x="230" y="45" font-family="'Courier New', monospace" font-size="20" font-weight="900" text-anchor="middle" fill="#0F172A">${vendor.toUpperCase()}</text>
    <text x="230" y="65" font-family="'Courier New', monospace" font-size="11" text-anchor="middle" fill="#64748B">${address}</text>
    <text x="230" y="80" font-family="'Courier New', monospace" font-size="11" text-anchor="middle" fill="#64748B">TEL: ${phone}</text>
    <line x1="24" y1="95" x2="436" y2="95" stroke="#0F172A" stroke-width="1.5" stroke-dasharray="4,4" />

    <!-- Invoice Details -->
    <text x="24" y="125" font-family="'Courier New', monospace" font-size="12" fill="#334155">INVOICE #: <tspan font-weight="bold" fill="#0F172A">${invoiceNo}</tspan></text>
    <text x="436" y="125" font-family="'Courier New', monospace" font-size="12" text-anchor="end" fill="#334155">DATE: ${date}</text>
    <text x="24" y="145" font-family="'Courier New', monospace" font-size="11" fill="#64748B">CUSTOMER: MotoFix Garage Workshop Bays</text>
    <text x="24" y="162" font-family="'Courier New', monospace" font-size="11" fill="#64748B">TERMS: Net 30 - Wholesale Parts Account</text>

    <!-- Table Header -->
    <rect x="24" y="180" width="412" height="26" fill="#F1F5F9" />
    <text x="32" y="197" font-family="'Courier New', monospace" font-size="11" font-weight="bold" fill="#334155">ITEM / SKU</text>
    <text x="284" y="197" font-family="'Courier New', monospace" font-size="11" font-weight="bold" text-anchor="middle" fill="#334155">QTY</text>
    <text x="354" y="197" font-family="'Courier New', monospace" font-size="11" font-weight="bold" text-anchor="end" fill="#334155">UNIT</text>
    <text x="430" y="197" font-family="'Courier New', monospace" font-size="11" font-weight="bold" text-anchor="end" fill="#334155">TOTAL</text>
    
    <!-- Table Rows -->
    ${itemRows}

    <!-- Totals Area -->
    <g transform="translate(220, ${startY})">
      <line x1="0" y1="0" x2="216" y2="0" stroke="#0F172A" stroke-width="1.5" stroke-dasharray="4,4" />
      <text x="0" y="24" font-family="'Courier New', monospace" font-size="12" fill="#334155">SUBTOTAL:</text>
      <text x="216" y="24" font-family="'Courier New', monospace" font-size="12" text-anchor="end" fill="#334155">NPR ${subtotal.toFixed(2)}</text>
      
      <text x="0" y="44" font-family="'Courier New', monospace" font-size="12" fill="#334155">TAX (8.0%):</text>
      <text x="216" y="44" font-family="'Courier New', monospace" font-size="12" text-anchor="end" fill="#334155">NPR ${tax.toFixed(2)}</text>
      
      <line x1="0" y1="56" x2="216" y2="56" stroke="#0F172A" stroke-width="1" />
      <text x="0" y="76" font-family="'Courier New', monospace" font-size="15" font-weight="bold" fill="#0F172A">TOTAL NPR:</text>
      <text x="216" y="76" font-family="'Courier New', monospace" font-size="16" font-weight="bold" text-anchor="end" fill="#0F172A">NPR ${total.toFixed(2)}</text>
    </g>

    <!-- Footer Barcode & Stamp -->
    <g transform="translate(24, ${startY + 100})">
      <rect x="0" y="0" width="180" height="28" fill="#0F172A" />
      <text x="90" y="18" font-family="'Courier New', monospace" font-size="11" fill="#FFFFFF" text-anchor="middle">||||||||| | ||||| ||||||</text>
      <text x="200" y="18" font-family="'Courier New', monospace" font-size="10" fill="#64748B">THANK YOU FOR YOUR BUSINESS</text>
    </g>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const SAMPLE_RECEIPTS: SampleReceipt[] = [
  {
    id: "sample-1",
    name: "Motul & K&N Restock Delivery",
    vendor: "Metro Moto Supply Wholesalers",
    filename: "metro_moto_receipt_8912.png",
    description: "5x Motul 7100 10W-40 Synthetic Oil + 3x K&N Oil Filters (Matches existing parts)",
    svgDataUri: createReceiptSvgDataUri({
      vendor: "Metro Moto Supply Wholesalers",
      address: "1480 Speedway Blvd, Industrial Park, Bay 4",
      phone: "(555) 019-4822",
      invoiceNo: "INV-MM-8912",
      date: new Date().toISOString().split("T")[0],
      items: [
        {
          name: "Motul 7100 4T 10W-40 Synthetic Oil (1L)",
          sku: "MOT-7100-10W40",
          qty: 5,
          unit: 18.5,
          total: 92.5,
          cat: "Oils & Fluids",
        },
        {
          name: "K&N Oil Filter KN-204-1 Black",
          sku: "FLT-KN-KN204",
          qty: 3,
          unit: 14.5,
          total: 43.5,
          cat: "Oils & Fluids",
        },
      ],
      subtotal: 136.0,
      tax: 10.88,
      total: 146.88,
    }),
  },
  {
    id: "sample-2",
    name: "Brembo & NGK Brake & Electrical Intake",
    vendor: "Apex Racing Distribution",
    filename: "apex_racing_invoice_4410.png",
    description: "4x Brembo Front Brake Pads + 8x NGK Iridium Spark Plugs (Restocks low stock item)",
    svgDataUri: createReceiptSvgDataUri({
      vendor: "Apex Racing Distribution",
      address: "702 Paddock Row, Suite 100",
      phone: "(555) 781-9920",
      invoiceNo: "INV-APX-4410",
      date: new Date(Date.now() - 86400000).toISOString().split("T")[0],
      items: [
        {
          name: "Brembo Sintered Front Brake Pads 07BB",
          sku: "BRK-PAD-07BB",
          qty: 4,
          unit: 42.0,
          total: 168.0,
          cat: "Braking",
        },
        {
          name: "NGK Laser Iridium Spark Plug CR9EIA-9",
          sku: "SPK-NGK-CR9E",
          qty: 8,
          unit: 11.2,
          total: 89.6,
          cat: "Electrical",
        },
      ],
      subtotal: 257.6,
      tax: 20.61,
      total: 278.21,
    }),
  },
  {
    id: "sample-3",
    name: "Dunlop Tires & DID Chain Delivery (New Parts)",
    vendor: "Torque Motorcycle Parts Co.",
    filename: "torque_parts_inv_7721.png",
    description: "2x Dunlop Sportmax Q3+ Rear Tires (New item) + 2x DID 525VX3 Chains",
    svgDataUri: createReceiptSvgDataUri({
      vendor: "Torque Motorcycle Parts Co.",
      address: "330 Grand Prix Way, Tech Harbor",
      phone: "(555) 342-8811",
      invoiceNo: "INV-TRQ-7721",
      date: new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0],
      items: [
        {
          name: "Dunlop Sportmax Q3+ Rear Tire 180/55ZR17",
          sku: "TYR-DNL-Q3P-180",
          qty: 2,
          unit: 189.5,
          total: 379.0,
          cat: "Tires",
        },
        {
          name: "D.I.D 525VX3 X-Ring Drive Chain 120L",
          sku: "CHN-DID-525VX3",
          qty: 2,
          unit: 89.0,
          total: 178.0,
          cat: "Drivetrain",
        },
      ],
      subtotal: 557.0,
      tax: 44.56,
      total: 601.56,
    }),
  },
];
