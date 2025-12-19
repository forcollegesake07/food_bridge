const express = require("express");
const path = require("path");
const cors = require("cors");
const Brevo = require("@getbrevo/brevo");

const app = express();
const PORT = process.env.PORT || 3000;

/* ============================
   MIDDLEWARE
============================ */
app.use(cors({ origin: "*" }));
app.use(express.json());

app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"]
}));

/* ============================
   BREVO SETUP
============================ */
if (!process.env.BREVO_API_KEY) {
  console.error("❌ BREVO_API_KEY missing");
  process.exit(1);
}

const emailApi = new Brevo.TransactionalEmailsApi();

/* ============================
   EMAIL HELPER (MINIMAL)
============================ */
async function sendTemplateEmail({ to, templateId, params }) {
  try {
    const response = await emailApi.sendTransacEmail(
      {
        to,
        templateId,
        params,

        // ⚠️ MUST BE VERIFIED IN BREVO
        sender: {
          email: "no-reply@yourdomain.com",
          name: "FoodBridge"
        }
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY
        }
      }
    );

    console.log("✅ BREVO SENT:", response);
    return response;
  } catch (err) {
    console.error("❌ BREVO ERROR:", err.response?.body || err);
    throw err;
  }
}

/* ============================
   API: CLAIM FOOD
============================ */
app.post("/api/claim-food", async (req, res) => {
  try {
    const { restaurant, orphanage, food } = req.body;

    if (!restaurant || !orphanage || !food) {
      return res.status(400).json({ error: "Missing data" });
    }

    await sendTemplateEmail({
      to: [
        { email: restaurant.email, name: restaurant.name },
        { email: orphanage.email, name: orphanage.name }
      ],
      templateId: 1, // ⚠️ Must match Brevo template ID
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
      templateId: 2, // ⚠️ Must match Brevo template ID
      params: {
        food_name: food.name,
        food_quantity: food.quantity,
        orphanage_name: orphanage.name
      }
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Confirmation email failed" });
  }
});

/* ============================
   FALLBACK
============================ */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 FoodBridge backend running on port ${PORT}`);
});
