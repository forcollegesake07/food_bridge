import { state } from "./state.js";

export function initAuthGuard(auth, db, role) {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "/login";
      return;
    }

    // Save auth user
    state.authUser = user;

    const snap = await db.collection("users").doc(user.uid).get();

    if (!snap.exists) {
      await auth.signOut();
      window.location.href = "/login";
      return;
    }

    const data = snap.data();

    // Disabled account
    if (data.isDisable === true) {
      await auth.signOut();
      alert("Account disabled");
      window.location.href = "/login";
      return;
    }

    // Role protection
    if (role && data.role !== role) {
      redirectByRole(data.role);
      return;
    }

    // ✅ SAFE STATE ASSIGNMENT
    state.profile = data;
    state.location = data.location || null;

    // 🔔 Notify app that auth + profile are ready
    document.dispatchEvent(new Event("APP_READY"));
  });
}

function redirectByRole(role) {
  if (role === "restaurant") window.location.href = "/restaurant";
  else if (role === "orphanage") window.location.href = "/orphanages";
  else if (role === "admin") window.location.href = "/admin";
  else window.location.href = "/login";
}
