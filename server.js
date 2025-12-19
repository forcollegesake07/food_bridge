const express = require("express");
const path = require("path");
const cors = require("cors");
const Brevo = require("@getbrevo/brevo");

const app = express();
const PORT = process.env.PORT || 3000;

/* ============================
   MIDDLEWARE
============================ */
app.use(cors({
  origin: "*", // allow GitHub Pages
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"]
}));

/* ============================
   BREVO CONFIG (CORRECT v2)
============================ */
const emailApi = new Brevo.TransactionalEmailsApi();

/* ============================
   EMAIL HELPER
============================ */
async function sendTemplateEmail({ to, templateId, params }) {
  const response = await emailApi.sendTransacEmail(
    { to, templateId, params },
    { headers: { "api-key": process.env.BREVO_API_KEY } }
  );

  console.log("BREVO RESPONSE:", response);
  return response;
}
console.log("BREVO KEY EXISTS:", !!process.env.BREVO_API_KEY);
/* ============================
   API: CLAIM FOOD
============================ */
app.post("/api/claim-food", async (req, res) => {
  try {
    const { restaurant, orphanage, food } = req.body;
     // 🔐 SAFETY CHECK: location must exist
if (
  !restaurant ||
  !orphanage ||
  !restaurant.location ||
  !orphanage.location ||
  restaurant.location.lat == null ||
  restaurant.location.lng == null ||
  orphanage.location.lat == null ||
  orphanage.location.lng == null
) {
  return res.status(400).json({
    error: "Location data missing for restaurant or orphanage"
  });
}
     const restaurantMapLink =
  `https://www.google.com/maps?q=${restaurant.location.lat},${restaurant.location.lng}`;

const orphanageMapLink =
  `https://www.google.com/maps?q=${orphanage.location.lat},${orphanage.location.lng}`;

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
    restaurant_map: restaurantMapLink,

    orphanage_name: orphanage.name,
    orphanage_phone: orphanage.phone,
    orphanage_address: orphanage.address,
    orphanage_map: orphanageMapLink
  }
});
    res.json({ success: true });
  } catch (err) {
    console.error("Claim email error:", err.response?.body || err);
    res.status(500).json({ error: "Failed to send claim email" });
  }
});

/* ============================
   API: CONFIRM RECEIPT
============================ */
app.post("/api/confirm-receipt", async (req, res) => {
  try {
    const { restaurant, orphanage, food } = req.body;

    await sendTemplateEmail({
      to: [
        { email: restaurant.email, name: restaurant.name },
        { email: orphanage.email, name: orphanage.name }
      ],
      templateId: 2,
      params: {
        food_name: food.name,
        food_quantity: food.quantity,
        orphanage_name: orphanage.name
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Confirm email error:", err.response?.body || err);
    res.status(500).json({ error: "Failed to send confirmation email" });
  }
});

/* ============================
   FALLBACK
============================ */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`FoodBridge backend running on port ${PORT}`);
});
