import { db } from "../firebase.js";
import { state } from "../state.js";
import { serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

/**
 * Create a new food donation
 */
export async function createDonation({ foodName, quantity }) {
  if (!state.authUser || !state.profile) {
    throw new Error("User not ready");
  }

  const donation = {
    restaurantId: state.authUser.uid,
    restaurantName: state.profile.name || "Unnamed Restaurant",
    restaurantEmail: state.profile.email || "",
    restaurantPhone: state.profile.phone || "",
    restaurantAddress: state.profile.address || "",

    foodName,
    servings: Number(quantity),

    status: "Available",
    createdAt: serverTimestamp(),
    location: state.profile.location || null,
  };

  await db.collection("donations").add(donation);

  return donation;
}
