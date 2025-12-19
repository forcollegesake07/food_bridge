import { createDonation } from "../services/donation.service.js";
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

  // 👉 Donation form
  const form = document.querySelector("form");
  if (form) {
    form.addEventListener("submit", handleDonate);
  }

  // Initial tab
  switchTab("overview");
}
async function handleDonate(event) {
  event.preventDefault();

  try {
    const foodName = document.getElementById("food-name")?.value;
    const qty = document.getElementById("food-qty")?.value;

    if (!foodName || !qty) {
      alert("Please enter food name and quantity");
      return;
    }

    await createDonation(foodName, Number(qty));

    alert("✅ Donation posted successfully");

    // reset form
    document.getElementById("food-name").value = "";
    document.getElementById("food-qty").value = "";

  } catch (err) {
    console.error("Donation failed", err);
    alert(err.message || "Donation failed");
  }
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
