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
app.post("/api/chat", async (req, res) => {
    try {
        const { message, role } = req.body;
        const msg = message.toLowerCase();
        let reply = "I'm not sure about that. Try asking about donations, pickups, or history.";

        // --- 1. RESTAURANT RESPONSES ---
        if (role === 'restaurant') {
            if (msg.includes('hello') || msg.includes('hi')) 
                reply = "Hello! I am your Restaurant Assistant. I can help you donate food or check your history.";
            else if (msg.includes('donate') || msg.includes('food')) 
                reply = "To donate food, click the 'Donate Food' button on your dashboard, enter the details, and click Submit.";
            else if (msg.includes('history') || msg.includes('past')) 
                reply = "You can view all your past contributions in the 'History' tab on the left sidebar.";
            else if (msg.includes('waste') || msg.includes('save')) 
                reply = "By donating, you reduce food waste! Check your 'Impact' score on the home screen.";
            else if (msg.includes('contact') || msg.includes('support')) 
                reply = "You can contact admin support at admin@foodbridge.com.";
        }

        // --- 2. ORPHANAGE RESPONSES ---
        else if (role === 'orphanage') {
            if (msg.includes('hello') || msg.includes('hi')) 
                reply = "Hello! I am here to help you find food for your center.";
            else if (msg.includes('request') || msg.includes('need')) 
                reply = "To request food, go to the 'Available Donations' tab and click 'Request' on any nearby listing.";
            else if (msg.includes('alert') || msg.includes('notification')) 
                reply = "We will notify you via email whenever a restaurant near you posts a donation.";
            else if (msg.includes('contact')) 
                reply = "Need urgent help? Call our hotline or email support@foodbridge.com.";
        }

        // --- 3. DRIVER RESPONSES ---
        else if (role === 'driver') {
            if (msg.includes('hello') || msg.includes('hi')) 
                reply = "Hi driver! Ready to deliver? Ask me about jobs or routes.";
            else if (msg.includes('job') || msg.includes('pickup')) 
                reply = "Check the 'Available Jobs' tab to accept new delivery tasks within 10km of your location.";
            else if (msg.includes('route') || msg.includes('map')) 
                reply = "Once you accept a job, click 'Navigate' to open Google Maps for the fastest route.";
            else if (msg.includes('money') || msg.includes('paid')) 
                reply = "This is a volunteer platform, but you earn points and badges for every successful delivery!";
        }

        // Simulate "thinking" time for realism
        setTimeout(() => {
            res.json({ reply });
        }, 500);

    } catch (error) {
        res.json({ reply: "Sorry, I am having trouble connecting." });
    }
});

app.listen(PORT, () => {
  console.log(`🚀 FoodBridge backend running on port ${PORT}`);
});
