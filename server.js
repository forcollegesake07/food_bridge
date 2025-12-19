const express = require("express");
const path = require("path");
const Brevo = require("@getbrevo/brevo");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Serve static frontend
app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"]
}));

/* ============================
   BREVO CONFIG (SAFE)
============================ */
const brevoClient = Brevo.ApiClient.instance;
const apiKey = brevoClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

const emailApi = new Brevo.TransactionalEmailsApi();

/* ============================
   EMAIL HELPER (TEMPLATE)
============================ */
async function sendTemplateEmail({ to, templateId, params }) {
  return emailApi.sendTransacEmail({
    to,
    templateId,
    params
  });
}

/* ============================
   API: ORPHANAGE CLAIMS FOOD
============================ */
app.post("/api/claim-food", async (req, res) => {
  try {
    const { restaurant, orphanage, food } = req.body;

    await sendTemplateEmail({
      to: [
        { email: restaurant.email, name: restaurant.name },
        { email: orphanage.email, name: orphanage.name }
      ],
      templateId: 1, // ✅ REPLACE WITH YOUR REAL CLAIM TEMPLATE ID
      params: {
        receiver_name: restaurant.name,
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
    console.error("Claim email error:", err);
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
      templateId: 2, // ✅ REPLACE WITH YOUR REAL CONFIRM TEMPLATE ID
      params: {
        receiver_name: restaurant.name,
        food_name: food.name,
        food_quantity: food.quantity,

        orphanage_name: orphanage.name,
        orphanage_address: orphanage.address
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Confirm email error:", err);
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
