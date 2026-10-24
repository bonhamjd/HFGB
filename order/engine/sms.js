// Optional text backup. OFF unless SMS_ENABLED=true and Twilio values are set. Never called in mock mode.
export async function sendSms(cfg, to, body, fetchFn = fetch) {
  if (!cfg.smsEnabled) return { status: 'off' };
  if (cfg.mode === 'mock') return { status: 'mock_skipped' };
  if (!cfg.twilioSid || !cfg.twilioToken || !cfg.twilioFrom || !to) return { status: 'not_configured' };
  const r = await fetchFn(`https://api.twilio.com/2010-04-01/Accounts/${cfg.twilioSid}/Messages.json`, {
    method: 'POST', headers: { authorization: 'Basic ' + btoa(cfg.twilioSid + ':' + cfg.twilioToken), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: cfg.twilioFrom, Body: body }).toString() });
  return { status: r.ok ? 'sent' : 'error_' + r.status };
}
