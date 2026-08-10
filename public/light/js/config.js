/* NACK Pro Light — config Firebase (même projet que l'app React) */
window.NACK_LIGHT = window.NACK_LIGHT || {};
window.NACK_LIGHT.FIREBASE = {
  apiKey: "AIzaSyCHbORTw-dgJW4OWIRazYrhAemERLV68sM",
  authDomain: "nack-8c299.firebaseapp.com",
  projectId: "nack-8c299",
  storageBucket: "nack-8c299.firebasestorage.app",
  messagingSenderId: "94970966128",
  appId: "1:94970966128:web:e3af16bcd2a262e66cc4b5"
};
window.NACK_LIGHT.AUTH_WINDOW_MS = 10 * 60 * 1000;
window.NACK_LIGHT.STORAGE_KEYS = {
  idToken: "nack_light_idToken",
  refreshToken: "nack_light_refreshToken",
  uid: "nack_light_uid",
  email: "nack_light_email",
  managerAuthUntil: "nack_manager_auth_until",
  forceLight: "nack_force_light",
  affiliateSession: "nack_affiliate_session"
};
window.NACK_LIGHT.PLANS = {
  transition: { name: "Standard", price: 3000 },
  "transition-pro-max": { name: "Premium", price: 7500 }
};
window.NACK_LIGHT.CLOUDINARY = {
  /* Renseigner comme VITE_CLOUDINARY_* dans env.example */
  cloudName: "",
  uploadPreset: ""
};
window.NACK_LIGHT.DURATIONS = [
  { value: "month", label: "1 mois" },
  { value: "quarter", label: "3 mois" },
  { value: "semester", label: "6 mois (-10%)" },
  { value: "year", label: "12 mois (2 mois offerts)" }
];
/* Alias rétrocompat si une ancienne clé forçait le mode */
try {
  if (localStorage.getItem("nack_force_legacy") === "1") {
    localStorage.setItem("nack_force_light", "1");
  }
} catch (e) {}
