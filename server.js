const express = require("express");
const cors = require("cors");
const Brevo = require("@getbrevo/brevo");
const admin = require("firebase-admin");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

/* ============================
   FIREBASE ADMIN INIT
============================ */
admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  )
});

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

/* ============================
   AUTH MIDDLEWARE
============================ */
async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/* ============================
   ADMIN ONLY: SET ROLE
============================ */
app.post(
  "/api/set-role",
  verifyFirebaseToken,
  async (req, res) => {
    // Only admins can assign roles
    if (!req.user.admin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { uid, role } = req.body;

    if (!uid || !["restaurant", "orphanage"].includes(role)) {
      return res.status(400).json({ error: "Invalid input" });
    }

    await admin.auth().setCustomUserClaims(uid, {
      role,
      admin: false
    });

    res.json({ success: true });
  }
);

/* ============================
   BREVO EMAIL SENDER
============================ */
async function sendTemplateEmail({ to, templateId, params }) {
  const api = new Brevo.TransactionalEmailsApi();

  return api.sendTransacEmail(
    { to, templateId, params },
    { headers: { "api-key": process.env.BREVO_API_KEY } }
  );
}

/* ============================
   API: CLAIM FOOD
============================ */
app.post("/api/claim-food", async (req, res) => {
  try {
    const { restaurant, orphanage, food } = req.body;
    if (!restaurant || !orphanage || !food) {
      return res.status(400).json({ error: "Invalid request data" });
    }

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
        orphanage_name: orphanage.name,
        orphanage_phone: orphanage.phone,
        orphanage_address: orphanage.address
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ BREVO ERROR:", err);
    res.status(500).json({ error: "Email failed" });
  }
});

/* ============================
   START SERVER
============================ */
app.listen(PORT, () => {
  console.log(`🚀 FoodBridge backend running on port ${PORT}`);
});
