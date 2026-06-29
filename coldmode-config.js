// ─────────────────────────────────────────────────────────────
//  COLDMODE — config Firebase
//  Pași:
//   1. https://console.firebase.google.com → Add project (ex: "coldmode")
//   2. Build → Firestore Database → Create database (start in production mode)
//   3. Project settings (⚙) → General → "Your apps" → </> (Web) → Register app
//      → copiază obiectul firebaseConfig și pune-l mai jos.
//   4. Firestore → Rules → lipește regulile din coldmode/firestore.rules
//  Cât timp firebaseConfig e gol, site-ul afișează produsele placeholder.
// ─────────────────────────────────────────────────────────────
window.COLDMODE = {
  firebaseConfig: {
    apiKey: "AIzaSyBw8H68_8M6JRDrYQ_mrQ-CFX1rNNPxel8",
    authDomain: "coldmode-b6070.firebaseapp.com",
    projectId: "coldmode-b6070",
    storageBucket: "coldmode-b6070.firebasestorage.app",
    messagingSenderId: "421001629765",
    appId: "1:421001629765:web:5512a5c954c47ef22b132c",
    measurementId: "G-P0L1H7C5S3"
  },
  COLLECTION: "products",

  // Backend pentru admin (link scraper + translator selleri). Endpoint-ul
  // /api/coldmode e deployat pe jarvis-finder.com (Vercel). Adminul rulează
  // local din file://, deci cheamă acest host cross-origin (CORS deschis).
  API_BASE: "https://jarvis-finder.com",

  // ── Discord login (OAuth2 implicit, fără backend) ──
  //  1. https://discord.com/developers/applications → New Application (botul tău nou)
  //  2. OAuth2 → General → copiază "Client ID" și pune-l mai jos
  //  3. OAuth2 → Redirects → adaugă EXACT URL-urile de unde se deschide site-ul:
  //       • local (preview):  http://localhost:5599/stores-local.html
  //       • producție:        https://coldmode.xxx/   (după deploy)
  //     (Discord NU acceptă file:// — site-ul trebuie servit pe http/https.)
  DISCORD_CLIENT_ID: ""   // ex: "1234567890123456789"
};
