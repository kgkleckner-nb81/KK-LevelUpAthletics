// Level Up Athletics — mint-device-token
//
// Called from an already-signed-in browser (the parent's own device) to
// start pairing a new device (e.g. an athlete's iPad). Requires the
// caller's own valid session — a user can only ever create a pairing code
// for themselves, never for anyone else.
//
// Generates a short, human-typeable pairing code (like pairing a smart
// TV) — NOT a long secret. The code is stored as-is (not hashed): it's
// short-lived (15 minutes) and single-use by design, so it's a much lower
// value target than the long-lived credential the old design used, and
// there's nothing meaningful gained by hashing something this short and
// short-lived. Returned once to the caller for display.
//
// Deploy: Supabase Dashboard → Edge Functions → mint-device-token →
// replace its code with this file's contents → Deploy.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PAIRING_CODE_LIFETIME_MS = 15 * 60 * 1000;
const DEVICE_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

// Excludes visually-ambiguous characters (0/O, 1/I/L) so a code is easy to
// read off one screen and type correctly on another.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomPairingCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
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

    const code = randomPairingCode();
    const now = Date.now();

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { error: insertErr } = await adminClient.from('device_tokens').insert({
      user_id: user.id,
      device_label: deviceLabel,
      pairing_code: code,
      pairing_code_expires_at: new Date(now + PAIRING_CODE_LIFETIME_MS).toISOString(),
      expires_at: new Date(now + DEVICE_LIFETIME_MS).toISOString(),
    });
    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ code }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Could not create a device code.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
