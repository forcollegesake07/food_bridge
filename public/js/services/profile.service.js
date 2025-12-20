import { db } from "../firebase.js";
import { state } from "../state.js";

/**
 * Save restaurant profile to Firestore
 */
export async function saveProfile(profileData) {
  if (!state.authUser) {
    throw new Error("User not authenticated");
  }

  const uid = state.authUser.uid;

  await db.collection("users").doc(uid).update({
    name: profileData.name,
    phone: profileData.phone,
    address: profileData.address,
    location: profileData.location
  });

  // 🔥 Keep local state in sync
  state.profile.name = profileData.name;
  state.profile.phone = profileData.phone;
  state.profile.address = profileData.address;
  state.profile.location = profileData.location;
}
