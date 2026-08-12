// Level Up Athletics — generate-avatar-face
//
// Called from a signed-in parent's browser to generate a stylized,
// background-removed face-layer image for one of their athletes from a
// selfie. Requires the caller's own valid session, and the athleteId must
// belong to that caller — same ownership-check pattern as the other Edge
// Functions in this project (mint-device-token, redeem-pairing-code).
//
// Part 1 scope only: generates and returns the image URL + metadata. Does
// NOT write to Storage or athletes.avatar_url yet — that's Part 2, once
// the selfie-capture UI exists to actually call this.
//
// Deploy: Supabase Dashboard → Edge Functions → New function → name it
// "generate-avatar-face" → paste this file's contents (pipeline.ts must be
// uploaded alongside it in the same function folder) → Deploy. Also set
// the FAL_KEY secret: Edge Functions → Secrets → add FAL_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  createAvatarFaceLayer,
  ModerationRejectedError,
  type EditModel,
} from './pipeline.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FAL_KEY = Deno.env.get('FAL_KEY')!;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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
      return jsonResponse({ error: 'Sign in first.' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const athleteId: string | undefined = body?.athlete_id;
    const selfieDataUri: string | undefined = body?.selfie_data_uri;
    const model: EditModel = body?.model === 'nano-banana-2' ? 'nano-banana-2' : 'flux-2-pro';

    if (!athleteId || !selfieDataUri) {
      return jsonResponse({ error: 'athlete_id and selfie_data_uri are required.' }, 400);
    }

    // Ownership check — a parent can only generate an avatar for their own
    // athlete, mirroring the RLS pattern used everywhere else in this app.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: athlete, error: athleteErr } = await adminClient
      .from('athletes')
      .select('id')
      .eq('id', athleteId)
      .eq('parent_profile_id', user.id)
      .maybeSingle();
    if (athleteErr) throw athleteErr;
    if (!athlete) {
      return jsonResponse({ error: 'Not authorized for this athlete.' }, 403);
    }

    const { imageUrl, metadata } = await createAvatarFaceLayer(selfieDataUri, athleteId, model, FAL_KEY);
    return jsonResponse({ image_url: imageUrl, metadata });
  } catch (err) {
    if (err instanceof ModerationRejectedError) {
      return jsonResponse({ error: 'rejected', message: 'That photo could not be used — try a different one.' }, 422);
    }
    return jsonResponse({ error: err instanceof Error ? err.message : 'Could not generate the avatar.' }, 500);
  }
});
