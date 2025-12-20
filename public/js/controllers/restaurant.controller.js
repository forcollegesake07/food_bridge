import {
  createDonation,
  listenToMyDonations
} from "../services/donation.service.js";
import { state } from "../state.js";
import { saveProfile } from "../services/profile.service.js";
import { db } from "../firebase.js";

let map = null;
let marker = null;
/**
 * Entry point for restaurant dashboard
 * Runs AFTER auth + profile are ready
 */
export function initRestaurant() {
  console.log("🍽️ Restaurant controller started");
  
  console.log("User:", state.authUser);
  console.log("Profile:", state.profile);
  console.log("Location:", state.location);

  hydrateProfileUI();
  bindUI();
  bindProfileForm();
  listenToMyDonations(donations => {
    renderDonations(donations); // ✅ FIXED
    renderHistory(donations);
  });
  listenToUrgentRequests();
}
function hydrateProfileUI() {
  // Sidebar
  const nameEl = document.getElementById("sidebar-name");
  const idEl = document.getElementById("sidebar-id");

  if (nameEl) nameEl.textContent = state.profile.name || "Restaurant";
  if (idEl) idEl.textContent = "ID: " + state.authUser.uid.slice(0, 6);

  // Details tab inputs
  const nameInput = document.getElementById("detail-name");
  const phoneInput = document.getElementById("detail-phone");
  const addressInput = document.getElementById("detail-address");

  if (nameInput) nameInput.value = state.profile.name || "";
  if (phoneInput) phoneInput.value = state.profile.phone || "";
  if (addressInput) addressInput.value = state.profile.address || "";
}
function renderHistory(donations) {
  const body = document.getElementById("history-table-body");
  const countEl = document.getElementById("history-count");

  if (!body) return;

  body.innerHTML = "";
  countEl.textContent = donations.length;

  if (donations.length === 0) {
    body.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-6 text-gray-400">
          No donation history yet
        </td>
      </tr>
    `;
    return;
  }

  donations.forEach(d => {
    const date = d.createdAt?.toDate
      ? d.createdAt.toDate().toLocaleDateString()
      : "—";

    body.innerHTML += `
      <tr class="border-b text-sm">
        <td class="px-4 py-3">${date}</td>
        <td class="px-4 py-3 font-semibold">${d.foodName}</td>
        <td class="px-4 py-3">${d.servings}</td>
        <td class="px-4 py-3">${d.status}</td>
        <td class="px-4 py-3">${d.orphanageName || "-"}</td>
        <td class="px-4 py-3">${d.orphanagePhone || "-"}</td>
        <td class="px-4 py-3 text-center">—</td>
      </tr>
    `;
  });
}

function bindProfileForm() {
  const form = document.getElementById("profile-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("detail-name")?.value.trim();
    const phone = document.getElementById("detail-phone")?.value.trim();
    const address = document.getElementById("detail-address")?.value.trim();

    if (!name || !phone || !address) {
      alert("Please fill all profile fields");
      return;
    }

    try {
      await saveProfile({
        name,
        phone,
        address,
        location: state.location || null
      });

      // Update sidebar instantly
      const sidebarName = document.getElementById("sidebar-name");
      if (sidebarName) sidebarName.textContent = name;

      alert("✅ Profile updated successfully");
    } catch (err) {
      console.error(err);
      alert("❌ Failed to save profile");
    }
  });
}
function initMap() {
  const mapContainer = document.getElementById("map-container");
  if (!mapContainer) return;

  // Prevent double init
  if (map) {
    map.invalidateSize();
    return;
  }

  // Use saved location OR fallback
  const lat = state.location.lat ?? 20.5937; // India center
  const lng = state.location.lng ?? 78.9629;
  const zoom = state.location.lat ? 14 : 5;

  map = L.map("map-container").setView([lat, lng], zoom);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  marker = L.marker([lat, lng], { draggable: true }).addTo(map);

  // 🟢 DRAG → UPDATE STATE
  marker.on("dragend", () => {
    const pos = marker.getLatLng();
    state.location.lat = pos.lat;
    state.location.lng = pos.lng;

    fetchAddressFromLatLng(pos.lat, pos.lng);
  });

  // 🔵 AUTO-DETECT (FIRST TIME ONLY)
  if (!state.location.lat) {
    map.locate({ setView: true, maxZoom: 16 });

    map.on("locationfound", e => {
      state.location.lat = e.latlng.lat;
      state.location.lng = e.latlng.lng;

      marker.setLatLng(e.latlng);
      fetchAddressFromLatLng(e.latlng.lat, e.latlng.lng);
    });
  }
}
async function fetchAddressFromLatLng(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
    );
    const data = await res.json();

    if (data?.display_name) {
      const addressInput = document.getElementById("detail-address");
      if (addressInput) addressInput.value = data.display_name;
    }
  } catch (err) {
    console.error("Reverse geocode failed", err);
  }
}
async function handleSaveProfile(e) {
  e.preventDefault();

  const name = document.getElementById("detail-name")?.value.trim();
  const phone = document.getElementById("detail-phone")?.value.trim();
  const address = document.getElementById("detail-address")?.value.trim();

  if (!name || !phone || !address) {
    alert("Please fill all profile fields");
    return;
  }

  if (!state.location.lat || !state.location.lng) {
    alert("Please pin your location on the map");
    return;
  }

  try {
    await db.collection("users").doc(state.authUser.uid).update({
      name,
      phone,
      address,
      location: {
        lat: state.location.lat,
        lng: state.location.lng
      }
    });

    // 🔁 Update local state
    state.profile.name = name;
    state.profile.phone = phone;
    state.profile.address = address;

    console.log("✅ Profile + location saved");
    alert("Profile updated successfully");
  } catch (err) {
    console.error("❌ Profile save failed", err);
    alert("Failed to save profile");
  }
}

/* =========================
   UI BINDINGS
========================= */
function bindUI() {
  window.switchTab = switchTab;
  window.logout = logout;

  const donateForm = document.getElementById("donation-form");
  if (donateForm) {
    donateForm.addEventListener("submit", handleDonateSubmit);
  }

  const profileForm = document.querySelector("#tab-details form");
  if (profileForm) {
    profileForm.addEventListener("submit", handleSaveProfile);
  }

  switchTab("overview");
}

/* =========================
   DONATION HANDLER
========================= */
async function handleDonateSubmit(e) {
  e.preventDefault();

  const foodName = document.getElementById("food-name")?.value.trim();
  const quantity = document.getElementById("food-qty")?.value.trim();

  if (!foodName || !quantity) {
    alert("Please fill all fields");
    return;
  }

  try {
    await createDonation({ foodName, quantity });
    e.target.reset();
    console.log("✅ Donation created");
  } catch (err) {
    console.error("❌ Donation failed", err);
    alert(err.message || "Failed to create donation");
  }
}
function getDistanceKm(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2) return Infinity;

  const R = 6371; // Earth radius in KM
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/* =========================
   RENDER DONATIONS (OVERVIEW)
========================= */
function renderDonations(donations) {
  const container = document.getElementById("scheduled-pickups-container");
  if (!container) return;

  container.innerHTML = "";

  if (donations.length === 0) {
    container.innerHTML = `
      <div class="bg-orange-50 border border-orange-100 rounded-xl p-4 text-center text-orange-600 text-sm font-medium">
        No active listings. Post a donation!
      </div>
    `;
    return;
  }

  donations.forEach(d => {
    const statusColor =
      d.status === "Available"
        ? "border-brand-orange"
        : "border-green-500";

    const title =
      d.status === "Available"
        ? "Available Listing"
        : "Pickup Scheduled";

    container.innerHTML += `
      <div class="bg-white rounded-2xl p-6 shadow-xl border-l-4 ${statusColor}">
        <h3 class="text-lg font-bold text-gray-800 mb-2">${title}</h3>
        <p class="font-medium">${d.foodName}</p>
        <p class="text-sm text-gray-500">${d.servings} servings</p>
        <p class="text-xs mt-2 text-gray-400">Status: ${d.status}</p>
      </div>
    `;
  });
}
function listenToUrgentRequests() {
  const container = document.getElementById("requests-container");
  if (!container) return;

  container.innerHTML = `
    <p class="col-span-full text-center text-white py-6">
      Loading urgent requests...
    </p>
  `;

  db.collection("requests")
    .where("status", "==", "Pending")
    .orderBy("createdAt", "desc")
    .onSnapshot(snapshot => {
      container.innerHTML = "";

      const myLat = state.location.lat;
      const myLng = state.location.lng;

      if (!myLat || !myLng) {
        container.innerHTML = `
          <div class="col-span-full bg-red-50 border border-red-100 rounded-xl p-6 text-center text-red-600">
            📍 Please set your location in the Details tab to view urgent requests.
          </div>
        `;
        return;
      }

      let found = false;

      snapshot.forEach(doc => {
        const r = doc.data();
        const rLat = r.location?.lat;
        const rLng = r.location?.lng;

        const distance = getDistanceKm(myLat, myLng, rLat, rLng);

        if (distance <= 15) {
          found = true;

          container.innerHTML += `
            <div class="bg-white rounded-2xl p-6 shadow-xl border-l-4 border-red-500">
              <div class="flex justify-between items-start mb-2">
                <h3 class="font-bold text-lg text-gray-800">
                  ${r.itemNeeded}
                </h3>
                <span class="text-xs font-bold text-red-500">
                  ${distance.toFixed(1)} km
                </span>
              </div>

              <p class="text-sm text-gray-600 mb-2">
                Quantity: <strong>${r.quantity}</strong>
              </p>

              <p class="text-sm text-gray-500 mb-3">
                🏠 ${r.orphanageName}
              </p>

              <button
                class="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition"
                onclick="alert('Fulfillment comes in Step 13')"
              >
                Donate Now
              </button>
            </div>
          `;
        }
      });

      if (!found) {
        container.innerHTML = `
          <div class="col-span-full text-center text-white py-8">
            ✅ No urgent requests within 15 km
          </div>
        `;
      }
    });
}


/* =========================
   BASIC NAV
========================= */
function switchTab(tab) {
  ["overview", "history", "details", "alerts"].forEach(t => {
    document.getElementById("tab-" + t)?.classList.add("hidden");
  });

  document.getElementById("tab-" + tab)?.classList.remove("hidden");

    if (tab === "details") {
    setTimeout(initMap, 200);
    }
}

function logout() {
  state.authUser?.auth?.signOut?.();
  window.location.href = "/login";
}
