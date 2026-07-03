const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  console.log('Navigating to http://localhost:5174...');
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle0' });
  
  console.log('Waiting for a few seconds to ensure animation finishes...');
  await new Promise(r => setTimeout(r, 2000));
  
  // 截图
  await page.screenshot({ path: 'screenshot_test.png' });
  console.log('Screenshot saved to screenshot_test.png');
  
  // 获取 DOM 结构
  const domInfo = await page.evaluate(() => {
    const authShell = document.querySelector('.auth-shell');
    const liquidPanel = document.querySelector('.liquid-glass-panel');
    const rainCanvas = document.querySelector('.rain-canvas');
    const root = document.getElementById('root');
    
    const getStyle = (el) => el ? {
      visibility: window.getComputedStyle(el).visibility,
      opacity: window.getComputedStyle(el).opacity,
      display: window.getComputedStyle(el).display,
      zIndex: window.getComputedStyle(el).zIndex,
      pointerEvents: window.getComputedStyle(el).pointerEvents,
      transform: window.getComputedStyle(el).transform,
      width: window.getComputedStyle(el).width,
      height: window.getComputedStyle(el).height,
      position: window.getComputedStyle(el).position
    } : null;

    return {
      root: getStyle(root),
      authShell: getStyle(authShell),
      liquidPanel: getStyle(liquidPanel),
      rainCanvas: getStyle(rainCanvas),
      bodyChildrenCount: document.body.children.length,
      rootInnerHTML: root ? root.innerHTML.substring(0, 1000) + '...' : 'no root',
      panelBoundingRect: liquidPanel ? liquidPanel.getBoundingClientRect() : null
    };
  });
  
  console.log('DOM Info:', JSON.stringify(domInfo, null, 2));
  
  await browser.close();
})();
