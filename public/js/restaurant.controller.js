import { state } from "./state.js";

/**
 * Entry point for restaurant dashboard
 * This runs AFTER auth + profile are ready
 */
export function initRestaurant() {
  console.log("🍽️ Restaurant controller started");

  // Access global state safely
  console.log("User:", state.authUser);
  console.log("Profile:", state.profile);
  console.log("Location:", state.location);

  bindUI();
}

/* =========================
   UI BINDINGS
========================= */
function bindUI() {
  // Sidebar tabs
  window.switchTab = switchTab;
  window.logout = logout;

  // Initial tab
  switchTab("overview");
}

/* =========================
   BASIC FUNCTIONS (TEMP)
========================= */
function switchTab(tab) {
  console.log("Switch tab:", tab);

  ["overview", "history", "details", "alerts"].forEach(t => {
    const el = document.getElementById("tab-" + t);
    if (el) el.classList.add("hidden");
  });

  const active = document.getElementById("tab-" + tab);
  if (active) active.classList.remove("hidden");
}

function logout() {
  console.log("Logging out...");
  state.authUser?.auth?.signOut?.();
  window.location.href = "/login";
}
