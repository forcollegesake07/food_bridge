import { db } from "../firebase.js";
import { state } from "../state.js";

/**
 * Create a new food donation
 */
export async function createDonation(foodName, quantity, imageBase64 = null) {
  if (!state.authUser) {
    throw new Error("User not authenticated");
  }

  if (!state.profile) {
    throw new Error("User profile not loaded");
  }

  const donationData = {
    restaurantId: state.authUser.uid,
    restaurantName: state.profile.name,
    restaurantEmail: state.authUser.email,
    restaurantPhone: state.profile.phone || "",
    restaurantAddress: state.profile.address || "",
    foodName: foodName,
    servings: Number(quantity),
    imageUrl: imageBase64,
    status: "Available",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    location: state.location || null
  };

  await db.collection("donations").add(donationData);
}
