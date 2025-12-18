const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

/**
 * MIDDLEWARE
 * We serve all your existing static files (HTML, CSS, JS).
 * Note: Keep your .html files in the root directory or a folder named 'public'.
 */
app.use(express.static(path.join(__dirname, 'public')));

/**
 * ROUTES
 * Express will serve your index.html by default at the root URL.
 * These routes ensure that navigating to /login or /admin works correctly.
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/restaurant', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'restaurant.html'));
});

app.get('/orphanages', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'orphanages.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/terms', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'terms&conditions.html'));
});

/**
 * 404 HANDLER
 * If a user goes to a route that doesn't exist, send them back home.
 */
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`FoodBridge Backend running on port ${PORT}`);
});
