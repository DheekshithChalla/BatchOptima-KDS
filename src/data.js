// Zones in Bengaluru (Customized for Speedcode 2026 @ NMIT Bengaluru)
const ZONES = [
  {
    id: "BLR-NORTH",
    name: "North Bangalore",
    hub: "Yelahanka / Hebbal / NMIT Campus Hub",
    color: "#10b981", // Emerald
    bgColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.4)",
    coords: { x: 50, y: 22 },
    distanceKm: 3.2,
    avgRiderWaitMin: 4.5
  },
  {
    id: "BLR-CENTRAL",
    name: "Central Core",
    hub: "Indiranagar / MG Road / Koramangala",
    color: "#6366f1", // Indigo
    bgColor: "rgba(99, 102, 241, 0.12)",
    borderColor: "rgba(99, 102, 241, 0.4)",
    coords: { x: 54, y: 52 },
    distanceKm: 6.8,
    avgRiderWaitMin: 5.8
  },
  {
    id: "BLR-TECH",
    name: "Tech Corridor",
    hub: "Whitefield / Marathahalli / Bellandur",
    color: "#06b6d4", // Cyan
    bgColor: "rgba(6, 182, 212, 0.12)",
    borderColor: "rgba(6, 182, 212, 0.4)",
    coords: { x: 82, y: 48 },
    distanceKm: 9.4,
    avgRiderWaitMin: 7.2
  },
  {
    id: "BLR-SOUTH",
    name: "South Bangalore",
    hub: "Jayanagar / JP Nagar / BTM Layout",
    color: "#f59e0b", // Amber
    bgColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.4)",
    coords: { x: 42, y: 78 },
    distanceKm: 8.1,
    avgRiderWaitMin: 6.1
  },
  {
    id: "BLR-WEST",
    name: "West Hub",
    hub: "Malleshwaram / Rajajinagar / Yeshwanthpur",
    color: "#ec4899", // Pink
    bgColor: "rgba(236, 72, 153, 0.12)",
    borderColor: "rgba(236, 72, 153, 0.4)",
    coords: { x: 25, y: 42 },
    distanceKm: 5.5,
    avgRiderWaitMin: 5.0
  }
];

// Realistic Food Items with Kitchen Station & Weights
const MENU_ITEMS = [
  { id: "HYD-BRY", name: "Hyderabadi Dum Biryani", weightKg: 0.85, station: "Tandoor/Rice", price: 340, emoji: "🍗" },
  { id: "PNNR-TIK", name: "Paneer Butter Masala + Naan", weightKg: 0.70, station: "Curry/Oven", price: 290, emoji: "🥘" },
  { id: "MSL-DOSA", name: "Mysore Masala Dosa Platter", weightKg: 0.45, station: "Griddle/Tawa", price: 160, emoji: "🥞" },
  { id: "CHK-WINGS", name: "Smoky BBQ Wings (6pcs)", weightKg: 0.50, station: "Deep Fryer", price: 240, emoji: "🍗" },
  { id: "TRF-PIZZA", name: "Truffle Mushroom Artisan Pizza", weightKg: 0.95, station: "Pizza Oven", price: 420, emoji: "🍕" },
  { id: "BLR-BURGER", name: "Double Smash Cheesy Burger", weightKg: 0.60, station: "Grill Station", price: 280, emoji: "🍔" },
  { id: "WOK-NOOD", name: "Hakka Wok Noodles + Dimsums", weightKg: 0.75, station: "Wok Master", price: 260, emoji: "🍜" },
  { id: "GUL-JAM", name: "Hot Gulab Jamun Sundae (2x)", weightKg: 0.30, station: "Dessert/Assembly", price: 140, emoji: "🍨" },
  { id: "MANGO-LSS", name: "Alphonso Mango Kulfi Shake", weightKg: 0.50, station: "Beverage Bar", price: 180, emoji: "🥤" },
  { id: "MED-SALAD", name: "Greek Protein Harvest Bowl", weightKg: 0.40, station: "Cold Pantry", price: 220, emoji: "🥗" }
];

const CUSTOMER_NAMES = [
  "Aarav Sharma", "Ananya Hegde", "Rohan Iyer", "Sneha Rao", "Vikram Patel",
  "Pooja Nambiar", "Rahul Reddy", "Tanvi Kulkarni", "Aditya Swaminathan", "Divya Menon",
  "NMIT Faculty Lounge", "Hostel Block-4", "Tech Park Tower B", "Prestige Tech Cloud", "Koramangala 5th Block"
];

// Kitchen Cooking Stations
const KITCHEN_STATIONS = [
  { id: "Tandoor/Rice", name: "Tandoor & Biryani Pit", capacity: 6, icon: "🔥" },
  { id: "Curry/Oven", name: "Curry & Oven Range", capacity: 5, icon: "🍲" },
  { id: "Pizza Oven", name: "Stone Hearth Pizza Oven", capacity: 4, icon: "🍕" },
  { id: "Grill/Tawa", name: "Live Grill & Dosa Tawa", capacity: 5, icon: "🥩" },
  { id: "Wok/Fryer", name: "High-Heat Wok & Fryers", capacity: 6, icon: "🥢" },
  { id: "Assembly/QC", name: "Packaging & Quality Seal", capacity: 8, icon: "📦" }
];

// System Configurations
const DEFAULT_CONFIG = {
  WINDOW_DURATION_SEC: 300, // 5 minutes window
  MAX_ITEMS_PER_BATCH: 5,   // Capacity constraint specified in problem statement
  MAX_WEIGHT_PER_BATCH_KG: 4.5, // Max weight constraint (kg)
  COOK_DURATION_SEC: 12,    // Accelerated cook time for crisp demoing
  SIMULATION_INTERVAL_MS: 3500, // Speed of incoming orders in sim mode
  DISPATCH_AUTO_CYCLE: true
};

window.APP_DATA = {
  ZONES,
  MENU_ITEMS,
  CUSTOMER_NAMES,
  KITCHEN_STATIONS,
  DEFAULT_CONFIG
};