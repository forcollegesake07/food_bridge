import { state } from "./state.js";

export function initAuthGuard(auth, db, role) {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "/login";
      return;
    }

    state.authUser = user;

    const snap = await db.collection("users").doc(user.uid).get();

    if (!snap.exists) {
      await auth.signOut();
      window.location.href = "/login";
      return;
    }

    const data = snap.data();

    if (data.isDisable) {
      await auth.signOut();
      alert("Account disabled");
      window.location.href = "/login";
      return;
    }

    if (data.role !== role) {
      redirectByRole(data.role);
      return;
    }

    state.profile = data;

    // Store location safely
    if (data.location) {
      state.location.lat = data.location.lat;
      state.location.lng = data.location.lng;
    }

    document.dispatchEvent(new Event("APP_READY"));
  });
}

function redirectByRole(role) {
  if (role === "restaurant") window.location.href = "/restaurant";
  if (role === "orphanage") window.location.href = "/orphanages";
  if (role === "admin") window.location.href = "/admin";
}
