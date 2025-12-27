const express = require("express");
const cors = require("cors");
const Brevo = require("@getbrevo/brevo");
const admin = require("firebase-admin"); 
const path = require("path");
const fs = require("fs"); // Used to check file existence

const app = express();
const PORT = process.env.PORT || 10000;

/* ============================
   FIREBASE SETUP (ROBUST)
   Prevents server crash if key is missing
============================ */
let db; // Define db globally so we can check if it exists later

try {
  // Check if the key file exists before trying to load it
  if (fs.existsSync("./service-account.json")) {
    const serviceAccount = require("./service-account.json");
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    
    db = admin.firestore(); // Initialize DB only if connection succeeds
    console.log("✅ Firebase Admin Initialized Successfully");
  } else {
    throw new Error("service-account.json file not found.");
  }
} catch (error) {
  console.error("❌ CRITICAL ERROR: Firebase Failed to Initialize.");
  console.error("Reason:", error.message);
  console.error("👉 ACTION REQUIRED: Add 'service-account.json' to Render 'Secret Files'.");
  // We do NOT stop the server here. We let it run without Notifications.
}

/* ============================
   MIDDLEWARE
============================ */
app.use(cors({ origin: "*" }));
app.use(express.json());

app.use(
  express.static(path.join(__dirname, "public"), {
    extensions: ["html"]
  })
);
console.log("BREVO KEY EXISTS:", !!process.env.BREVO_API_KEY);

/* ============================
   HELPER: PUSH NOTIFICATIONS
============================ */
// 1. Send to a specific user (e.g., Restaurant or Orphanage)
async function sendPushNotification(userId, title, body) {
  if (!db) { console.log("⚠️ DB not connected, skipping notification."); return; }

  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (userDoc.exists && userDoc.data().fcmToken) {
      const message = {
        token: userDoc.data().fcmToken,
        notification: { title, body }
      };
      await admin.messaging().send(message);
      console.log(`📲 Notification sent to user: ${userId}`);
    } else {
      console.log(`⚠️ No FCM Token found for user: ${userId}`);
    }
  } catch (error) {
    console.error("❌ Notification Error:", error.message);
  }
}

// 2. Broadcast to specific Role (Orphanages, Restaurants, or All)
async function broadcastToRole(role, title, body) {
  if (!db) { console.log("⚠️ DB not connected, skipping broadcast."); return; }

  try {
    let query = db.collection("users");
    
    // If role is 'all', we don't filter by role
    if (role !== 'all') {
        query = query.where("role", "==", role);
    }

    const snapshot = await query.get();
    const tokens = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.fcmToken) tokens.push(data.fcmToken);
    });

    if (tokens.length > 0) {
      // Send in batches of 500 (Firebase limit)
      const batchSize = 500;
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batchTokens = tokens.slice(i, i + batchSize);
        await admin.messaging().sendEachForMulticast({
          tokens: batchTokens,
          notification: { title, body }
        });
      }
      console.log(`📢 Broadcast sent to ${tokens.length} users (Role: ${role})`);
    } else {
      console.log(`⚠️ No users with registered tokens found for role: ${role}`);
    }
  } catch (error) {
    console.error("❌ Broadcast Error:", error.message);
  }
}

/* ============================
   NOTIFICATION LISTENER (NEW)
   Watches Firestore for Admin Broadcasts
============================ */
function startNotificationListener() {
    if (!db) return;
    
    console.log("👀 Watching for new Admin Broadcasts...");

    // Only listen for new notifications created AFTER the server starts
    const startTime = admin.firestore.Timestamp.now();

    db.collection('notifications')
      .where('createdAt', '>', startTime)
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const { title, message, targetAudience, targetUserId } = data;

            console.log(`🔔 New Admin Broadcast Detected: "${title}" -> Target: ${targetAudience}`);

            if (targetAudience === 'specific' && targetUserId) {
                // Send to SINGLE user
                await sendPushNotification(targetUserId, title, message);
            } else if (targetAudience === 'all') {
                // Send to EVERYONE
                await broadcastToRole('all', title, message);
            } else if (targetAudience === 'restaurant' || targetAudience === 'orphanage') {
                // Send to ROLE
                await broadcastToRole(targetAudience, title, message);
            }
          }
        });
      }, (error) => {
          console.error("❌ Notification Listener Error:", error);
      });
}

// Start the listener
startNotificationListener();

/* ============================
   BREVO EMAIL SENDER
============================ */
async function sendTemplateEmail({ to, templateId, params }) {
  const api = new Brevo.TransactionalEmailsApi();

  return api.sendTransacEmail(
    {
      to,
      templateId,
      params
    },
    {
      headers: {
        "api-key": process.env.BREVO_API_KEY
      }
    }
  );
}

/* ============================
   API: NOTIFY NEW DONATION
============================ */
app.post("/api/notify-donation", async (req, res) => {
  try {
    const { foodName, restaurantName } = req.body;
    
    // Uses the new generalized helper
    await broadcastToRole('orphanage', 
      "Food Available 🍲", 
      `${restaurantName} just donated ${foodName}. Tap to claim!`
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Broadcast Route Error:", err);
    res.status(500).json({ error: "Notification failed" });
  }
});

/* ============================
   API: CLAIM FOOD
============================ */
app.post("/api/claim-food", async (req, res) => {
  try {
    const { restaurant, orphanage, food, restaurantId } = req.body;

    if (!restaurant || !orphanage || !food) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    // 1. Send Email
    await sendTemplateEmail({
      to: [
        { email: restaurant.email, name: restaurant.name },
        { email: orphanage.email, name: orphanage.name }
      ],
      templateId: 1,
      params: {
        food_name: food.name,
        food_quantity: food.quantity,
        restaurant_name: restaurant.name,
        restaurant_phone: restaurant.phone,
        restaurant_address: restaurant.address,
        restaurant_lat: restaurant.location?.lat,
        restaurant_lng: restaurant.location?.lng,
        orphanage_name: orphanage.name,
        orphanage_phone: orphanage.phone,
        orphanage_address: orphanage.address,
        orphanage_lat: orphanage.location?.lat,
        orphanage_lng: orphanage.location?.lng
      }
    });

    // 2. Send Push Notification
    if (restaurantId) {
       await sendPushNotification(
         restaurantId,
         "Food Claimed! ✅",
         `${orphanage.name} has claimed your ${food.name}. Check your email for details.`
       );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ CLAIM API ERROR:", err.response?.body || err);
    res.status(500).json({ error: "Email/Notification failed" });
  }
});

/* ============================
   API: CONFIRM RECEIPT
============================ */
app.post("/api/confirm-receipt", async (req, res) => {
  try {
    const { restaurant, orphanage, food, restaurantId } = req.body;

    // 1. Send Email
    await sendTemplateEmail({
      to: [
        { email: restaurant.email, name: restaurant.name },
        { email: orphanage.email, name: orphanage.name }
      ],
      templateId: 2,
      params: {
        food_name: food.name,
        food_quantity: food.quantity,
        restaurant_name: restaurant.name,
        orphanage_name: orphanage.name
      }
    });

    // 2. Send Push Notification
    if (restaurantId) {
        await sendPushNotification(
          restaurantId,
          "Receipt Confirmed 🏁",
          `${orphanage.name} confirmed pickup of ${food.name}. Transaction complete.`
        );
     }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ CONFIRM API ERROR:", err.response?.body || err);
    res.status(500).json({ error: "Email/Notification failed" });
  }
});

/* ============================
   START SERVER
============================ */
app.listen(PORT, () => {
  console.log(`🚀 FoodBridge backend running on port ${PORT}`);
});
