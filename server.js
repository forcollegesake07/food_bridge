const express = require("express");
const cors = require("cors");
const Brevo = require("@getbrevo/brevo");

const app = express();
const PORT = process.env.PORT || 10000;
const path = require("path");

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
   BREVO EMAIL SENDER (STABLE)
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
  restaurant_lat: restaurant.location?.lat,
  restaurant_lng: restaurant.location?.lng,

  orphanage_name: orphanage.name,
  orphanage_phone: orphanage.phone,
  orphanage_address: orphanage.address,
  orphanage_lat: orphanage.location?.lat,
  orphanage_lng: orphanage.location?.lng
}

    });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ BREVO ERROR:", err.response?.body || err);
    res.status(500).json({ error: "Email failed" });
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
         restaurant_name: restaurant.name,
        orphanage_name: orphanage.name
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ BREVO ERROR:", err.response?.body || err);
    res.status(500).json({ error: "Email failed" });
  }
});

/* ============================
   START SERVER
============================ */
app.listen(PORT, () => {
  console.log(`🚀 FoodBridge backend running on port ${PORT}`);
});
