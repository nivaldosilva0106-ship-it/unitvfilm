const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('pageerror', error => {
        console.log('Page error:', error.message, error.stack);
    });
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('Console error:', msg.text());
        }
    });
    try {
        await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0' });
    } catch (e) {
        console.error('Goto error', e);
    }
    await new Promise(r => setTimeout(r, 2000));
    await browser.close();
})();
