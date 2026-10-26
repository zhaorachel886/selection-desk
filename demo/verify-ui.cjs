// Offline UI regression checks. Requires Playwright and local Chrome or Edge.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('C:/Users/Rachel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const checks = [];
function check(name, passed, evidence) {
  checks.push({ name, passed: !!passed, evidence });
  if (!passed) throw new Error(name + ': ' + JSON.stringify(evidence));
}
async function contained(page, label) {
  const data = await page.evaluate(() => {
    const stage = document.querySelector('#stage').getBoundingClientRect();
    const rect = e => { const r = e.getBoundingClientRect(); return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height }; };
    return {
      overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
      stage: { left:stage.left, top:stage.top, right:stage.right, bottom:stage.bottom },
      windows: [...document.querySelectorAll('.floating')].map(rect),
      inputs: [...document.querySelectorAll('.composer')].map(rect)
    };
  });
  check(label + ' page fits', !data.overflow, data);
  check(label + ' windows and composers contained', [...data.windows, ...data.inputs].every(r => r.left >= data.stage.left && r.right <= data.stage.right + 1 && r.top >= data.stage.top && r.bottom <= data.stage.bottom + 1 && r.height > 0), data);
}
(async () => {
  const executablePath = [process.env.UI_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean).find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless:true, executablePath });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.join(__dirname, 'index.html')).href);
    for (const viewport of [{width:1340,height:800}, {width:1340,height:595}, {width:1000,height:595}, {width:676,height:595}, {width:390,height:844}, {width:541,height:476}]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => reset());
      const label = viewport.width + 'x' + viewport.height;
      await contained(page, label + ' ask');
      await page.evaluate(() => scenario('selection'));
      const toolbar = await page.locator('#toolbar').boundingBox();
      check(label + ' toolbar fits', toolbar.x >= 0 && toolbar.x + toolbar.width <= viewport.width && toolbar.y + toolbar.height <= viewport.height, toolbar);
      check(label + ' overlay containers do not scroll', await page.evaluate(()=>['.stage-scroll','#stage'].every(s=>{const e=document.querySelector(s);return e.scrollLeft===0&&e.scrollTop===0})));
      await page.evaluate(() => scenario('history'));
      await contained(page, label + ' history');
      check(label + ' single line history', await page.locator('.history-row').first().evaluate(e => { const t=e.querySelector('.history-title').getBoundingClientRect(), d=e.querySelector('.history-time').getBoundingClientRect(); return Math.abs((t.top+t.bottom)-(d.top+d.bottom))<2; }));
      await page.evaluate(() => scenario('dual'));
      await contained(page, label + ' dual');
      check(label + ' two windows', await page.locator('.floating').count() === 2);
      const windows = await page.locator('.floating').evaluateAll(es => es.map(e => {const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}}));
      check(label + ' dual windows do not overlap', windows[0].right <= windows[1].x || windows[1].right <= windows[0].x || windows[0].bottom <= windows[1].y || windows[1].bottom <= windows[0].y, windows);
      // Even in a short pane, the language menu must escape the scrolling body.
      await page.locator('.language-picker summary').click();
      await page.waitForSelector('.language-menu:popover-open');
      const option = page.getByRole('menuitemradio', { name:'英文', exact:true });
      const box = await option.boundingBox();
      check(label + ' menu option can be hit', await option.evaluate(e => {const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}), box);
      await page.keyboard.press('Escape');
      // Escape must dismiss a menu before dismissing the temporary window.
      check(label + ' Escape retains windows', await page.locator('.floating').count() === 2);
      await page.locator('[data-action="settings"]').click();
      const dialog = await page.locator('#settings').boundingBox();
      check(label + ' settings fits', dialog.x >= 0 && dialog.y >= 0 && dialog.x+dialog.width <= viewport.width+1 && dialog.y+dialog.height <= viewport.height+1, dialog);
      await page.locator('[data-action="close-settings"]').click();
      if (viewport.width === 676 || viewport.width === 1340 && viewport.height === 595) {
        for (const scene of ['ask','selection','history','dual','error']) {
          await page.evaluate(n => {reset();scenario(n)}, scene);
          await page.screenshot({path:path.join(__dirname, 'audit-'+label+'-'+scene+'.png')});
        }
      }
    }
    await page.setViewportSize({width:676,height:595});
    await page.evaluate(() => {reset(); selected='长原文内容。'.repeat(150);const q=openNew();q.turns=[{question:'解释这段内容',answer:'这是用于验证滚动与换行的示例回答。\n\n'.repeat(100)}];q.state='done';touch(q);renderWindows();});
    await page.locator('[data-action="expand"]').click();
    await contained(page, 'long quote and answer');
    check('long content scrolls inside body', await page.locator('.window-content').evaluate(e => e.scrollHeight > e.clientHeight));
    await page.locator('.window-content').evaluate(e => e.scrollTop = e.scrollHeight);
    check('composer remains clickable', await page.locator('.send-stop').evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
    await page.screenshot({path:path.join(__dirname,'audit-long-content.png')});
    await page.evaluate(() => {reset();scenario('background')});
    check('switching preserves background generation', await page.evaluate(() => [...all.values()].filter(q=>q.state==='running').length === 2));
    await page.locator('textarea').fill('保留这个草稿');
    await page.locator('[data-action="send-stop"]').click();
    check('stop isolates current conversation', await page.evaluate(() => [...all.values()].filter(q=>q.state==='running').length === 1));
    check('stop preserves draft', await page.locator('textarea').inputValue() === '保留这个草稿');
    await page.evaluate(()=>scenario('history'));
    check('history has no task status', !/生成中|已完成|已停止/.test(await page.locator('.history-list').textContent()));
    await page.evaluate(()=>{reset();scenario('translation')});
    await page.waitForFunction(()=>!document.querySelector('.assistant-text.streaming'));
    await page.locator('.language-picker summary').focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForSelector('.language-menu:popover-open');
    check('keyboard enters language menu', await page.getByRole('menuitemradio',{name:'中文',exact:true}).evaluate(e=>document.activeElement===e));
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    check('keyboard selection starts translation', await page.locator('.language-picker summary').textContent()==='英文' && await page.locator('.assistant-text.streaming').count()===1);
    await page.waitForFunction(()=>!document.querySelector('.assistant-text.streaming'));
    await page.locator('.language-picker summary').click();
    await page.getByRole('menuitemradio',{name:'英文',exact:true}).click();
    check('same language does not regenerate', await page.locator('.assistant-text.streaming').count()===0);
    check('translation actions retain accessible names', await page.getByRole('button',{name:'复制译文',exact:true}).textContent()==='' && await page.getByRole('button',{name:'重新生成',exact:true}).textContent()==='');
    await page.screenshot({path:path.join(__dirname,'audit-translation.png')});
    check('no browser exceptions', errors.length===0, errors);
    const metrics = await page.evaluate(() => Object.fromEntries(['.window-title','.quote','.assistant-text','.composer textarea','.language-picker summary'].map(s=>{const c=getComputedStyle(document.querySelector(s));return [s,{font:c.fontSize,lineHeight:c.lineHeight}]})));
    fs.writeFileSync(path.join(__dirname,'ui-verification.json'),JSON.stringify({passed:checks.length,checks,metrics},null,2));
    console.log(JSON.stringify({passed:checks.length,metrics}));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
