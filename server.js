const express = require("express");
const cors = require("cors");
const Brevo = require("@getbrevo/brevo");
const admin = require("firebase-admin"); 
const path = require("path");
const fs = require("fs"); 

const app = express();
const PORT = process.env.PORT || 10000;
require("dotenv").config(); // Load environment variables first

// --- GEMINI AI SETUP ---
const { GoogleGenerativeAI } = require("@google/generative-ai");
let genAI;
let model;

if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log("✅ Google Gemini AI Initialized");
} else {
    console.log("⚠️ GEMINI_API_KEY missing. AI running in Mock Mode.");
}

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
// --- GEMINI CHAT ENDPOINT ---
app.post("/api/chat", async (req, res) => {
    try {
        const { message, role } = req.body;
        
        // 1. Mock Mode (Fallback if no key)
        if (!model) {
            let reply = "I am a basic bot (Add GEMINI_API_KEY to enable real AI).";
            if (message.toLowerCase().includes("hello")) reply = "Hello! How can I help you with FoodBridge?";
            return res.json({ reply });
        }

        // 2. Real Gemini AI Mode
        const personas = {
            restaurant: "You are a helpful assistant for Restaurant staff using FoodBridge. Help them donate excess food and track waste. Keep answers short and professional.",
            orphanage: "You are a caring assistant for Orphanage staff. Help them find nearby food donations and manage requests. Be empathetic and concise.",
            driver: "You are a logistics assistant for Drivers. Help them navigate to pickups and deliveries. Be efficient and clear."
        };

        const systemInstruction = personas[role] || "You are a helpful assistant for FoodBridge.";
        const fullPrompt = `${systemInstruction}\n\nUser Question: ${message}\nAnswer:`;

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        
        res.json({ reply: response.text() });

    } catch (error) {
        console.error("Gemini Error:", error);
        res.status(500).json({ reply: "Sorry, I'm having trouble thinking right now." });
    }
});

app.listen(PORT, () => {
  console.log(`🚀 FoodBridge backend running on port ${PORT}`);
});
