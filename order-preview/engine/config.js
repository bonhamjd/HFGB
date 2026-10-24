// Turns env vars (Cloudflare secrets/vars, a local .env file, or the browser demo) into one config object.
const list = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
export function makeConfig(env = {}) {
  const mode = (env.CLOVER_MODE || 'mock').toLowerCase(); // mock | sandbox | production
  return {
    mode,
    tz: env.TZ_NAME || 'America/Chicago',
    mid: env.CLOVER_MID || 'MOCKMERCHANT1',
    apiToken: env.CLOVER_API_TOKEN || (mode === 'mock' ? 'mock-api-token' : ''),
    ecomPrivate: env.CLOVER_ECOM_PRIVATE || (mode === 'mock' ? 'mock-ecom-private' : ''),
    ecomPublic: env.CLOVER_ECOM_PUBLIC || (mode === 'mock' ? 'mock-ecom-public' : ''),
    orderTypeId: env.CLOVER_ORDER_TYPE_ID || '',
    orderTypeLabel: env.CLOVER_ORDER_TYPE_LABEL || 'Online Pickup',
    allowSetup: mode !== 'production' || env.ALLOW_PROD_SETUP === 'true', // never touch prod config without JD's yes
    onlineCategories: list(env.ONLINE_CATEGORIES || 'Food Menu,Pop'),
    blockedCategories: list(env.BLOCKED_CATEGORIES || 'Liquor,Beer Draft,Beer Cans,Beer Bottles,Beer Off Sale,Off Sale,Seltzer,Wine,Shots,Speciality,Bloody Mary Bar,Smokes,Golf,Retail Items'),
    menuSyncMin: +(env.MENU_SYNC_MIN || 10),
    orderOpen: env.ORDER_OPEN || '11:00',
    firstPickup: env.FIRST_PICKUP || '11:30',
    lastOrder: env.LAST_ORDER || '21:00',
    lastPickup: env.LAST_PICKUP || '21:30',
    closedWeekdays: list(env.CLOSED_WEEKDAYS).map(Number),
    closedDates: list(env.CLOSED_DATES),
    slotCap: +(env.SLOT_CAP || 6),
    prepMin: +(env.PREP_MIN || 20),
    maxItems: +(env.MAX_ITEMS || 40),
    maxTotal: +(env.MAX_ORDER_TOTAL || 0), // cents, 0 = no cap. Safety cap for the test window.
    printEnabled: env.PRINT_ENABLED !== 'false',
    smsEnabled: env.SMS_ENABLED === 'true',
    smsTo: env.SMS_TO || '',
    twilioSid: env.TWILIO_SID || '', twilioToken: env.TWILIO_TOKEN || '', twilioFrom: env.TWILIO_FROM || '',
    staffKey: env.STAFF_KEY || (mode === 'mock' ? 'demo' : ''),
    adminKey: env.ADMIN_KEY || (mode === 'mock' ? 'demo' : ''),
    allowedOrigins: list(env.ALLOWED_ORIGINS || 'https://highflyersgolfbar.com,http://localhost:8787,http://127.0.0.1:8787'),
    allowTestClock: mode === 'mock',
    // Hard kill switch: no Clover order, charge, customer or print unless PAYMENTS_ENABLED=true. Off by default for real Clover.
    paymentsEnabled: mode === 'mock' ? env.PAYMENTS_ENABLED !== 'false' : env.PAYMENTS_ENABLED === 'true',
  };
}
export function publicConfig(cfg, base) {
  return { mode: cfg.mode, mid: cfg.mid, ecomPublic: cfg.ecomPublic, sdk: base.sdk,
    orderOpen: cfg.orderOpen, firstPickup: cfg.firstPickup, lastOrder: cfg.lastOrder, lastPickup: cfg.lastPickup,
    slotCap: cfg.slotCap, prepMin: cfg.prepMin, tz: cfg.tz, smsEnabled: cfg.smsEnabled, paymentsEnabled: cfg.paymentsEnabled };
}
