const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

/**
 * EMAIL CONFIGURATION
 * Uses environment variables set in Render (EMAIL_USER and EMAIL_PASS)
 */
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

/**
 * API ENDPOINT: Send Email
 * This is called by the frontend after a successful donation
 */
app.post('/api/send-email', async (req, res) => {
    const { to, subject, text, html } = req.body;

    const mailOptions = {
        from: `"FoodBridge Notification" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        text,
        html
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Email Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * STATIC FILE SERVING
 */
app.use(express.static(path.join(__dirname, 'public'), {
    extensions: ['html', 'htm']
}));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => {
    res.status(404).redirect('/');
});

app.listen(PORT, () => {
    console.log(`FoodBridge Backend LIVE with Email System on port ${PORT}`);
});
