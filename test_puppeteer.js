const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  console.log('Navigating to localhost:5173...');
  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 15000 });
    console.log('Page loaded. Taking screenshot...');
    await page.screenshot({ path: 'local_test.png' });
    console.log('Screenshot saved to local_test.png');
    
    // 打印当前的 DOM 结构中关键的可见性和 z-index
    const elementsInfo = await page.evaluate(() => {
      const getInfo = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          id: el.id,
          className: el.className,
          visible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.opacity !== '0',
          zIndex: style.zIndex,
          opacity: style.opacity,
          position: style.position,
          pointerEvents: style.pointerEvents,
          rect: { width: rect.width, height: rect.height }
        };
      };
      return {
        root: getInfo('#root'),
        rainCanvas: getInfo('.rain-canvas'),
        authShell: getInfo('.auth-shell'),
        authPanel: getInfo('.auth-panel'),
        musesyncPlayer: getInfo('.musesync-player'), // 如果登录了
      };
    });
    console.log('DOM Info:', JSON.stringify(elementsInfo, null, 2));
  } catch (err) {
    console.error('Failed to load page:', err);
  }
  
  await browser.close();
})();
