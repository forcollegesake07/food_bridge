const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

/**
 * STATIC FILE SERVING
 * This setup looks into the 'public' folder.
 * The 'extensions' option allows users to visit /login and Express 
 * will automatically find and serve login.html.
 */
app.use(express.static(path.join(__dirname, 'public'), {
    extensions: ['html', 'htm']
}));

/**
 * CORE ROUTES
 * Explicit routing for the home page.
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * 404 / CATCH-ALL
 * If a user types an invalid URL, we redirect them back to the 
 * landing page to keep them within the app flow.
 */
app.use((req, res) => {
    res.status(404).redirect('/');
});

app.listen(PORT, () => {
    console.log(`-----------------------------------------`);
    console.log(`FoodBridge Backend is LIVE`);
    console.log(`Port: ${PORT}`);
    console.log(`Mode: Clean URLs Enabled`);
    console.log(`-----------------------------------------`);
});
