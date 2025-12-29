document.addEventListener("DOMContentLoaded", () => {
    // 1. Detect if running inside the Android App
    if (navigator.userAgent.includes("FoodBridgeApp")) {
        console.log("App Mode Detected");
        document.body.classList.add("app-mode");
    }

    // 2. Prevent Logo from redirecting to Index (Home) in App Mode
    if (document.body.classList.contains("app-mode")) {
        const homeLinks = document.querySelectorAll('a[href="index.html"], a[href="/index.html"], a[href="/"]');
        homeLinks.forEach(link => {
            link.href = "javascript:void(0)"; // Disable link
            link.style.pointerEvents = "none";
        });
    }
});
