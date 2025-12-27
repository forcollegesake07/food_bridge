const express = require("express");
const cors = require("cors");
const Brevo = require("@getbrevo/brevo");
const admin = require("firebase-admin"); 
const path = require("path");
const fs = require("fs"); // Used to check file existence

// [NEW] Imports for Custom Emailer
const nodemailer = require("nodemailer");
const multer = require("multer");
// Configure Multer to store files in RAM (not on disk) for the emailer
const upload = multer({ storage: multer.memoryStorage() });

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
   [NEW] CUSTOM EMAIL API (SMTP)
   This handles the "Emailer" tab in your Admin Panel
============================ */
const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 465,
   secure: true,
    auth: {
        // Render will read these from your Environment Variables
        user: process.env.SMTP_USER, 
        pass: process.env.SMTP_PASS  
    }
});

app.post('/api/send-custom-mail', upload.array('attachments'), async (req, res) => {
    const { to, subject, text } = req.body;
    const files = req.files || [];

    try {
        // Convert Multer files to Nodemailer attachment format
        const attachments = files.map(file => ({
            filename: file.originalname,
            content: file.buffer
        }));

        await transporter.sendMail({
            // Uses your verified sender email from env vars, or defaults to the hardcoded one
            from: process.env.SENDER_EMAIL || "admin@foodbridge.qzz.io", 
            to: to,
            subject: subject,
            text: text,
            attachments: attachments
        });

        console.log(`📧 Custom email sent to ${to}`);
        res.json({ success: true, message: "Email sent successfully!" });
    } catch (error) {
        console.error("❌ Custom Email Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/* ============================
   HELPER: PUSH NOTIFICATIONS
============================ */
// 1. Send to a specific user (e.g., Restaurant)
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

// 2. Broadcast to all Orphanages
async function broadcastToOrphanages(title, body) {
  if (!db) { console.log("⚠️ DB not connected, skipping broadcast."); return; }

  try {
    const snapshot = await db.collection("users").where("role", "==", "orphanage").get();
    const tokens = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.fcmToken) tokens.push(data.fcmToken);
    });

    if (tokens.length > 0) {
      await admin.messaging().sendEachForMulticast({
        tokens: tokens,
        notification: { title, body }
      });
      console.log(`📢 Broadcast sent to ${tokens.length} orphanages`);
    } else {
      console.log("⚠️ No orphanages with registered tokens found.");
    }
  } catch (error) {
    console.error("❌ Broadcast Error:", error.message);
  }
}

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
    
    await broadcastToOrphanages(
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
