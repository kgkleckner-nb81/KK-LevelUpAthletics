// Level Up Athletics — redeem-device-token
//
// Called on every app load where the URL has a ?login=<token> param —
// whether that's the very first time in Safari right after "Add to Home
// Screen", or every subsequent open from the installed icon afterward.
// Callable while completely signed out (that's the whole point), so it
// does NOT require an existing session — only the device token itself.
//
// Design note: this function does NOT hand back a Supabase session
// directly. It never fabricates or stores a raw refresh token. Instead, on
// a valid device token it calls Supabase's own admin.generateLink() to
// produce a short-lived, single-use magic-link verification artifact
// (hashed_token), and returns just that. The client then completes sign-in
// itself via the ordinary public supabase.auth.verifyOtp() call — so the
// only thing this function ever exposes over the wire is something
// Supabase's own auth system already treats as short-lived and single-use,
// never a long-lived credential.
//
// Deploy: Supabase Dashboard → Edge Functions → New function → name it
// "redeem-device-token" → paste this file's contents → Deploy.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Sliding renewal window — every valid redemption (even one that doesn't
// need to re-establish a session because the icon's own storage already
// has one) pushes expires_at forward by this much. An actively-opened icon
// never expires; one left untouched for 90 days quietly stops working.
const TOKEN_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { token } = await req.json();
    if (!token || typeof token !== 'string') throw new Error('Missing device token.');

    const tokenHash = await sha256Hex(token);
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: row, error: lookupErr } = await adminClient
      .from('device_tokens')
      .select('id, user_id, revoked_at, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (lookupErr) throw lookupErr;

    if (!row || row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: 'This device link is no longer valid.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sliding renewal — bump last_used_at/expires_at on every valid hit,
    // regardless of whether the client below ends up needing a fresh
    // session or already has one.
    const newExpiresAt = new Date(Date.now() + TOKEN_LIFETIME_MS).toISOString();
    await adminClient
      .from('device_tokens')
      .update({ last_used_at: new Date().toISOString(), expires_at: newExpiresAt })
      .eq('id', row.id);

    const { data: userResult, error: userErr } = await adminClient.auth.admin.getUserById(row.user_id);
    if (userErr || !userResult?.user?.email) throw userErr ?? new Error('Account not found.');

    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: userResult.user.email,
    });
    if (linkErr) throw linkErr;

    return new Response(JSON.stringify({ hashed_token: linkData.properties.hashed_token }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Could not sign in from this device link.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
