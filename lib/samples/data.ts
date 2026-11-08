// FICTIONAL SAMPLE DATA. All businesses, people, and amounts are invented for demonstration.
// Dates are fixed relative to the demo reference date 2026-11-08 (DEMO_TODAY).

export const SAMPLE_NOTICE = "Fictional sample data created for demonstration purposes.";

type Row = Record<string, string | number>;

// ---------------- Metro Roofing ----------------
const metroStaleOpen: Array<[string, number, string, string]> = [
  // homeowner, bid, date quoted, last call  (last call > 7 days before 2026-11-08)
  ["Dana Whitfield", 9600, "2026-09-22", "2026-10-02"],
  ["Marcus Bell", 8200, "2026-09-15", "2026-10-09"],
  ["Priya Raman", 7400, "2026-10-01", "2026-10-14"],
  ["Tom & Lisa Grady", 6800, "2026-09-28", "2026-10-06"],
  ["Hector Morales", 5800, "2026-10-05", "2026-10-20"],
  ["Angela Brooks", 5200, "2026-10-08", "2026-10-24"],
  ["Ray Donnelly", 4500, "2026-09-30", "2026-10-16"],
  ["Keisha Monroe", 4300, "2026-10-12", "2026-10-27"],
  ["Gwen Albright", 3900, "2026-10-10", "2026-10-29"],
  ["Samuel Okafor", 3200, "2026-10-15", "2026-10-30"],
  ["Linda Choi", 3100, "2026-10-14", "2026-10-31"],
];
const metroRecentOpen: Array<[string, number, string, string]> = [
  ["Victor Hale", 7200, "2026-10-20", "2026-11-05"],
  ["Rosa Delgado", 5400, "2026-10-25", "2026-11-06"],
  ["Ben Kowalski", 3800, "2026-10-28", "2026-11-04"],
  ["Nora Fitzgerald", 6100, "2026-10-30", "2026-11-07"],
  ["Jamal Pierce", 4900, "2026-11-01", "2026-11-03"],
];
const metroUnknownOpen: Array<[string, number, string]> = [
  ["Carla Jennings", 5600, "2026-10-03"],
  ["Doug Petersen", 3300, "2026-10-18"],
];
const metroWon: Array<[string, number, string]> = [
  ["Ellen Yates", 11200, "2026-06-04"], ["Frank Russo", 8700, "2026-06-11"], ["Imani Carter", 6400, "2026-06-23"],
  ["Paul Nguyen", 9800, "2026-07-02"], ["Sofia Ramirez", 7300, "2026-07-14"], ["Greg Thornton", 12500, "2026-07-21"],
  ["Monica Hayes", 5900, "2026-08-03"], ["Derek Lam", 8100, "2026-08-12"], ["Olivia Grant", 6900, "2026-08-25"],
  ["Walter Simms", 10400, "2026-09-03"], ["Tara Quinn", 7700, "2026-09-10"], ["Hank Barlow", 9100, "2026-09-18"],
  ["Irene Castillo", 6600, "2026-10-02"], ["Leon Dupree", 8800, "2026-10-09"],
];
const metroLost: Array<[string, number, string]> = [
  ["Chris Avery", 7900, "2026-06-09"], ["Janet Moss", 5100, "2026-06-30"], ["Kurt Wagner", 9400, "2026-07-08"],
  ["Lena Ortiz", 4600, "2026-07-29"], ["Mike Sutter", 6200, "2026-08-18"], ["Nadia Farouk", 8300, "2026-09-01"],
  ["Owen Pratt", 5500, "2026-09-24"], ["Paula Reese", 7000, "2026-10-06"],
];

function us(d: string) {
  const [y, m, day] = d.split("-");
  return `${Number(m)}/${Number(day)}/${y}`;
}

export function metroEstimates(withContacts: boolean): Row[] {
  const rows: Array<Row & { _sort: string }> = [];
  metroStaleOpen.forEach(([n, a, q, c], i) => rows.push({ Homeowner: n, "Bid Amt": a, "Date Quoted": us(q), ...(withContacts ? { "Last Call": us(c) } : {}), Result: i % 3 === 0 ? "Waiting on HO" : "Pending", _sort: q }));
  metroRecentOpen.forEach(([n, a, q, c]) => rows.push({ Homeowner: n, "Bid Amt": a, "Date Quoted": us(q), ...(withContacts ? { "Last Call": us(c) } : {}), Result: "Pending", _sort: q }));
  metroUnknownOpen.forEach(([n, a, q]) => rows.push({ Homeowner: n, "Bid Amt": a, "Date Quoted": us(q), ...(withContacts ? { "Last Call": "Unknown" } : {}), Result: "Pending", _sort: q }));
  metroWon.forEach(([n, a, q]) => rows.push({ Homeowner: n, "Bid Amt": a, "Date Quoted": us(q), ...(withContacts ? { "Last Call": us(q) } : {}), Result: "Sold", _sort: q }));
  metroLost.forEach(([n, a, q]) => rows.push({ Homeowner: n, "Bid Amt": a, "Date Quoted": us(q), ...(withContacts ? { "Last Call": us(q) } : {}), Result: "Lost", _sort: q }));
  return rows.sort((a, b) => a._sort.localeCompare(b._sort)).map(({ _sort, ...r }) => { void _sort; return r; });
}

export const METRO_EXPECTED = { estimates: 40, open: 18, staleCount: 11, staleValue: 62000, unknownContact: 2 };

export function metroInvoices(): Row[] {
  // QuickBooks-style export: Amount is the invoice total, Open Balance is what's still owed.
  const r: Array<[string, string, string, string, number, number]> = [
    ["1041", "Ellen Yates", "2026-06-20", "2026-07-20", 11200, 0],
    ["1042", "Frank Russo", "2026-06-28", "2026-07-28", 8700, 0],
    ["1043", "Imani Carter", "2026-07-08", "2026-08-07", 6400, 1400],
    ["1044", "Paul Nguyen", "2026-07-18", "2026-08-17", 9800, 0],
    ["1045", "Sofia Ramirez", "2026-08-01", "2026-08-31", 7300, 7300],
    ["1046", "Greg Thornton", "2026-08-09", "2026-09-08", 12500, 4500],
    ["1047", "Monica Hayes", "2026-08-20", "2026-09-19", 5900, 0],
    ["1048", "Derek Lam", "2026-09-02", "2026-10-02", 8100, 8100],
    ["1049", "Olivia Grant", "2026-09-15", "2026-10-15", 6900, 0],
    ["1050", "Walter Simms", "2026-09-25", "2026-10-25", 10400, 10400],
    ["1051", "Tara Quinn", "2026-10-12", "2026-11-11", 7700, 7700],
    ["1052", "Hank Barlow", "2026-10-22", "2026-11-21", 9100, 9100],
  ];
  return r.map(([num, c, d, due, amt, bal]) => ({ Num: num, Customer: c, Date: us(d), "Due Date": us(due), Amount: amt, "Open Balance": bal }));
}
// Overdue at 2026-11-08: 1043 (1400), 1045 (7300), 1046 (4500), 1048 (8100), 1050 (10400) = 5 invoices, 31,700.
export const METRO_INVOICE_EXPECTED = { overdueCount: 5, overdueTotal: 31700 };

// ---------------- BrightPath Consulting ----------------
export function brightpathProposals(): Row[] {
  const r: Array<[string, number, string, string, string]> = [
    ["Harbor Health Partners", 18500, "2026-08-04", "2026-08-20", "Signed"],
    ["Lakeview School District", 12000, "2026-08-11", "2026-09-02", "Declined"],
    ["Copperline Logistics", 22000, "2026-08-25", "2026-10-12", "Proposal Sent"],
    ["Greenway Credit Union", 9500, "2026-09-01", "2026-10-21", "Negotiating"],
    ["Summit Dental Group", 7800, "2026-09-08", "2026-09-29", "Closed"],
    ["Riverbend Arts Council", 4200, "2026-09-15", "2026-11-02", "Proposal Sent"],
    ["Northgate Manufacturing", 31000, "2026-09-22", "2026-10-08", "Negotiating"],
    ["Pinecrest Senior Living", 14500, "2026-09-29", "2026-10-15", "Signed"],
    ["Bluefin Seafood Co.", 6800, "2026-10-06", "2026-10-19", "Closed"],
    ["Meridian Architects", 11200, "2026-10-13", "2026-11-05", "Proposal Sent"],
    ["Oakridge Animal Hospital", 5600, "2026-10-20", "2026-10-27", "Proposal Sent"],
    ["Cedar Point Realty", 8900, "2026-10-27", "2026-11-06", "Negotiating"],
    ["Westfield Library Foundation", 3900, "2026-07-14", "2026-07-30", "Declined"],
    ["Ironwood Fitness", 7200, "2026-07-21", "2026-08-05", "Signed"],
  ];
  return r.map(([o, f, s, e, st]) => ({ Organization: o, "Proposal Fee": `$${f.toLocaleString("en-US")}`, Submitted: s, "Last Email": e, Stage: st }));
}

export function brightpathInvoices(): Row[] {
  const r: Array<[string, string, string, string, number, number]> = [
    ["BP-201", "Harbor Health Partners", "2026-08-15", "2026-09-14", 6200, 2400],
    ["BP-202", "Ironwood Fitness", "2026-08-20", "2026-09-19", 3600, 1800],
    ["BP-203", "Pinecrest Senior Living", "2026-09-01", "2026-10-01", 4800, 1500],
    ["BP-204", "Harbor Health Partners", "2026-09-10", "2026-10-10", 6200, 1250],
    ["BP-205", "Summit Dental Group", "2026-09-18", "2026-10-18", 3900, 1100],
    ["BP-206", "Ironwood Fitness", "2026-09-25", "2026-10-25", 3600, 1150],
    ["BP-207", "Pinecrest Senior Living", "2026-10-05", "2026-11-04", 4800, 0],
    ["BP-208", "Harbor Health Partners", "2026-10-10", "2026-11-09", 6200, 6200],
    ["BP-209", "Bluefin Seafood Co.", "2026-10-20", "2026-11-19", 3400, 3400],
    ["BP-210", "Summit Dental Group", "2026-10-28", "2026-11-27", 3900, 3900],
    ["BP-198", "Westfield Library Foundation", "2026-07-01", "2026-07-31", 2000, 0],
    ["BP-199", "Ironwood Fitness", "2026-07-25", "2026-08-24", 3600, 0],
    ["BP-200", "Harbor Health Partners", "2026-08-01", "2026-08-31", 6200, 0],
    ["BP-197", "Lakeview School District", "2026-06-15", "2026-07-15", 1500, 0],
  ];
  return r.map(([n, c, d, due, t, b]) => ({ "Invoice #": n, Client: c, "Invoice Date": d, Due: due, Total: t, "Balance Due": b }));
}
export const BRIGHTPATH_EXPECTED = { overdueCount: 6, overdueTotal: 9200 };

// ---------------- FreshStart Cleaning ----------------
const fsClients = ["Parkside Office Tower", "Elm Street Medical", "Gateway Bank Branch", "Sunrise Daycare", "Lincoln Law Group", "Metro Fitness Club", "Harbor View Condos"];
export function freshstartInvoices(): Row[] {
  const rows: Row[] = [];
  const months = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
  let n = 3100;
  const balances: Record<string, number> = {
    // overdue unpaid / partial (by invoice no), rest paid unless not yet due
    "3104": 2150, "3110": 980, "3112": 1650, "3117": 3200, "3118": 1275, "3123": 2400, "3124": 1890,
  };
  months.forEach((m, mi) => {
    fsClients.forEach((c, ci) => {
      if ((mi + ci) % 5 === 4) return;
      n += 1;
      const issued = `${m}-${String(3 + ci * 3).padStart(2, "0")}`;
      const [y, mo, d] = issued.split("-").map(Number);
      const due = new Date(Date.UTC(y, mo - 1, d + 30)).toISOString().slice(0, 10);
      const total = 1200 + ci * 350 + mi * 40;
      const notDue = due >= "2026-11-08";
      const bal = balances[String(n)] ?? (notDue ? total : 0);
      rows.push({ "Invoice No": String(n), Customer: c, Issued: issued, "Due Date": due, "Total Amount": total, "Amount Due": Math.min(bal, total) });
    });
  });
  return rows;
}

export function freshstartPayments(): Row[] {
  return freshstartInvoices()
    .filter((r) => Number(r["Amount Due"]) < Number(r["Total Amount"]))
    .map((r) => {
      const paid = Number(r["Total Amount"]) - Number(r["Amount Due"]);
      return { "Invoice No": r["Invoice No"], "Amount Paid": paid, "Date Received": String(r["Due Date"]), Method: "ACH" };
    });
}

export function freshstartExpenses(): Row[] {
  const rows: Row[] = [];
  const months = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
  months.forEach((m, i) => {
    rows.push({ Date: `${m}-01`, Vendor: "CleanCo Supply", Category: "Supplies", Amount: 1800 + i * 260 });
    rows.push({ Date: `${m}-15`, Vendor: "CleanCo Supply", Category: "supplies", Amount: 600 + i * 90 });
    rows.push({ Date: `${m}-05`, Vendor: "Payroll", Category: "Labor", Amount: 14200 + (i % 2) * 300 });
    rows.push({ Date: `${m}-20`, Vendor: "Payroll", Category: "Labor", Amount: 14200 });
    rows.push({ Date: `${m}-10`, Vendor: "Shell Fleet", Category: "Fuel", Amount: 1100 + (i % 3) * 70 });
    rows.push({ Date: `${m}-12`, Vendor: "Van Lease Co", Category: "Equipment", Amount: 950 });
  });
  return rows;
}

// ---------------- Neighborhood Kitchen ----------------
export function kitchenExpenses(): Row[] {
  const rows: Row[] = [];
  const months = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
  const produce = [5200, 5350, 5600, 6300, 6900, 7400];
  const meat = [6100, 6200, 6450, 7100, 7650, 8200];
  const dairy = [1900, 1950, 2000, 2150, 2300, 2400];
  months.forEach((m, i) => {
    rows.push({ Date: `${m}-03`, Vendor: "Valley Produce", Category: "Food - Produce", Amount: produce[i] / 2 });
    rows.push({ Date: `${m}-17`, Vendor: "Valley Produce", Category: "Food - Produce", Amount: produce[i] / 2 });
    rows.push({ Date: `${m}-06`, Vendor: "Prime Meats Wholesale", Category: "Food - Meat", Amount: meat[i] });
    rows.push({ Date: `${m}-09`, Vendor: "Dairyland Distributors", Category: "Food - Dairy", Amount: dairy[i] });
    rows.push({ Date: `${m}-15`, Vendor: "Payroll", Category: "Labor", Amount: 18400 + (i % 2) * 250 });
    rows.push({ Date: `${m}-28`, Vendor: "City Power & Gas", Category: "Utilities", Amount: 2100 + (i >= 2 && i <= 3 ? 300 : 0) });
    rows.push({ Date: `${m}-01`, Vendor: "Main St Properties", Category: "Rent", Amount: 6500 });
    rows.push({ Date: `${m}-21`, Vendor: "Restaurant Depot", Category: "Supplies", Amount: 850 + (i % 3) * 40 });
  });
  return rows;
}

// ---------------- The Beauty Lounge (manual weekly entries) ----------------
export function beautyLoungeWeeks() {
  return [
    { week_start: "2026-09-28", available_slots: 120, booked: 96, cancellations: 7, unfilled_slots: 24, avg_service_value: 68, weekly_sales: 6050 },
    { week_start: "2026-10-05", available_slots: 120, booked: 92, cancellations: 9, unfilled_slots: 28, avg_service_value: 70, weekly_sales: 5810 },
    { week_start: "2026-10-12", available_slots: 120, booked: 101, cancellations: 6, unfilled_slots: 19, avg_service_value: 69, weekly_sales: 6555 },
    { week_start: "2026-10-19", available_slots: 120, booked: 88, cancellations: 11, unfilled_slots: 32, avg_service_value: 71, weekly_sales: 5470 },
    { week_start: "2026-10-26", available_slots: 120, booked: 94, cancellations: 8, unfilled_slots: 26, avg_service_value: 70, weekly_sales: 6020 },
  ];
}
