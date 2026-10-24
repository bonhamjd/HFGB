// Preview only: runs the real backend code in the browser with the Clover mock and localStorage.
// The order page, staff screen and dashboard share state across tabs of the same browser.
import { makeConfig } from './engine/config.js';
import { CloverClient } from './engine/clover.js';
import { createMockClover } from './engine/mockclover.js';
import { MemStore } from './engine/store_mem.js';
import { createApp } from './engine/app.js';
const ls = k => ({ load: () => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, save: v => localStorage.setItem(k, JSON.stringify(v)) });
export async function boot() {
  const get = f => fetch('./data/' + f + '?v=2').then(r => r.json());
  const [seed, overrides, pairings] = await Promise.all([get('mock_seed.json'), get('menu_overrides.json'), get('pairings.json')]);
  const cfg = makeConfig({ CLOVER_MODE: 'mock', ALLOWED_ORIGINS: location.origin });
  const m = ls('hfgb_demo_clover'), s = ls('hfgb_demo_store');
  const app = createApp({ cfg, store: new MemStore(s.load, s.save), clover: new CloverClient(cfg, createMockClover({ seed, cfg, ...m })), data: { overrides, pairings } });
  await app.ensureOrderType();
  return app;
}
