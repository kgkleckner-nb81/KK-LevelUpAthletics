// Level Up Athletics — redeem-pairing-code
//
// Called from a freshly-added, not-yet-signed-in Home Screen icon (or
// regular Safari) when the parent types the short pairing code shown on
// their own device. Callable while completely signed out — the code
// itself is the credential for this one-time exchange.
//
// Same design principle as the old redeem-device-token: this function
// never hands back a Supabase session directly, and never fabricates or
// stores a raw refresh token. It calls Supabase's own
// admin.generateLink() to produce a short-lived, single-use magic-link
// verification artifact (hashed_token) and returns just that. The client
// completes sign-in itself via the ordinary public
// supabase.auth.verifyOtp() call.
//
// Also returns device_token_id — NOT a secret, just this device_tokens
// row's id — so the paired device can store it locally and later call the
// authenticated touch_device_token(id) RPC (0016_pairing_code.sql) using
// its own normal session to keep the pairing record alive and to detect
// revocation. No long-lived secret needs to live on the device at all.
//
// Deploy: Supabase Dashboard → Edge Functions → New function → name it
// "redeem-pairing-code" → paste this file's contents → Deploy. (The old
// "redeem-device-token" function can be deleted — nothing calls it
// anymore.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const DEVICE_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { code } = await req.json();
    const normalized = String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!normalized) throw new Error('Enter the device code.');

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: row, error: lookupErr } = await adminClient
      .from('device_tokens')
      .select('id, user_id, pairing_code_expires_at, revoked_at')
      .eq('pairing_code', normalized)
      .maybeSingle();
    if (lookupErr) throw lookupErr;

    if (!row || row.revoked_at || new Date(row.pairing_code_expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: 'That code is invalid or has expired. Generate a new one and try again.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Single-use: clear the code immediately so it can't be redeemed
    // twice, and start this device's 90-day sliding renewal window.
    await adminClient
      .from('device_tokens')
      .update({
        pairing_code: null,
        pairing_code_expires_at: null,
        last_used_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + DEVICE_LIFETIME_MS).toISOString(),
      })
      .eq('id', row.id);

    const { data: userResult, error: userErr } = await adminClient.auth.admin.getUserById(row.user_id);
    if (userErr || !userResult?.user?.email) throw userErr ?? new Error('Account not found.');

    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: userResult.user.email,
    });
    if (linkErr) throw linkErr;

    return new Response(JSON.stringify({ hashed_token: linkData.properties.hashed_token, device_token_id: row.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Could not sign in with that code.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
