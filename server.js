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
   BREVO CONFIG
============================ */
const brevoClient = Brevo.ApiClient.instance;
const apiKey = brevoClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

const emailApi = new Brevo.TransactionalEmailsApi();

/* ============================
   EMAIL HELPERS
============================ */
async function sendEmail({ to, subject, html }) {
  return emailApi.sendTransacEmail({
    sender: {
      email: process.env.FROM_EMAIL,
      name: process.env.FROM_NAME
    },
    to,
    subject,
    htmlContent: html
  });
}

/* ============================
   API: ORPHANAGE CLAIMS FOOD
============================ */
app.post("/api/claim-food", async (req, res) => {
  try {
    const { restaurant, orphanage, food } = req.body;

    const html = `
      <h2>🍽 Food Claim Initiated</h2>
      <p><strong>Food:</strong> ${food.name} (${food.quantity} people)</p>

      <h3>🏪 Restaurant Details</h3>
      <p>
        ${restaurant.name}<br>
        📞 ${restaurant.phone}<br>
        📍 ${restaurant.address}
      </p>

      <h3>🏠 Orphanage Details</h3>
      <p>
        ${orphanage.name}<br>
        📞 ${orphanage.phone}<br>
        📍 ${orphanage.address}
      </p>

      <p>Please coordinate for pickup/delivery.</p>
    `;

    await sendEmail({
      to: [
        { email: restaurant.email, name: restaurant.name },
        { email: orphanage.email, name: orphanage.name }
      ],
      subject: "FoodBridge – Food Claim Details",
      html
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Email failed" });
  }
});

/* ============================
   API: CONFIRM RECEIPT
============================ */
app.post("/api/confirm-receipt", async (req, res) => {
  try {
    const { restaurant, orphanage, food } = req.body;

    const html = `
      <h2>✅ Food Received Successfully</h2>
      <p>
        <strong>${orphanage.name}</strong> has confirmed receiving:
      </p>
      <p>
        🍛 ${food.name} – for ${food.quantity} people
      </p>
      <p>Thank you for reducing food waste ❤️</p>
    `;

    await sendEmail({
      to: [
        { email: restaurant.email, name: restaurant.name },
        { email: orphanage.email, name: orphanage.name }
      ],
      subject: "FoodBridge – Delivery Confirmed",
      html
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
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
  console.log(`FoodBridge backend running on port ${PORT}`);
});
