/**
 * MotorSpecs demo data — ALL FICTIONAL.
 *
 * Every person, company, email, phone number and document here is invented for
 * the prototype. Emails use the reserved `.example` TLD and phone numbers use
 * ranges reserved for fiction/drama (UK 07700 900xxx, US 555-01xx, AU 0491 570 xxx).
 * Every row is flagged `is_demo = true` and can be removed with
 * supabase/scripts/purge_demo_data.sql.
 *
 * This single source feeds both supabase/seed.sql (via `npm run db:seed:generate`)
 * and the embedded demo database used when no Supabase project is configured.
 */

export const DEMO_PASSWORD = "MotorSpecsDemo!2026";

/** Invite code seeded for the "Mohamed Farah" lead so linking can be tried in demo mode. */
export const DEMO_INVITE_CODE = "DEMO-LINK-2026";

const uuid = (prefix: string, n: number) =>
  `${prefix}000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;

export const ids = {
  user: (n: number) => uuid("a0", n),
  customer: (n: number) => uuid("c0", n),
  vehicle: (n: number) => uuid("b0", n),
  inquiry: (n: number) => uuid("e0", n),
  offer: (n: number) => uuid("f0", n),
  reservation: (n: number) => uuid("d1", n),
  sale: (n: number) => uuid("d2", n),
  payment: (n: number) => uuid("d3", n),
  document: (n: number) => uuid("d4", n),
  task: (n: number) => uuid("d5", n),
};

export type SeedUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "sales" | "customer";
  locale: "en" | "ja" | "ar";
  isOwner?: boolean;
  /** Customer record linked to this login (customers only). */
  customerId?: string;
};

export const seedUsers: SeedUser[] = [
  { id: ids.user(1), email: "owner@demo.motorspecs.example", name: "Kenji Mori (Demo Owner)", role: "admin", locale: "en", isOwner: true },
  { id: ids.user(2), email: "aiko.sales@demo.motorspecs.example", name: "Aiko Sato (Demo Sales)", role: "sales", locale: "en" },
  { id: ids.user(3), email: "daniel.sales@demo.motorspecs.example", name: "Daniel Okoro (Demo Sales)", role: "sales", locale: "en" },
  { id: ids.user(11), email: "amara.buyer@demo.motorspecs.example", name: "Amara Nwosu", role: "customer", locale: "en", customerId: ids.customer(1) },
  { id: ids.user(12), email: "omar.buyer@demo.motorspecs.example", name: "Omar Haddad", role: "customer", locale: "ar", customerId: ids.customer(2) },
  { id: ids.user(13), email: "grace.buyer@demo.motorspecs.example", name: "Grace Wanjiru", role: "customer", locale: "en", customerId: ids.customer(3) },
  { id: ids.user(14), email: "liam.buyer@demo.motorspecs.example", name: "Liam Walsh", role: "customer", locale: "en", customerId: ids.customer(4) },
  { id: ids.user(15), email: "yuki.buyer@demo.motorspecs.example", name: "Yuki Nakamura", role: "customer", locale: "ja", customerId: ids.customer(5) },
  { id: ids.user(16), email: "carlos.buyer@demo.motorspecs.example", name: "Carlos Mendes", role: "customer", locale: "en", customerId: ids.customer(8) },
];

export const OWNER = ids.user(1);
export const AIKO = ids.user(2);
export const DANIEL = ids.user(3);

export type SeedCustomer = {
  id: string;
  authUserId?: string;
  fullName: string;
  company?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  country: string;
  city?: string;
  destinationPort?: string;
  language: "en" | "ja" | "ar";
  preferredContact?: "email" | "phone" | "whatsapp";
  status: "lead" | "active";
  verification: "unverified" | "pending" | "verified";
  verifiedName?: string;
  verifiedCompany?: string;
  source: "website" | "staff" | "referral";
  /** Assignment history, oldest first. Last entry is the current owner. */
  assignments: { to: string | null; daysAgo: number; reason?: string; by?: string }[];
  tags?: string[];
  createdDaysAgo: number;
  createdBy?: string;
};

export const seedCustomers: SeedCustomer[] = [
  {
    id: ids.customer(1), authUserId: ids.user(11), fullName: "Amara Nwosu", company: "Nwosu Auto Imports Ltd [Demo]",
    email: "amara.buyer@demo.motorspecs.example", phone: "+44 7700 900101", whatsapp: "+44 7700 900101",
    country: "NG", city: "Lagos", destinationPort: "Lagos (Tin Can Island)", language: "en", preferredContact: "whatsapp",
    status: "active", verification: "verified", verifiedName: "Amara Nwosu", verifiedCompany: "Nwosu Auto Imports Ltd [Demo]",
    source: "website", assignments: [{ to: AIKO, daysAgo: 40, reason: "Website sign-up, West Africa desk", by: OWNER }],
    tags: ["dealer", "repeat"], createdDaysAgo: 41,
  },
  {
    id: ids.customer(2), authUserId: ids.user(12), fullName: "Omar Haddad", company: "Haddad Trading FZE [Demo]",
    email: "omar.buyer@demo.motorspecs.example", phone: "+44 7700 900102", whatsapp: "+44 7700 900102",
    country: "AE", city: "Dubai", destinationPort: "Jebel Ali", language: "ar", preferredContact: "whatsapp",
    status: "active", verification: "verified", verifiedName: "Omar Haddad", verifiedCompany: "Haddad Trading FZE [Demo]",
    source: "website", assignments: [{ to: DANIEL, daysAgo: 30, reason: "Middle East accounts", by: OWNER }],
    tags: ["dealer"], createdDaysAgo: 31,
  },
  {
    id: ids.customer(3), authUserId: ids.user(13), fullName: "Grace Wanjiru",
    email: "grace.buyer@demo.motorspecs.example", phone: "+44 7700 900103",
    country: "KE", city: "Nairobi", destinationPort: "Mombasa", language: "en", preferredContact: "email",
    status: "active", verification: "verified", verifiedName: "Grace Wanjiru",
    source: "referral", assignments: [{ to: AIKO, daysAgo: 95, by: OWNER }],
    tags: ["private buyer"], createdDaysAgo: 96,
  },
  {
    id: ids.customer(4), authUserId: ids.user(14), fullName: "Liam Walsh", company: "Walsh Motors NZ [Demo]",
    email: "liam.buyer@demo.motorspecs.example", phone: "+61 491 570 156",
    country: "NZ", city: "Auckland", destinationPort: "Auckland", language: "en", preferredContact: "email",
    status: "active", verification: "pending",
    source: "website",
    assignments: [
      { to: AIKO, daysAgo: 20, by: OWNER },
      { to: DANIEL, daysAgo: 6, reason: "Balancing workload — Daniel covers Oceania", by: OWNER },
    ],
    createdDaysAgo: 21,
  },
  {
    id: ids.customer(5), authUserId: ids.user(15), fullName: "Yuki Nakamura", company: "Nakamura Shoji [Demo]",
    email: "yuki.buyer@demo.motorspecs.example", phone: "+1 202-555-0147",
    country: "JP", city: "Osaka", language: "ja", preferredContact: "email",
    status: "active", verification: "unverified",
    source: "website", assignments: [{ to: OWNER, daysAgo: 3, reason: "Owner handles domestic trade partners", by: OWNER }],
    createdDaysAgo: 4,
  },
  {
    id: ids.customer(6), fullName: "Mohamed Farah", company: "Farah Logistics [Demo]",
    email: "mohamed.lead@demo.motorspecs.example", phone: "+44 7700 900106", whatsapp: "+44 7700 900106",
    country: "TZ", city: "Dar es Salaam", destinationPort: "Dar es Salaam", language: "en", preferredContact: "whatsapp",
    status: "lead", verification: "unverified",
    source: "staff", assignments: [{ to: AIKO, daysAgo: 12, by: AIKO }],
    tags: ["trade fair lead"], createdDaysAgo: 12, createdBy: AIKO,
  },
  {
    id: ids.customer(7), fullName: "Sarah Kim",
    email: "sarah.lead@demo.motorspecs.example", phone: "+1 202-555-0182",
    country: "JM", city: "Kingston", destinationPort: "Kingston", language: "en", preferredContact: "phone",
    status: "lead", verification: "unverified",
    source: "staff", assignments: [], createdDaysAgo: 2, createdBy: OWNER,
  },
  {
    id: ids.customer(8), authUserId: ids.user(16), fullName: "Carlos Mendes",
    email: "carlos.buyer@demo.motorspecs.example", phone: "+1 202-555-0163",
    country: "GY", city: "Georgetown", destinationPort: "Georgetown", language: "en", preferredContact: "email",
    status: "active", verification: "unverified",
    source: "website", assignments: [], createdDaysAgo: 1,
  },
];

// -----------------------------------------------------------------------------
// Lookups
// -----------------------------------------------------------------------------
export const seedMakes: { name: string; slug: string; models: string[] }[] = [
  { name: "Toyota", slug: "toyota", models: ["Land Cruiser Prado", "Hiace Van", "Corolla Fielder", "Prius", "Harrier", "Alphard", "Hilux", "RAV4", "Aqua", "Probox"] },
  { name: "Nissan", slug: "nissan", models: ["X-Trail", "Note", "Caravan", "Serena", "NV200"] },
  { name: "Honda", slug: "honda", models: ["Fit", "Vezel", "Freed", "Stepwgn"] },
  { name: "Mazda", slug: "mazda", models: ["CX-5", "Demio", "Axela"] },
  { name: "Subaru", slug: "subaru", models: ["Forester", "Impreza"] },
  { name: "Mitsubishi", slug: "mitsubishi", models: ["Delica D:5", "Pajero", "Canter"] },
  { name: "Suzuki", slug: "suzuki", models: ["Jimny", "Every"] },
  { name: "Isuzu", slug: "isuzu", models: ["Elf"] },
  { name: "Hino", slug: "hino", models: ["Dutro"] },
  { name: "Lexus", slug: "lexus", models: ["RX"] },
  { name: "Komatsu", slug: "komatsu", models: ["PC30"] },
];

export const seedBodyTypes = [
  "sedan", "hatchback", "wagon", "suv", "van", "minivan", "pickup", "truck", "bus", "coupe", "convertible", "machinery",
];

export const seedLocations = [
  { name: "Yokohama Yard", port: "Yokohama" },
  { name: "Nagoya Yard", port: "Nagoya" },
  { name: "Kobe Yard", port: "Kobe" },
  { name: "Osaka Yard", port: "Osaka" },
];

export const seedFeatures: { code: string; category: string }[] = [
  { code: "air_conditioning", category: "comfort" },
  { code: "climate_control", category: "comfort" },
  { code: "power_steering", category: "comfort" },
  { code: "power_windows", category: "comfort" },
  { code: "keyless_entry", category: "comfort" },
  { code: "push_start", category: "comfort" },
  { code: "cruise_control", category: "comfort" },
  { code: "heated_seats", category: "comfort" },
  { code: "abs", category: "safety" },
  { code: "airbags", category: "safety" },
  { code: "back_camera", category: "safety" },
  { code: "parking_sensors", category: "safety" },
  { code: "lane_assist", category: "safety" },
  { code: "collision_mitigation", category: "safety" },
  { code: "alloy_wheels", category: "exterior" },
  { code: "sunroof", category: "exterior" },
  { code: "roof_rails", category: "exterior" },
  { code: "led_headlights", category: "exterior" },
  { code: "fog_lights", category: "exterior" },
  { code: "leather_seats", category: "interior" },
  { code: "third_row_seat", category: "interior" },
  { code: "power_sliding_door", category: "interior" },
  { code: "navigation", category: "audio" },
  { code: "bluetooth", category: "audio" },
  { code: "rear_entertainment", category: "audio" },
  { code: "tow_hitch", category: "utility" },
  { code: "diff_lock", category: "utility" },
  { code: "tail_lift", category: "utility" },
];

// -----------------------------------------------------------------------------
// Vehicles
// -----------------------------------------------------------------------------
export type SeedVehicle = {
  n: number;
  ref: string;
  make: string;
  model: string;
  body: string;
  location: number; // 1-based index into seedLocations
  regYear?: number;
  regMonth?: number;
  grade?: string;
  chassis?: string;
  modelCode?: string;
  engineCode?: string;
  conditionGrade?: string;
  auctionSheetRef?: string;
  mileage?: number;
  hours?: number;
  cc?: number;
  transmission?: string;
  fuel?: string;
  drive?: string;
  steering?: string;
  color?: string;
  colorHex: string;
  interior?: string;
  doors?: number;
  seats?: number;
  view360?: boolean;
  dims?: [number, number, number];
  m3?: number;
  weight?: number;
  grossWeight?: number;
  maxLoad?: number;
  tyre?: string;
  price?: number;
  previousPrice?: number;
  askPrice?: boolean;
  status: "draft" | "published" | "archived";
  featured?: boolean;
  publishedDaysAgo?: number;
  costJpy?: number;
  costUsd?: number;
  supplier?: string;
  auctionHouse?: string;
  features: string[];
  photos: number;
  inspectionSheet?: boolean;
  privateAuctionSheet?: boolean;
  en: { title: string; description: string; remarks?: string };
  ja?: { title: string; description: string; remarks?: string };
  ar?: { title: string; description: string; remarks?: string };
};

export const seedVehicles: SeedVehicle[] = [
  {
    n: 1, ref: "MS24001", make: "toyota", model: "Land Cruiser Prado", body: "suv", location: 1,
    regYear: 2019, regMonth: 6, grade: "TX-L Package", chassis: "TRJ150-0100231", modelCode: "CBA-TRJ150W", engineCode: "2TR",
    conditionGrade: "4.5", auctionSheetRef: "USS-YOK-2026-40312", mileage: 48200, cc: 2690, transmission: "AT", fuel: "petrol",
    drive: "4WD", steering: "RHD", color: "Pearl White", colorHex: "#eef0f2", interior: "Black", doors: 5, seats: 7, view360: true,
    dims: [4760, 1885, 1850], m3: 16.6, weight: 2060, grossWeight: 2445, tyre: "265/65R17", price: 31800, previousPrice: 32900,
    status: "published", publishedDaysAgo: 35, featured: true, costJpy: 3950000, costUsd: 26600, supplier: "Demo Auction Agent A", auctionHouse: "USS Yokohama",
    features: ["air_conditioning", "power_steering", "power_windows", "keyless_entry", "push_start", "abs", "airbags", "back_camera", "alloy_wheels", "roof_rails", "leather_seats", "third_row_seat", "navigation", "bluetooth", "diff_lock"],
    photos: 4, inspectionSheet: true, privateAuctionSheet: true,
    en: { title: "2019 Toyota Land Cruiser Prado TX-L 7-Seater", description: "One-owner Prado with full service records, third-row seating and the TX-L leather package. Timing chain engine, locking centre differential and factory navigation. Underbody inspected and rust-free.", remarks: "Spare key included. Minor stone chips on bonnet (see photos)." },
    ja: { title: "2019年 トヨタ ランドクルーザープラド TX-L 7人乗り", description: "ワンオーナー、整備記録簿付き。TX-Lレザーパッケージ、3列シート、純正ナビ装備。下回り点検済み、錆なし。", remarks: "スペアキー付き。ボンネットに小さな飛び石傷あり。" },
    ar: { title: "تويوتا لاند كروزر برادو TX-L موديل 2019 - 7 مقاعد", description: "مالك واحد مع سجل صيانة كامل، صف ثالث من المقاعد وحزمة TX-L الجلدية. قفل الترس التفاضلي الأوسط ونظام ملاحة أصلي. تم فحص الهيكل السفلي وخالٍ من الصدأ.", remarks: "يشمل مفتاحًا احتياطيًا. خدوش صغيرة من الحصى على غطاء المحرك." },
  },
  {
    n: 2, ref: "MS24002", make: "toyota", model: "Hiace Van", body: "van", location: 2,
    regYear: 2018, regMonth: 3, grade: "Super GL Dark Prime", chassis: "GDH201-1004412", modelCode: "QDF-GDH201V", engineCode: "1GD",
    conditionGrade: "4", auctionSheetRef: "TAA-NGY-2026-11820", mileage: 91300, cc: 2750, transmission: "AT", fuel: "diesel",
    drive: "2WD", steering: "RHD", color: "Silver", colorHex: "#b8bcc2", interior: "Grey", doors: 5, seats: 5,
    dims: [4695, 1695, 1980], m3: 15.76, weight: 1990, grossWeight: 3050, maxLoad: 1000, tyre: "195/80R15", price: 24500,
    status: "published", publishedDaysAgo: 28, featured: true, costJpy: 2980000, costUsd: 20100, supplier: "Demo Dealer Nagoya", auctionHouse: "TAA Nagoya",
    features: ["air_conditioning", "power_steering", "power_windows", "keyless_entry", "abs", "airbags", "back_camera", "navigation", "led_headlights"],
    photos: 4, inspectionSheet: true,
    en: { title: "2018 Toyota Hiace Van Super GL Dark Prime Diesel", description: "Popular 1GD diesel Super GL in Dark Prime trim. Wide rear loading area with factory floor boards, LED headlights and reversing camera. Ideal for commercial and shuttle use.", remarks: "Seat covers fitted. Light wear on cargo floor." },
    ar: { title: "تويوتا هايس فان سوبر جي إل دارك برايم ديزل 2018", description: "محرك ديزل 1GD الشهير بفئة دارك برايم. مساحة تحميل خلفية واسعة، مصابيح LED وكاميرا خلفية. مثالية للاستخدام التجاري ونقل الركاب." },
  },
  {
    n: 3, ref: "MS24003", make: "nissan", model: "X-Trail", body: "suv", location: 1,
    regYear: 2017, regMonth: 11, grade: "20X Hybrid", chassis: "HNT32-0120771", modelCode: "DAA-HNT32", engineCode: "MR20",
    conditionGrade: "4", mileage: 62100, cc: 1990, transmission: "CVT", fuel: "hybrid", drive: "4WD", steering: "RHD",
    color: "Diamond Black", colorHex: "#1c1f24", interior: "Black", doors: 5, seats: 5, dims: [4690, 1820, 1740], m3: 14.85,
    weight: 1630, tyre: "225/60R18", price: 14200, status: "published", publishedDaysAgo: 90,
    costJpy: 1620000, costUsd: 11000, supplier: "Demo Auction Agent B", auctionHouse: "JU Kanagawa",
    features: ["air_conditioning", "power_steering", "keyless_entry", "push_start", "abs", "airbags", "back_camera", "lane_assist", "roof_rails", "navigation", "heated_seats"],
    photos: 4,
    en: { title: "2017 Nissan X-Trail 20X Hybrid 4WD", description: "Efficient hybrid X-Trail with intelligent 4WD, heated seats, around-view camera and water-resistant interior trim. Great family SUV with low running costs." },
  },
  {
    n: 4, ref: "MS24004", make: "suzuki", model: "Jimny", body: "suv", location: 3,
    regYear: 2021, regMonth: 4, grade: "XC", chassis: "JB64W-201553", modelCode: "3BA-JB64W", engineCode: "R06A",
    conditionGrade: "4.5", mileage: 21800, cc: 658, transmission: "MT", fuel: "petrol", drive: "4WD", steering: "RHD",
    color: "Jungle Green", colorHex: "#4b5d3a", interior: "Black", doors: 3, seats: 4, dims: [3395, 1475, 1725], m3: 8.64,
    weight: 1040, tyre: "175/80R16", price: 17900, previousPrice: 18600, status: "published", publishedDaysAgo: 22, featured: true,
    costJpy: 2150000, costUsd: 14500, supplier: "Demo Dealer Kobe",
    features: ["air_conditioning", "power_steering", "power_windows", "keyless_entry", "abs", "airbags", "collision_mitigation", "led_headlights", "cruise_control"],
    photos: 4, inspectionSheet: true,
    en: { title: "2021 Suzuki Jimny XC 5-Speed Manual", description: "Highly sought-after JB64 Jimny in Jungle Green with the 5-speed manual gearbox. Ladder frame, low-range transfer case and Suzuki Safety Support. Low mileage, one owner." },
    ja: { title: "2021年 スズキ ジムニー XC 5速MT", description: "人気のJB64ジムニー、ジャングルグリーン、5速マニュアル。ラダーフレーム、副変速機付き、スズキセーフティサポート装備。低走行ワンオーナー。" },
  },
  {
    n: 5, ref: "MS24005", make: "toyota", model: "Alphard", body: "minivan", location: 4,
    regYear: 2020, regMonth: 8, grade: "2.5S C Package", chassis: "AGH30-0330021", modelCode: "3BA-AGH30W", engineCode: "2AR",
    conditionGrade: "4.5", mileage: 38500, cc: 2490, transmission: "CVT", fuel: "petrol", drive: "2WD", steering: "RHD",
    color: "Black", colorHex: "#111317", interior: "Black leather", doors: 5, seats: 7, view360: true, dims: [4950, 1850, 1935], m3: 17.8,
    weight: 2100, tyre: "235/50R18", askPrice: true, price: 41500, status: "published", publishedDaysAgo: 10, featured: true,
    costJpy: 5200000, costUsd: 35000, supplier: "Demo Auction Agent A", auctionHouse: "USS Osaka",
    features: ["climate_control", "power_steering", "keyless_entry", "push_start", "cruise_control", "abs", "airbags", "back_camera", "lane_assist", "collision_mitigation", "sunroof", "leather_seats", "power_sliding_door", "third_row_seat", "rear_entertainment", "navigation", "bluetooth"],
    photos: 4,
    en: { title: "2020 Toyota Alphard 2.5S C Package — Twin Sunroof", description: "Top-spec Alphard with executive lounge-style captain seats, twin sunroof, rear entertainment and power sliding doors both sides. Toyota Safety Sense fitted." },
    ja: { title: "2020年 トヨタ アルファード 2.5S Cパッケージ ツインムーンルーフ", description: "エグゼクティブ仕様のキャプテンシート、ツインムーンルーフ、後席モニター、両側パワースライドドア。トヨタセーフティセンス装備。" },
    ar: { title: "تويوتا ألفارد 2.5S حزمة C موديل 2020 - فتحة سقف مزدوجة", description: "ألفارد بأعلى المواصفات مع مقاعد كابتن فاخرة وفتحة سقف مزدوجة ونظام ترفيه خلفي وأبواب منزلقة كهربائية على الجانبين." },
  },
  {
    n: 6, ref: "MS24006", make: "toyota", model: "Hilux", body: "pickup", location: 1,
    regYear: 2019, regMonth: 2, grade: "Z", chassis: "GUN125-3910022", modelCode: "QDF-GUN125", engineCode: "2GD",
    conditionGrade: "4", mileage: 67400, cc: 2390, transmission: "AT", fuel: "diesel", drive: "4WD", steering: "RHD",
    color: "Attitude Black", colorHex: "#23262b", interior: "Black", doors: 4, seats: 5, dims: [5335, 1855, 1800], m3: 17.81,
    weight: 2080, grossWeight: 2655, maxLoad: 500, tyre: "265/65R17", price: 27600, status: "published", publishedDaysAgo: 18,
    costJpy: 3400000, costUsd: 22900, supplier: "Demo Dealer Yokohama",
    features: ["air_conditioning", "power_steering", "power_windows", "keyless_entry", "push_start", "abs", "airbags", "back_camera", "alloy_wheels", "led_headlights", "tow_hitch", "diff_lock"],
    photos: 4,
    en: { title: "2019 Toyota Hilux Z Double Cab 4WD Diesel", description: "Japanese-market Hilux Z with the 2.4 L 2GD diesel, rear diff lock and tow hitch. Bed liner fitted, clean underbody." },
    ar: { title: "تويوتا هايلكس Z دبل كابين دفع رباعي ديزل 2019", description: "هايلكس Z للسوق اليابانية بمحرك ديزل 2GD سعة 2.4 لتر، قفل ترس تفاضلي خلفي وخطاف سحب." },
  },
  {
    n: 7, ref: "MS24007", make: "honda", model: "Vezel", body: "suv", location: 2,
    regYear: 2019, regMonth: 9, grade: "Hybrid Z Honda Sensing", chassis: "RU3-1340015", modelCode: "DAA-RU3", engineCode: "LEB",
    conditionGrade: "4.5", mileage: 34600, cc: 1496, transmission: "AMT", fuel: "hybrid", drive: "2WD", steering: "RHD",
    color: "Crystal Blue", colorHex: "#264b8c", interior: "Black/brown", doors: 5, seats: 5, dims: [4340, 1790, 1605], m3: 12.46,
    weight: 1270, tyre: "225/50R18", price: 13900, status: "published", publishedDaysAgo: 15,
    costJpy: 1580000, costUsd: 10700,
    features: ["climate_control", "power_steering", "keyless_entry", "push_start", "cruise_control", "abs", "airbags", "back_camera", "lane_assist", "collision_mitigation", "led_headlights", "leather_seats", "navigation", "bluetooth"],
    photos: 4,
    en: { title: "2019 Honda Vezel Hybrid Z Honda Sensing", description: "Stylish compact SUV with Honda Sensing adaptive cruise, lane keeping and half-leather seats. Excellent fuel economy." },
    ja: { title: "2019年 ホンダ ヴェゼル ハイブリッドZ ホンダセンシング", description: "ホンダセンシング（ACC・車線維持支援）、ハーフレザーシート装備のスタイリッシュなコンパクトSUV。燃費良好。" },
  },
  {
    n: 8, ref: "MS24008", make: "toyota", model: "Prius", body: "hatchback", location: 1,
    regYear: 2018, regMonth: 5, grade: "S Safety Plus", chassis: "ZVW50-6120044", modelCode: "DAA-ZVW50", engineCode: "2ZR",
    conditionGrade: "4", mileage: 73900, cc: 1797, transmission: "CVT", fuel: "hybrid", drive: "2WD", steering: "RHD",
    color: "Emotional Red", colorHex: "#a3161f", interior: "Black", doors: 5, seats: 5, dims: [4540, 1760, 1470], m3: 11.74,
    weight: 1360, tyre: "195/65R15", price: 10800, status: "published", publishedDaysAgo: 40,
    costJpy: 1180000, costUsd: 8000,
    features: ["climate_control", "power_steering", "keyless_entry", "push_start", "cruise_control", "abs", "airbags", "back_camera", "lane_assist", "collision_mitigation", "led_headlights", "navigation"],
    photos: 4,
    en: { title: "2018 Toyota Prius S Safety Plus", description: "Fourth-generation Prius with Toyota Safety Sense, LED lights and adaptive cruise. Hybrid battery health checked." },
  },
  {
    n: 9, ref: "MS24009", make: "mazda", model: "CX-5", body: "suv", location: 3,
    regYear: 2018, regMonth: 7, grade: "XD L Package", chassis: "KF2P-201190", modelCode: "3DA-KF2P", engineCode: "SH",
    conditionGrade: "4", mileage: 58800, cc: 2188, transmission: "AT", fuel: "diesel", drive: "2WD", steering: "RHD",
    color: "Soul Red Crystal", colorHex: "#9b1b1f", interior: "White leather", doors: 5, seats: 5, dims: [4545, 1840, 1690], m3: 14.13,
    weight: 1620, tyre: "225/55R19", price: 16400, status: "published", publishedDaysAgo: 25,
    features: ["climate_control", "power_steering", "keyless_entry", "push_start", "cruise_control", "abs", "airbags", "back_camera", "collision_mitigation", "led_headlights", "leather_seats", "heated_seats", "navigation", "bluetooth"],
    photos: 4,
    en: { title: "2018 Mazda CX-5 XD L Package Diesel", description: "Torquey SkyActiv-D diesel with white leather interior, head-up display and Bose audio. Signature Soul Red Crystal paint." },
  },
  {
    n: 10, ref: "MS24010", make: "mitsubishi", model: "Delica D:5", body: "minivan", location: 2,
    regYear: 2019, regMonth: 10, grade: "P", chassis: "CV1W-2100772", modelCode: "3DA-CV1W", engineCode: "4N14",
    conditionGrade: "4.5", mileage: 44100, cc: 2267, transmission: "AT", fuel: "diesel", drive: "4WD", steering: "RHD",
    color: "Warm White Pearl", colorHex: "#ece8df", interior: "Black", doors: 5, seats: 8, dims: [4800, 1795, 1875], m3: 16.15,
    weight: 1960, tyre: "225/55R18", askPrice: true, price: 28900, status: "published", publishedDaysAgo: 12,
    features: ["climate_control", "power_steering", "keyless_entry", "push_start", "cruise_control", "abs", "airbags", "back_camera", "collision_mitigation", "led_headlights", "power_sliding_door", "third_row_seat", "navigation", "roof_rails"],
    photos: 4,
    en: { title: "2019 Mitsubishi Delica D:5 P Diesel 4WD 8-Seater", description: "The go-anywhere people mover: new-face Delica with the 2.3 L clean diesel, full-time 4WD and power sliding doors. Seats eight." },
    ja: { title: "2019年 三菱 デリカD:5 P ディーゼル 4WD 8人乗り", description: "新型フェイスのデリカD:5、2.3Lクリーンディーゼル、4WD、両側電動スライドドア。8人乗り。" },
  },
  {
    n: 11, ref: "MS24011", make: "isuzu", model: "Elf", body: "truck", location: 1,
    regYear: 2016, regMonth: 1, grade: "Flat Deck 2t", chassis: "NJR85-7050391", modelCode: "TRG-NJR85A", engineCode: "4JJ1",
    conditionGrade: "3.5", mileage: 142000, cc: 2990, transmission: "MT", fuel: "diesel", drive: "2WD", steering: "RHD",
    color: "White", colorHex: "#f4f5f6", doors: 2, seats: 3, dims: [4690, 1695, 1990], m3: 15.82,
    weight: 2310, grossWeight: 4475, maxLoad: 2000, tyre: "205/70R16", price: 15800, status: "published", publishedDaysAgo: 50,
    features: ["air_conditioning", "power_steering", "power_windows", "abs", "tail_lift"],
    photos: 4,
    en: { title: "2016 Isuzu Elf 2-Tonne Flat Deck with Tail Lift", description: "Reliable 4JJ1 diesel light truck with steel flat deck and hydraulic tail lift. Commercial service history available.", remarks: "Deck has usage scratches consistent with commercial work." },
  },
  {
    n: 12, ref: "MS24012", make: "honda", model: "Fit", body: "hatchback", location: 4,
    regYear: 2019, regMonth: 3, grade: "13G L Honda Sensing", chassis: "GK3-3420017", modelCode: "DBA-GK3", engineCode: "L13B",
    conditionGrade: "4", mileage: 39800, cc: 1317, transmission: "CVT", fuel: "petrol", drive: "2WD", steering: "RHD",
    color: "Lunar Silver", colorHex: "#c6c9cc", interior: "Black", doors: 5, seats: 5, dims: [3990, 1695, 1525], m3: 10.31,
    weight: 1020, tyre: "185/60R15", price: 7900, status: "published", publishedDaysAgo: 33,
    features: ["air_conditioning", "power_steering", "power_windows", "keyless_entry", "push_start", "abs", "airbags", "back_camera", "collision_mitigation", "navigation"],
    photos: 4,
    en: { title: "2019 Honda Fit 13G L Honda Sensing", description: "Economical city car with the famous Magic Seat system, Honda Sensing and reversing camera." },
    ar: { title: "هوندا فيت 13G L هوندا سينسنج 2019", description: "سيارة مدينة اقتصادية مع نظام المقاعد السحرية الشهير وهوندا سينسنج وكاميرا خلفية." },
  },
  {
    n: 13, ref: "MS24013", make: "nissan", model: "Caravan", body: "van", location: 2,
    regYear: 2018, regMonth: 6, grade: "Premium GX Long", chassis: "VW6E26-100411", modelCode: "CBF-VW6E26", engineCode: "QR25",
    conditionGrade: "3.5", mileage: 104500, cc: 2488, transmission: "AT", fuel: "petrol", drive: "2WD", steering: "RHD",
    color: "White", colorHex: "#f1f2f3", doors: 5, seats: 5, dims: [4695, 1695, 1990], m3: 15.84,
    weight: 1880, maxLoad: 1150, tyre: "195/80R15", price: 11200, status: "published", publishedDaysAgo: 60,
    features: ["air_conditioning", "power_steering", "power_windows", "keyless_entry", "abs", "airbags", "back_camera"],
    photos: 4,
    en: { title: "2018 Nissan NV350 Caravan Premium GX Long", description: "Premium GX trim with keyless entry and reversing camera. Spacious cargo area, great alternative to the Hiace." },
  },
  {
    n: 14, ref: "MS24014", make: "subaru", model: "Forester", body: "suv", location: 1,
    regYear: 2019, regMonth: 1, grade: "Advance e-Boxer", chassis: "SKE-012388", modelCode: "5AA-SKE", engineCode: "FB20",
    conditionGrade: "4.5", mileage: 29700, cc: 1995, transmission: "CVT", fuel: "hybrid", drive: "AWD", steering: "RHD",
    color: "Horizon Blue Pearl", colorHex: "#3d6f8f", interior: "Brown leather", doors: 5, seats: 5, dims: [4625, 1815, 1715], m3: 14.4,
    weight: 1640, tyre: "225/55R18", price: 19700, status: "published", publishedDaysAgo: 8, featured: true,
    features: ["climate_control", "power_steering", "keyless_entry", "push_start", "cruise_control", "abs", "airbags", "back_camera", "lane_assist", "collision_mitigation", "led_headlights", "leather_seats", "heated_seats", "sunroof", "roof_rails", "navigation"],
    photos: 4,
    en: { title: "2019 Subaru Forester Advance e-Boxer AWD", description: "Symmetrical AWD with the e-Boxer mild hybrid, EyeSight driver assist, driver monitoring and brown leather interior. Sunroof." },
    ja: { title: "2019年 スバル フォレスター アドバンス e-BOXER AWD", description: "シンメトリカルAWD、e-BOXER、アイサイト、ドライバーモニタリング、ブラウンレザー内装、サンルーフ付き。" },
  },
  {
    n: 15, ref: "MS24015", make: "toyota", model: "Corolla Fielder", body: "wagon", location: 3,
    regYear: 2017, regMonth: 12, grade: "Hybrid G W×B", chassis: "NKE165-7160012", modelCode: "DAA-NKE165G", engineCode: "1NZ",
    conditionGrade: "4", mileage: 81200, cc: 1496, transmission: "CVT", fuel: "hybrid", drive: "2WD", steering: "RHD",
    color: "Pearl White", colorHex: "#eceef0", interior: "Black", doors: 5, seats: 5, dims: [4410, 1695, 1510], m3: 11.29,
    weight: 1170, tyre: "185/55R16", price: 8600, status: "published", publishedDaysAgo: 45,
    features: ["air_conditioning", "power_steering", "power_windows", "keyless_entry", "push_start", "abs", "airbags", "back_camera", "collision_mitigation", "led_headlights"],
    photos: 4,
    en: { title: "2017 Toyota Corolla Fielder Hybrid G W×B", description: "Best-selling hybrid wagon in the sporty W×B trim. Practical, economical and easy to maintain." },
  },
  {
    n: 16, ref: "MS24016", make: "komatsu", model: "PC30", body: "machinery", location: 2,
    regYear: 2015, grade: "PC30MR-5 Mini Excavator", chassis: "PC30MR-25318", engineCode: "3D88E",
    hours: 3120, fuel: "diesel", color: "Komatsu Yellow", colorHex: "#e3b42a", seats: 1,
    dims: [4440, 1550, 2500], m3: 17.2, weight: 3160, tyre: "Rubber tracks 300 mm", askPrice: true,
    status: "published", publishedDaysAgo: 5,
    features: ["air_conditioning"],
    photos: 4,
    en: { title: "2015 Komatsu PC30MR-5 Mini Excavator — 3,120 h", description: "Compact 3-tonne excavator with rubber tracks, dozer blade and auxiliary hydraulic line. Hours verified on the meter. Shipped on flat rack or RoRo.", remarks: "Buckets not included — ask for attachment options." },
    ar: { title: "حفارة صغيرة كوماتسو PC30MR-5 موديل 2015 - 3,120 ساعة", description: "حفارة مدمجة وزن 3 أطنان بجنزير مطاطي وشفرة تسوية وخط هيدروليكي إضافي." },
  },
  {
    n: 17, ref: "MS24017", make: "lexus", model: "RX", body: "suv", location: 1,
    regYear: 2018, regMonth: 4, grade: "RX450h Version L", chassis: "GYL25-0015521", modelCode: "DAA-GYL25W", engineCode: "2GR",
    conditionGrade: "4.5", mileage: 41200, cc: 3456, transmission: "CVT", fuel: "hybrid", drive: "AWD", steering: "RHD",
    color: "Sonic Titanium", colorHex: "#8d9196", interior: "Rich Cream leather", doors: 5, seats: 5, dims: [4890, 1895, 1710], m3: 15.84,
    weight: 2100, tyre: "235/55R20", price: 33900, status: "published", publishedDaysAgo: 3,
    features: ["climate_control", "power_steering", "keyless_entry", "push_start", "cruise_control", "abs", "airbags", "back_camera", "parking_sensors", "lane_assist", "collision_mitigation", "led_headlights", "leather_seats", "heated_seats", "sunroof", "navigation", "bluetooth"],
    photos: 4,
    en: { title: "2018 Lexus RX450h Version L AWD", description: "Luxury hybrid SUV with Mark Levinson audio, panoramic view monitor and ventilated cream leather seats." },
  },
  {
    n: 18, ref: "MS24018", make: "nissan", model: "Note", body: "hatchback", location: 4,
    regYear: 2019, regMonth: 2, grade: "e-Power X", chassis: "HE12-2400126", modelCode: "DAA-HE12", engineCode: "HR12",
    conditionGrade: "4", mileage: 52300, cc: 1198, transmission: "AT", fuel: "hybrid", drive: "2WD", steering: "RHD",
    color: "Brilliant Silver", colorHex: "#c4c7cb", interior: "Black", doors: 5, seats: 5, dims: [4100, 1695, 1520], m3: 10.56,
    weight: 1220, tyre: "185/65R15", price: 7400, status: "published", publishedDaysAgo: 29,
    features: ["air_conditioning", "power_steering", "keyless_entry", "push_start", "abs", "airbags", "back_camera", "collision_mitigation"],
    photos: 4,
    en: { title: "2019 Nissan Note e-Power X", description: "Series-hybrid Note with one-pedal e-Power driving, intelligent emergency braking and keyless start." },
  },
  // --- Reserved / sold via seeded deals (status is set by reservation/sale triggers)
  {
    n: 19, ref: "MS24019", make: "toyota", model: "Harrier", body: "suv", location: 3,
    regYear: 2018, regMonth: 9, grade: "Premium Metal and Leather", chassis: "ZSU60-0150772", modelCode: "DBA-ZSU60W", engineCode: "3ZR",
    conditionGrade: "4.5", mileage: 45600, cc: 1986, transmission: "CVT", fuel: "petrol", drive: "2WD", steering: "RHD",
    color: "Black", colorHex: "#15171b", interior: "Black leather", doors: 5, seats: 5, dims: [4725, 1835, 1690], m3: 14.65,
    weight: 1580, tyre: "225/55R18", price: 18900, status: "published", publishedDaysAgo: 31,
    features: ["climate_control", "power_steering", "keyless_entry", "push_start", "cruise_control", "abs", "airbags", "back_camera", "collision_mitigation", "led_headlights", "leather_seats", "sunroof", "navigation"],
    photos: 4,
    en: { title: "2018 Toyota Harrier Premium Metal and Leather", description: "Elegant crossover with leather interior, JBL audio and panoramic moonroof." },
  },
  {
    n: 20, ref: "MS24020", make: "toyota", model: "Land Cruiser Prado", body: "suv", location: 1,
    regYear: 2020, regMonth: 2, grade: "TZ-G", chassis: "GDJ150-0045120", modelCode: "LDA-GDJ150W", engineCode: "1GD",
    conditionGrade: "5", mileage: 26400, cc: 2754, transmission: "AT", fuel: "diesel", drive: "4WD", steering: "RHD",
    color: "Black", colorHex: "#131519", interior: "Beige leather", doors: 5, seats: 7, view360: true, dims: [4825, 1885, 1835], m3: 16.73,
    weight: 2320, tyre: "265/55R19", price: 44800, status: "published", publishedDaysAgo: 34,
    costJpy: 5800000, costUsd: 39200,
    features: ["climate_control", "power_steering", "keyless_entry", "push_start", "cruise_control", "abs", "airbags", "back_camera", "parking_sensors", "lane_assist", "collision_mitigation", "led_headlights", "leather_seats", "heated_seats", "sunroof", "third_row_seat", "navigation", "diff_lock"],
    photos: 4, inspectionSheet: true,
    en: { title: "2020 Toyota Land Cruiser Prado TZ-G Diesel", description: "Flagship TZ-G diesel with KDSS, multi-terrain select, crawl control and beige leather. Grade 5 condition." },
    ar: { title: "تويوتا لاند كروزر برادو TZ-G ديزل 2020", description: "الفئة الأعلى TZ-G ديزل مع نظام KDSS واختيار التضاريس المتعددة والتحكم بالزحف ومقاعد جلدية بيج. حالة درجة 5." },
  },
  {
    n: 21, ref: "MS24021", make: "nissan", model: "X-Trail", body: "suv", location: 2,
    regYear: 2018, regMonth: 5, grade: "20Xi", chassis: "NT32-0850312", modelCode: "DBA-NT32", engineCode: "MR20",
    conditionGrade: "4", mileage: 55900, cc: 1997, transmission: "CVT", fuel: "petrol", drive: "4WD", steering: "RHD",
    color: "Brilliant White Pearl", colorHex: "#eff0f1", interior: "Black", doors: 5, seats: 5, dims: [4690, 1820, 1740], m3: 14.85,
    weight: 1560, tyre: "225/60R18", price: 13500, status: "published", publishedDaysAgo: 88,
    features: ["air_conditioning", "power_steering", "keyless_entry", "push_start", "cruise_control", "abs", "airbags", "back_camera", "lane_assist", "collision_mitigation", "roof_rails", "navigation"],
    photos: 4,
    en: { title: "2018 Nissan X-Trail 20Xi ProPilot 4WD", description: "ProPilot-equipped X-Trail with intelligent 4WD and around-view monitor." },
  },
  // --- Drafts and archive (CMS states)
  {
    n: 22, ref: "MS24022", make: "toyota", model: "Probox", body: "van", location: 1,
    regYear: 2020, grade: "GL", mileage: 60300, cc: 1496, transmission: "CVT", fuel: "petrol", drive: "2WD", steering: "RHD",
    color: "White", colorHex: "#f2f3f4", doors: 5, seats: 5,
    status: "draft",
    features: ["air_conditioning", "power_steering", "abs"],
    photos: 0,
    en: { title: "2020 Toyota Probox GL", description: "" },
  },
  {
    n: 23, ref: "MS24023", make: "mazda", model: "Demio", body: "hatchback", location: 3,
    regYear: 2018, regMonth: 10, grade: "XD Touring", chassis: "DJ5FS-502281", mileage: 48800, cc: 1498, transmission: "AT", fuel: "diesel",
    drive: "2WD", steering: "RHD", color: "Machine Grey", colorHex: "#5a5d61", doors: 5, seats: 5, price: 8200,
    status: "draft",
    features: ["air_conditioning", "power_steering", "keyless_entry", "push_start", "abs", "airbags", "back_camera"],
    photos: 4,
    en: { title: "2018 Mazda Demio XD Touring", description: "Diesel supermini with Touring trim. Photos uploaded, awaiting final price check." },
  },
  {
    n: 24, ref: "MS24024", make: "mitsubishi", model: "Pajero", body: "suv", location: 1,
    regYear: 2015, regMonth: 7, grade: "Exceed", chassis: "V98W-0801230", mileage: 118000, cc: 3200, transmission: "AT", fuel: "diesel",
    drive: "4WD", steering: "RHD", color: "Silver", colorHex: "#b3b7bc", doors: 5, seats: 7, price: 16900,
    status: "archived",
    features: ["air_conditioning", "power_steering", "abs", "airbags", "third_row_seat", "sunroof"],
    photos: 4,
    en: { title: "2015 Mitsubishi Pajero Exceed Diesel", description: "Listing withdrawn by supplier." },
  },
];

// -----------------------------------------------------------------------------
// Deals: inquiries, messages, offers, reservations, sales, payments, shipping
// -----------------------------------------------------------------------------
export type SeedMessage = { from: "customer" | string; daysAgo: number; body: string };

export type SeedInquiry = {
  n: number;
  customer: string;
  vehicle?: number;
  kind: "inquiry" | "offer";
  subject: string;
  status: "new" | "open" | "quoted" | "negotiating" | "reserved" | "won" | "lost" | "closed";
  destinationPort?: string;
  createdDaysAgo: number;
  messages: SeedMessage[];
  notes?: { by: string; daysAgo: number; body: string }[];
};

export const seedInquiries: SeedInquiry[] = [
  {
    n: 1, customer: ids.customer(1), vehicle: 2, kind: "inquiry", subject: "Hiace Van — CFR Lagos price?", status: "reserved",
    destinationPort: "Lagos (Tin Can Island)", createdDaysAgo: 9,
    messages: [
      { from: "customer", daysAgo: 9, body: "Hello, I am interested in this Hiace. Can you give me a CFR price to Lagos (Tin Can)? Is the engine 1GD diesel?" },
      { from: AIKO, daysAgo: 8.8, body: "Hi Amara, thank you for your inquiry. Yes, it is the 1GD 2.8 L diesel. I have sent a quotation for CFR Tin Can Island. RoRo departs from Nagoya roughly every 10 days." },
      { from: "customer", daysAgo: 7, body: "Thank you. The quotation works for me. Please reserve it while I arrange the deposit." },
      { from: AIKO, daysAgo: 6.9, body: "Reserved for you for 5 days. The proforma invoice will follow in your documents section." },
    ],
    notes: [{ by: AIKO, daysAgo: 7, body: "Repeat dealer — usually pays deposit within 48h. Offered free fuel-filter set." }],
  },
  {
    n: 2, customer: ids.customer(2), vehicle: 20, kind: "offer", subject: "Offer on Land Cruiser Prado TZ-G", status: "won",
    destinationPort: "Jebel Ali", createdDaysAgo: 27,
    messages: [
      { from: "customer", daysAgo: 27, body: "السلام عليكم، أرغب بشراء هذه السيارة. عرضي 42,000 دولار FOB." },
      { from: DANIEL, daysAgo: 26.5, body: "Wa alaikum assalam Omar, thank you for your offer. The best we can do is USD 43,900 FOB including export inspection. Quotation attached." },
      { from: "customer", daysAgo: 26, body: "OK, agreed. Please send the invoice." },
      { from: DANIEL, daysAgo: 20, body: "Payment received in full, thank you. Your vehicle is booked on the next RoRo to Jebel Ali." },
      { from: DANIEL, daysAgo: 6, body: "The vessel departed Yokohama. Bill of lading is now in your documents." },
    ],
  },
  {
    n: 3, customer: ids.customer(3), vehicle: 21, kind: "inquiry", subject: "X-Trail to Mombasa", status: "won",
    destinationPort: "Mombasa", createdDaysAgo: 85,
    messages: [
      { from: "customer", daysAgo: 85, body: "Hi, does this X-Trail meet KEBS age rules for Kenya? Please quote CIF Mombasa." },
      { from: AIKO, daysAgo: 84.5, body: "Hello Grace, yes — registered 05/2018 so it is within the 8-year rule. Quotation CIF Mombasa is attached, including JEVIC pre-shipment inspection." },
      { from: "customer", daysAgo: 84, body: "Accepted, thank you." },
      { from: AIKO, daysAgo: 30, body: "Your car has been released at Mombasa. Enjoy, and thank you for buying with MotorSpecs!" },
    ],
  },
  {
    n: 4, customer: ids.customer(4), vehicle: 4, kind: "offer", subject: "Jimny offer", status: "negotiating",
    destinationPort: "Auckland", createdDaysAgo: 5,
    messages: [
      { from: "customer", daysAgo: 5, body: "Would you take USD 16,000 FOB for the Jimny? I can pay quickly." },
      { from: DANIEL, daysAgo: 4, body: "Hi Liam, thanks for the offer. Jimnys are in high demand, but I can offer USD 17,300 FOB. This counter-offer is valid for 7 days." },
    ],
    notes: [{ by: DANIEL, daysAgo: 4, body: "Took over from Aiko. Liam previously asked about Hilux too — cross-sell if Jimny falls through." }],
  },
  {
    n: 5, customer: ids.customer(5), vehicle: 5, kind: "inquiry", subject: "アルファードの価格について", status: "open",
    createdDaysAgo: 3,
    messages: [
      { from: "customer", daysAgo: 3, body: "こんにちは。このアルファードの価格を教えてください。大阪で現車確認は可能ですか？" },
      { from: OWNER, daysAgo: 2.5, body: "中村様、お問い合わせありがとうございます。大阪ヤードで現車確認可能です。ご希望の日時をお知らせください。" },
    ],
  },
  {
    n: 6, customer: ids.customer(8), vehicle: 6, kind: "inquiry", subject: "Hilux shipping to Georgetown", status: "new",
    destinationPort: "Georgetown", createdDaysAgo: 0.4,
    messages: [
      { from: "customer", daysAgo: 0.4, body: "Good day. What is the total price of this Hilux shipped to Georgetown, Guyana? Do you offer container shipping?" },
    ],
  },
  {
    n: 7, customer: ids.customer(1), vehicle: 1, kind: "inquiry", subject: "Prado 7-seater availability", status: "open",
    destinationPort: "Lagos (Tin Can Island)", createdDaysAgo: 2,
    messages: [
      { from: "customer", daysAgo: 2, body: "Is the 2019 Prado still available? My client wants 7 seats." },
      { from: AIKO, daysAgo: 1.8, body: "Yes, still available and it has the third row. I will send a CFR quote tomorrow." },
    ],
  },
];

export type SeedOffer = {
  n: number;
  inquiry: number;
  by: "customer" | string;
  kind: "customer_offer" | "counter_offer" | "quotation";
  amount: number;
  incoterm?: "FOB" | "CFR" | "CIF";
  freight?: number;
  insurance?: number;
  inspection?: number;
  validDays?: number;
  status: "pending" | "accepted" | "declined" | "superseded";
  daysAgo: number;
  message?: string;
};

export const seedOffers: SeedOffer[] = [
  { n: 1, inquiry: 1, by: AIKO, kind: "quotation", amount: 24500, incoterm: "CFR", freight: 1650, validDays: 10, status: "accepted", daysAgo: 8.8, message: "RoRo Nagoya → Tin Can Island. Includes export documentation." },
  { n: 2, inquiry: 2, by: "customer", kind: "customer_offer", amount: 42000, status: "superseded", daysAgo: 27 },
  { n: 3, inquiry: 2, by: DANIEL, kind: "quotation", amount: 43900, incoterm: "FOB", inspection: 0, validDays: 7, status: "accepted", daysAgo: 26.5, message: "Includes export inspection." },
  { n: 4, inquiry: 3, by: AIKO, kind: "quotation", amount: 13500, incoterm: "CIF", freight: 1480, insurance: 95, inspection: 190, validDays: 14, status: "accepted", daysAgo: 84.5 },
  { n: 5, inquiry: 4, by: "customer", kind: "customer_offer", amount: 16000, status: "superseded", daysAgo: 5 },
  { n: 6, inquiry: 4, by: DANIEL, kind: "counter_offer", amount: 17300, incoterm: "FOB", validDays: 7, status: "pending", daysAgo: 4, message: "Counter-offer valid for 7 days." },
];

export const seedReservations = [
  // Active hold for Amara on the Hiace.
  { n: 1, vehicle: 2, customer: ids.customer(1), inquiry: 1, offer: 1, by: AIKO, price: 26150, daysAgo: 6.9, holdDays: 9, notes: "Deposit expected within 48 hours." },
  // Converted to sales below.
  { n: 2, vehicle: 20, customer: ids.customer(2), inquiry: 2, offer: 3, by: DANIEL, price: 43900, daysAgo: 26, holdDays: 5 },
  { n: 3, vehicle: 21, customer: ids.customer(3), inquiry: 3, offer: 4, by: AIKO, price: 15265, daysAgo: 84, holdDays: 5 },
];

export type SeedSale = {
  n: number;
  reservation: number;
  staff: string;
  incoterm: "FOB" | "CFR" | "CIF";
  price: number;
  freight?: number;
  insurance?: number;
  other?: number;
  invoiceNo: string;
  daysAgo: number;
  payments: { n: number; amount: number; daysAgo: number; ref: string; status: "recorded" | "verified"; by: string }[];
  shipment: {
    status: "awaiting_booking" | "booked" | "at_port" | "in_transit" | "arrived" | "released";
    method: "roro" | "container";
    vessel?: string;
    voyage?: string;
    pol?: string;
    pod?: string;
    etdDays?: number; // negative = past
    etaDays?: number;
    bl?: string;
    events: { status: string; daysAgo: number; note?: string; visible?: boolean }[];
  };
  completed?: boolean;
  documents: { n: number; kind: string; title: string; file: string; shared: boolean; daysAgo: number; by: string }[];
};

export const seedSales: SeedSale[] = [
  {
    n: 1, reservation: 2, staff: DANIEL, incoterm: "FOB", price: 43900, invoiceNo: "MS-INV-DEMO-0001", daysAgo: 25,
    payments: [
      { n: 1, amount: 10000, daysAgo: 24, ref: "DEMO-TT-55801", status: "verified", by: DANIEL },
      { n: 2, amount: 33900, daysAgo: 20, ref: "DEMO-TT-55922", status: "recorded", by: DANIEL },
    ],
    shipment: {
      status: "in_transit", method: "roro", vessel: "Demo Voyager (fictional)", voyage: "DV-118", pol: "Yokohama", pod: "Jebel Ali",
      etdDays: -6, etaDays: 14, bl: "DEMO-BL-770031",
      events: [
        { status: "booked", daysAgo: 18, note: "Space booked on Demo Voyager DV-118." },
        { status: "at_port", daysAgo: 10, note: "Vehicle delivered to Yokohama port yard." },
        { status: "in_transit", daysAgo: 6, note: "Vessel departed Yokohama." },
      ],
    },
    documents: [
      { n: 1, kind: "proforma_invoice", title: "Proforma invoice", file: "proforma-invoice.pdf", shared: true, daysAgo: 25.5, by: DANIEL },
      { n: 2, kind: "invoice", title: "Commercial invoice", file: "commercial-invoice.pdf", shared: true, daysAgo: 20, by: DANIEL },
      { n: 3, kind: "export_certificate", title: "Export certificate (draft)", file: "export-certificate.pdf", shared: false, daysAgo: 12, by: DANIEL },
      { n: 4, kind: "bill_of_lading", title: "Bill of lading", file: "bill-of-lading.pdf", shared: true, daysAgo: 6, by: DANIEL },
    ],
  },
  {
    n: 2, reservation: 3, staff: AIKO, incoterm: "CIF", price: 13500, freight: 1480, insurance: 95, other: 190, invoiceNo: "MS-INV-DEMO-0002", daysAgo: 83,
    payments: [{ n: 3, amount: 15265, daysAgo: 80, ref: "DEMO-TT-51230", status: "verified", by: AIKO }],
    shipment: {
      status: "released", method: "roro", vessel: "Demo Horizon (fictional)", voyage: "DH-042", pol: "Nagoya", pod: "Mombasa",
      etdDays: -70, etaDays: -35, bl: "DEMO-BL-640118",
      events: [
        { status: "booked", daysAgo: 78 },
        { status: "at_port", daysAgo: 73 },
        { status: "in_transit", daysAgo: 70, note: "Departed Nagoya." },
        { status: "arrived", daysAgo: 35, note: "Arrived Mombasa." },
        { status: "released", daysAgo: 30, note: "Released to customer's clearing agent." },
      ],
    },
    completed: true,
    documents: [
      { n: 5, kind: "invoice", title: "Commercial invoice", file: "commercial-invoice.pdf", shared: true, daysAgo: 83, by: AIKO },
      { n: 6, kind: "receipt", title: "Payment receipt", file: "receipt.pdf", shared: true, daysAgo: 79, by: AIKO },
      { n: 7, kind: "inspection", title: "Pre-shipment inspection certificate", file: "inspection-certificate.pdf", shared: true, daysAgo: 74, by: AIKO },
      { n: 8, kind: "bill_of_lading", title: "Bill of lading", file: "bill-of-lading.pdf", shared: true, daysAgo: 70, by: AIKO },
    ],
  },
];

/** Documents not attached to a sale. */
export const seedLooseDocuments = [
  { n: 9, customer: ids.customer(1), inquiry: 1, kind: "proforma_invoice", title: "Proforma invoice — Hiace (reservation)", file: "proforma-invoice.pdf", shared: true, daysAgo: 6.8, by: AIKO },
  { n: 10, customer: ids.customer(6), kind: "other", title: "Business registration copy (received at trade fair)", file: "business-registration.pdf", shared: false, daysAgo: 11, by: AIKO },
];

export const seedTasks = [
  { n: 1, title: "Chase Hiace deposit", customer: ids.customer(1), inquiry: 1, to: AIKO, dueDays: 1, priority: "high" as const },
  { n: 2, title: "Follow up on Jimny counter-offer", customer: ids.customer(4), inquiry: 4, to: DANIEL, dueDays: 2, priority: "normal" as const },
  { n: 3, title: "Send Prado CFR quote", customer: ids.customer(1), inquiry: 7, to: AIKO, dueDays: 0.3, priority: "high" as const },
  { n: 4, title: "Arrange Alphard viewing in Osaka", customer: ids.customer(5), inquiry: 5, to: OWNER, dueDays: 3, priority: "normal" as const },
  { n: 5, title: "Call Mohamed about Hiace stock", customer: ids.customer(6), to: AIKO, dueDays: -1, priority: "normal" as const },
  { n: 6, title: "Confirm Omar's balance payment with bank", customer: ids.customer(2), to: OWNER, dueDays: 1, priority: "high" as const },
];

export const seedCustomerNotes = [
  { customer: ids.customer(6), by: AIKO, daysAgo: 12, body: "Met at the (fictional) Demo Auto Expo. Interested in 5–10 Hiace vans per quarter. Has not registered on the website yet — issue a link code when ready." },
  { customer: ids.customer(7), by: OWNER, daysAgo: 2, body: "Phone lead. Wants RHD pickups for Jamaica. Needs assigning to a salesperson." },
];
