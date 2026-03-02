import puppeteer from 'puppeteer-core';

(async () => {
    const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
    const page = await browser.newPage();

    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
    page.on('pageerror', error => console.error('BROWSER ERROR:', error.message, '\n', error.stack));

    try {
        await page.goto('http://localhost:8080/auth');

        // Switch to register view
        const switchBtn = await page.$('button ::-p-text(Crea tu cuenta ahora)');
        if (switchBtn) await switchBtn.click();

        // Fill register email
        await page.waitForSelector('input[type="email"]');
        await page.type('input[type="email"]', 'testcrashpuppy2@example.com');
        await page.click('button[type="submit"]');

        // Wait for the next view to appear
        await page.waitForSelector('input[placeholder="Tu nombre completo"]');

        // Fill details
        await page.type('input[placeholder="Tu nombre completo"]', 'Test Puppy');
        await page.type('input[placeholder="Teléfono móvil"]', '+584121234567');
        await page.type('input[placeholder="Crea una contraseña"]', 'password123');

        // Click checkbox label
        await page.click('label[for="terms"]');

        console.log("WAITING TO SEE IF ERROR OCCURS IMMEDIATELY...");
        await new Promise(r => setTimeout(r, 2000));

        // Click register
        const finalBtn = await page.$('button[type="submit"]');
        if (finalBtn) await finalBtn.click();

        console.log("WAITING TO SEE IF ERROR OCCURS AFTER SUBMIT...");
        await new Promise(r => setTimeout(r, 3000));

    } catch (err) {
        console.error("Puppeteer script error:", err);
    } finally {
        await browser.close();
    }
})();
