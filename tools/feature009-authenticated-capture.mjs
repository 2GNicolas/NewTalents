import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import WebSocket from 'ws';

const passportId = process.argv[2];
if (!/^[a-f0-9-]{36}$/.test(passportId ?? '')) throw new Error('Pass the isolated passport UUID');
const screenshots = resolve(import.meta.dirname, '../specs/009-first-match-flow/verification/screenshots');
const profile = mkdtempSync(join(tmpdir(), 'newtalents-feature009-authenticated-'));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  `--user-data-dir=${profile}`, '--headless=new', '--disable-gpu', '--no-first-run',
  '--no-default-browser-check', '--remote-debugging-port=0', '--hide-scrollbars', 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !existsSync(portFile); i += 1) await delay(100);
  if (!existsSync(portFile)) throw new Error('Chrome DevTools did not start');
  const [port] = readFileSync(portFile, 'utf8').split('\n');
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((yes, no) => { socket.once('open', yes); socket.once('error', no); });
  let sequence = 0;
  const pending = new Map();
  const paused = [];
  socket.on('message', (raw) => {
    const message = JSON.parse(String(raw));
    if (message.method === 'Fetch.requestPaused') paused.push(message.params);
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    if (message.error) item.no(new Error(message.error.message)); else item.yes(message.result);
  });
  const send = (method, params = {}) => new Promise((yes, no) => {
    const id = ++sequence;
    pending.set(id, { yes, no });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;
  const waitFor = async (expression, timeoutMs = 30000) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const value = await evaluate(expression);
      if (value) return value;
      await delay(250);
    }
    throw new Error(`Timed out waiting for ${expression}`);
  };
  const device = async (kind) => send('Emulation.setDeviceMetricsOverride', {
    width: kind === 'mobile' ? 390 : 1440, height: kind === 'mobile' ? 844 : 900,
    deviceScaleFactor: 1, mobile: kind === 'mobile',
  });
  const navigate = async (url) => { await send('Page.navigate', { url }); await delay(600); };
  const capture = async (name, bottom = false) => {
    if (bottom) await evaluate(`(() => {
      const elements = [...document.querySelectorAll('*')].filter((item) => item.scrollHeight > item.clientHeight + 20 && getComputedStyle(item).overflowY !== 'visible');
      const scroller = elements.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
      return Boolean(scroller);
    })()`);
    await delay(150);
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(join(screenshots, `${name}.png`), Buffer.from(shot.data, 'base64'));
    const metrics = await evaluate(`({url: location.pathname, innerWidth, scrollWidth: document.documentElement.scrollWidth,
      headings: [...document.querySelectorAll('[role="heading"],h1,h2')].map(x => x.textContent?.trim()),
      buttons: [...document.querySelectorAll('[role="button"],button')].map(x => x.textContent?.trim()).filter(Boolean),
      passportMenuCount: document.querySelectorAll('[data-testid="passport-nav-mobile"],[data-testid="passport-nav-desktop"]').length,
      visibleButtons: [...document.querySelectorAll('[role="button"],button')].filter(x => x.getBoundingClientRect().top >= 0 && x.getBoundingClientRect().bottom <= innerHeight).map(x => x.textContent?.trim())})`);
    process.stdout.write(`${name} ${JSON.stringify(metrics)}\n`);
  };
  const clickText = async (label) => evaluate(`(() => {
    const label = ${JSON.stringify(label)};
    const button = [...document.querySelectorAll('button,[role="button"]')].find(x => x.textContent?.trim().startsWith(label));
    if (!button) return false;
    button.click(); return true;
  })()`);
  const fill = async (selector, value) => {
    const found = await evaluate(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); if (!input) return false; input.focus(); return true; })()`);
    if (!found) throw new Error(`Missing input ${selector}`);
    await send('Input.insertText', { text: value });
  };
  const activateFocused = async (key = 'Enter') => {
    const code = key === 'Enter' ? 'Enter' : 'Space';
    const value = key === 'Enter' ? 13 : 32;
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: value });
    await send('Input.dispatchKeyEvent', { type: 'char', key, code, text: key === 'Enter' ? '\r' : ' ', windowsVirtualKeyCode: value });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: value });
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Accessibility.enable');
  await device('desktop');
  await navigate('http://localhost:8081/login');
  await waitFor(`document.querySelectorAll('input').length >= 2`);
  const inputs = await evaluate(`[...document.querySelectorAll('input')].map(x=>({type:x.type,placeholder:x.placeholder,aria:x.getAttribute('aria-label')}))`);
  process.stdout.write(`login inputs ${JSON.stringify(inputs)}\n`);
  await fill('input[type="email"]', 'feature009.visual@example.test');
  await fill('input[type="password"]', 'Synthetic-Feature009-Review!');
  if (!await clickText('Iniciar sesión')) throw new Error('Missing login action');
  await waitFor(`location.pathname.includes('passports')`, 30000);
  process.stdout.write(`authenticated path ${await evaluate('location.pathname')}\n`);
  await navigate(`http://localhost:8081/passports/${passportId}/first-match`);
  await waitFor(`Boolean(document.querySelector('[data-testid="first-match-waiting-desktop"],[data-testid="first-match-invitation-desktop"]'))`);
  if (await evaluate(`Boolean(document.querySelector('[data-testid="first-match-waiting-desktop"]'))`)) {
    if (!await clickText('Cancelar partido')) throw new Error('Missing booked-match cancel action');
    await waitFor(`Boolean(document.querySelector('[data-testid="first-match-cancel-confirmation"]'))`);
    if (!await clickText('Confirmar cancelación del partido')) throw new Error('Missing distinct cancel confirmation');
    await waitFor(`Boolean(document.querySelector('[data-testid="first-match-invitation-desktop"]'))`);
  }
  await waitFor(`Boolean(document.querySelector('[data-testid="first-match-invitation-desktop"]'))`);
  await capture('invitation-desktop-authenticated');
  await device('mobile');
  await delay(500);
  await waitFor(`Boolean(document.querySelector('[data-testid="first-match-invitation-mobile"]'))`);
  await capture('invitation-mobile-authenticated');
  await evaluate(`document.querySelector('[role="button"]')?.focus()`);
  const invitationFocus = await evaluate(`({role: document.activeElement?.getAttribute('role'), label: document.activeElement?.getAttribute('aria-label')})`);
  process.stdout.write(`invitation keyboard focus ${JSON.stringify(invitationFocus)}\n`);
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'char', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await delay(500);
  const enterActivated = await evaluate(`Boolean(document.querySelector('[data-testid="first-match-form-mobile"]'))`);
  process.stdout.write(`invitation Enter activated ${enterActivated}\n`);
  if (!enterActivated) {
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    await send('Input.dispatchKeyEvent', { type: 'char', text: ' ', key: ' ', windowsVirtualKeyCode: 32 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    await delay(500);
    const spaceActivated = await evaluate(`Boolean(document.querySelector('[data-testid="first-match-form-mobile"]'))`);
    process.stdout.write(`invitation Space activated ${spaceActivated}\n`);
    if (!spaceActivated && !await clickText('Agendar primer partido')) throw new Error('Missing scheduling action');
  }
  await waitFor(`Boolean(document.querySelector('[data-testid="first-match-form-mobile"]'))`);
  await capture('form-mobile-authenticated');
  await capture('form-mobile-bottom-authenticated', true);
  await evaluate(`document.querySelector('[data-testid="first-match-field-matchDate"]')?.focus()`);
  const focusOrder = [];
  for (let i = 0; i < 6; i += 1) {
    focusOrder.push(await evaluate(`document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim()`));
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  }
  process.stdout.write(`form keyboard order ${JSON.stringify(focusOrder)}\n`);
  if (!await clickText('Confirmar agendamiento')) throw new Error('Missing confirmation action');
  await waitFor(`document.body.textContent?.includes('es obligatorio')`);
  await capture('form-mobile-field-error-authenticated', true);
  const invalidFocus = await evaluate(`document.activeElement?.getAttribute('data-testid')`);
  if (invalidFocus !== 'first-match-field-matchDate') throw new Error(`Invalid form focused ${invalidFocus}, not the date field`);
  process.stdout.write('invalid form focused first erroneous field true\n');
  const errorAx = await send('Accessibility.getFullAXTree');
  process.stdout.write(`error accessibility ${JSON.stringify(errorAx.nodes.filter((node) => !node.ignored && ['textbox', 'alert'].includes(node.role?.value))
    .map((node) => ({ role: node.role?.value, name: node.name?.value, description: node.description?.value })).slice(0, 12))}\n`);
  await device('desktop');
  await delay(500);
  await capture('form-desktop-authenticated');
  const ax = await send('Accessibility.getFullAXTree');
  const nodes = ax.nodes.filter((node) => !node.ignored && ['heading', 'textbox', 'button', 'status'].includes(node.role?.value));
  process.stdout.write(`accessibility ${JSON.stringify(nodes.map((node) => ({ role: node.role?.value, name: node.name?.value })).slice(0, 40))}\n`);
  process.stdout.write(`form input IDs ${JSON.stringify(await evaluate('[...document.querySelectorAll("input")].map(x=>({id:x.getAttribute("data-testid"),value:x.value}))'))}\n`);
  await fill('[data-testid="first-match-field-matchDate"]', '2026-10-18');
  await fill('[data-testid="first-match-field-matchTime"]', '10:00');
  await fill('[data-testid="first-match-field-opponent"]', 'Academia Norte Sub-13');
  await fill('[data-testid="first-match-field-competition"]', 'Liga de formación');
  await fill('[data-testid="first-match-field-venue"]', 'Cancha Distrital Norte');
  await delay(800);
  await capture('form-desktop-filled-authenticated');
  await evaluate(`[...document.querySelectorAll('[role="button"],button')].find(x => x.getAttribute('aria-label') === 'Confirmar agendamiento')?.focus()`);
  await activateFocused();
  await waitFor(`Boolean(document.querySelector('[data-testid="first-match-waiting-desktop"]'))`);
  await capture('waiting-desktop-authenticated');
  const savedDetails = await evaluate(`document.querySelector('[data-testid="first-match-waiting-details"]')?.textContent`);
  await device('mobile');
  await delay(500);
  await capture('waiting-mobile-authenticated');
  await capture('waiting-mobile-bottom-authenticated', true);
  const liveRegions = await evaluate(`[...document.querySelectorAll('[aria-live]')].map(x => ({politeness:x.getAttribute('aria-live'),text:x.textContent?.trim().slice(0,100)}))`);
  process.stdout.write(`waiting live regions ${JSON.stringify(liveRegions)}\n`);
  const route = await evaluate('location.pathname');
  process.stdout.write(`final route ${route}\n`);
  await evaluate(`[...document.querySelectorAll('[role="button"],button')].find(x => x.getAttribute('aria-label') === 'Reagendar')?.focus()`);
  await activateFocused();
  await waitFor(`Boolean(document.querySelector('[data-testid="first-match-form-mobile"]'))`);
  process.stdout.write('waiting Reagendar keyboard activated true\n');
  if (!await clickText('Cancelar')) throw new Error('Missing form discard');
  await waitFor(`Boolean(document.querySelector('[data-testid="first-match-waiting-mobile"]'))`);
  await evaluate(`[...document.querySelectorAll('[role="button"],button')].find(x => x.getAttribute('aria-label') === 'Cancelar partido')?.focus()`);
  await activateFocused();
  await waitFor(`Boolean(document.querySelector('[data-testid="first-match-cancel-confirmation"]'))`);
  process.stdout.write('waiting Cancelar partido keyboard activated true\n');
  if (!await clickText('Conservar partido')) throw new Error('Missing keep-booking action');
  await send('Fetch.enable', { patterns: [{ urlPattern: 'http://localhost:3000/passports/*/first-match*', requestStage: 'Request' }] });
  await navigate(`http://localhost:8081/passports/${passportId}/first-match?loading-review=1`);
  for (let i = 0; i < 80 && paused.length === 0; i += 1) await delay(100);
  if (paused.length > 0) {
    await waitFor(`document.body.textContent?.includes('Cargando primer partido')`);
    process.stdout.write(`loading live region ${JSON.stringify(await evaluate(`[...document.querySelectorAll('[aria-live]')].map(x=>({politeness:x.getAttribute('aria-live'),text:x.textContent?.trim()}))`))}\n`);
    await capture('loading-mobile-authenticated');
    await device('desktop');
    await delay(200);
    await capture('loading-desktop-authenticated');
    for (const request of paused.splice(0)) await send('Fetch.continueRequest', { requestId: request.requestId });
  } else process.stdout.write('loading interception not observed\n');
  await send('Fetch.disable');
  await waitFor(`Boolean(document.querySelector('[data-testid="first-match-waiting-desktop"]'))`);
  const restoredDetails = await evaluate(`document.querySelector('[data-testid="first-match-waiting-details"]')?.textContent`);
  if (savedDetails !== restoredDetails) throw new Error('Reload did not recover identical saved match details');
  process.stdout.write('waiting persisted across authenticated reload true\n');
  await device('mobile');
  await delay(300);
  if (!await clickText('Reagendar')) throw new Error('Missing mobile reschedule action');
  await waitFor(`Boolean(document.querySelector('[data-testid="first-match-form-mobile"]'))`);
  const opponent = '[data-testid="first-match-field-opponent"]';
  if (!await evaluate(`(() => { const input = document.querySelector(${JSON.stringify(opponent)}); if (!input) return false; input.focus(); input.select(); return true; })()`))
    throw new Error('Missing prefilled mobile opponent');
  await send('Input.insertText', { text: 'Academia Oriente Sub-13' });
  await waitFor(`document.body.textContent?.includes('Se conserva una sola unidad del partido')`);
  process.stdout.write(`mobile reschedule before confirmation ${JSON.stringify(await evaluate(`({opponent:document.querySelector('[data-testid="first-match-field-opponent"]')?.value, summary:document.body.textContent?.slice(-500)})`))}\n`);
  if (!await clickText('Confirmar reagendamiento')) throw new Error('Missing mobile reschedule confirmation');
  await waitFor(`Boolean(document.querySelector('[data-testid="first-match-waiting-mobile"]')) && document.querySelector('[data-testid="first-match-waiting-details"]')?.textContent?.includes('Academia Oriente Sub-13')`);
  await capture('waiting-mobile-rescheduled-authenticated', true);
  process.stdout.write('mobile reschedule kept the same booked match true\n');
  if (!await clickText('Cancelar partido')) throw new Error('Missing mobile cancel action');
  await waitFor(`Boolean(document.querySelector('[data-testid="first-match-cancel-confirmation"]'))`);
  await capture('waiting-mobile-cancel-confirmation-authenticated', true);
  if (!await clickText('Confirmar cancelación del partido')) throw new Error('Missing mobile cancel confirmation');
  await waitFor(`Boolean(document.querySelector('[data-testid="first-match-invitation-mobile"]'))`);
  await capture('invitation-mobile-after-cancel-authenticated');
  process.stdout.write('mobile cancellation restored invitation true\n');
  await device('desktop');
  await navigate('http://localhost:8081/passports/00000000-0000-4000-8000-000000000001/first-match');
  await waitFor(`document.body.textContent?.includes('Acceso restringido')`);
  await capture('restricted-desktop-authenticated');
  await device('mobile');
  await delay(200);
  await capture('restricted-mobile-authenticated');
  await device('desktop');
  await send('Network.setBlockedURLs', { urls: ['http://localhost:3000/passports/*/first-match*'] });
  await navigate(`http://localhost:8081/passports/${passportId}/first-match`);
  await waitFor(`document.body.textContent?.includes('Servicio no disponible')`);
  await capture('unavailable-desktop-authenticated');
  await device('mobile');
  await delay(200);
  await capture('unavailable-mobile-authenticated');
  await send('Network.setBlockedURLs', { urls: [] });
} finally {
  socket?.close();
  chrome.kill();
}
