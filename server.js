const express = require("express");
const cors = require("cors");
const Brevo = require("@getbrevo/brevo");
const admin = require("firebase-admin"); 
const path = require("path");
const fs = require("fs"); 

const app = express();
const PORT = process.env.PORT || 10000;

/* ============================
   FIREBASE SETUP
============================= */
let db; 

try {
  if (fs.existsSync("./service-account.json")) {
    const serviceAccount = require("./service-account.json");
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore(); 
    console.log("✅ Firebase Admin Initialized");
  } else {
    console.log("⚠️ service-account.json not found. Server-side admin features disabled.");
  }
} catch (error) {
  console.error("❌ Firebase Init Error:", error.message);
}

/* ============================
   MIDDLEWARE
============================ */
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

/* ============================
   BREVO EMAIL SENDER
============================ */
async function sendTemplateEmail({ to, templateId, params }) {
  if (!process.env.BREVO_API_KEY) {
      console.log("⚠️ Brevo API Key missing. Skipping email.");
      return;
  }
  const api = new Brevo.TransactionalEmailsApi();
  return api.sendTransacEmail(
    { to, templateId, params },
    { headers: { "api-key": process.env.BREVO_API_KEY } }
  );
}

/* ============================
   API ROUTES
   (Simplified - removed FCM calls)
============================ */

app.post("/api/notify-donation", async (req, res) => {
  // Logic moved to client-side database listeners for simplicity
  res.json({ success: true, message: "Donation logged." });
});

app.post("/api/claim-food", async (req, res) => {
  try {
    const { restaurant, orphanage, food } = req.body;
    if (!restaurant || !orphanage || !food) return res.status(400).json({ error: "Invalid data" });

    await sendTemplateEmail({
      to: [{ email: restaurant.email, name: restaurant.name }, { email: orphanage.email, name: orphanage.name }],
      templateId: 1,
      params: {
        food_name: food.name,
        food_quantity: food.quantity,
        restaurant_name: restaurant.name,
        restaurant_phone: restaurant.phone,
        restaurant_address: restaurant.address,
        orphanage_name: orphanage.name,
        orphanage_phone: orphanage.phone,
        orphanage_address: orphanage.address
      }
    });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Claim API Error:", err);
    res.status(500).json({ error: "Email failed" });
  }
});

app.post("/api/confirm-receipt", async (req, res) => {
  try {
    const { restaurant, orphanage, food } = req.body;
    await sendTemplateEmail({
      to: [{ email: restaurant.email, name: restaurant.name }, { email: orphanage.email, name: orphanage.name }],
      templateId: 2,
      params: {
        food_name: food.name,
        food_quantity: food.quantity,
        restaurant_name: restaurant.name,
        orphanage_name: orphanage.name
      }
    });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Confirm API Error:", err);
    res.status(500).json({ error: "Email failed" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 FoodBridge backend running on port ${PORT}`);
});
