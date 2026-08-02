// Level Up Athletics — mint-device-token
//
// Called from an already-signed-in browser tab (right after magic-link
// sign-in, or later from account settings) to create a new Home Screen
// device link. Requires the caller's own valid session — a user can only
// ever mint a token for themselves, never for anyone else.
//
// The raw token is a random 256-bit secret, returned to the caller exactly
// once in this response. Only its SHA-256 hash is ever written to the
// device_tokens table (0015_device_tokens.sql) — this function is the only
// place in the whole system that ever sees the raw value.
//
// Deploy: Supabase Dashboard → Edge Functions → New function → name it
// "mint-device-token" → paste this file's contents → Deploy. No local CLI
// needed. Requires the SUPABASE_SERVICE_ROLE_KEY secret to already be set
// on the project (Dashboard → Edge Functions → Secrets) — Supabase sets
// SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY automatically
// for every project's functions, so nothing extra to configure there.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// 90-day sliding expiry — matches redeem-device-token's renewal window.
const TOKEN_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Identify the caller from their own Authorization header — never trust
    // a user id passed in the request body.
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Sign in first.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let deviceLabel: string | null = null;
    try {
      const body = await req.json();
      if (body && typeof body.device_label === 'string') {
        deviceLabel = body.device_label.slice(0, 60);
      }
    } catch { /* no body / not JSON — device_label stays null */ }

    const rawToken = randomToken();
    const tokenHash = await sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_LIFETIME_MS).toISOString();

    // Service-role client for the actual write — bypasses RLS, which is
    // fine here because we already authenticated the caller above and are
    // inserting user_id: user.id, never a caller-supplied id.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { error: insertErr } = await adminClient.from('device_tokens').insert({
      user_id: user.id,
      token_hash: tokenHash,
      device_label: deviceLabel,
      expires_at: expiresAt,
    });
    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ token: rawToken }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Could not create device link.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
