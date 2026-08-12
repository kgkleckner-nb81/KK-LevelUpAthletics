// Level Up Athletics — generate-avatar-face
//
// Called from a signed-in parent's browser to generate a stylized,
// background-removed face-layer image for one of their athletes from a
// selfie. Requires the caller's own valid session, the athleteId must
// belong to that caller (same ownership-check pattern as the other Edge
// Functions in this project), AND the athleteId must be on the
// ALLOWED_ATHLETE_IDS allowlist — an explicit early-access gate so this
// stays restricted to approved athletes while the feature is still new,
// same "your-family-only for now" approach used elsewhere in this app.
//
// Uploads the final image to the avatar-faces Storage bucket (public-read,
// see 0019_avatar_faces_storage.sql) and returns that stable URL. Does NOT
// write athletes.avatar_url itself — the client shows the result for the
// parent to review, then saves it via a separate direct update (mirrors
// the existing updateAthleteAge pattern), so a bad photo/crop never
// silently becomes the live avatar.
//
// Deploy: Supabase Dashboard → Edge Functions → New function → name it
// "generate-avatar-face" → paste this file's contents (pipeline.ts must be
// uploaded alongside it in the same function folder) → Deploy. Also set
// two secrets: Edge Functions → Secrets → FAL_KEY, and ALLOWED_ATHLETE_IDS
// (comma-separated athlete UUIDs — find them in Table Editor → athletes).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  createAvatarFaceLayer,
  REALISTIC_BUST_PROMPT,
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
const ALLOWED_ATHLETE_IDS = (Deno.env.get('ALLOWED_ATHLETE_IDS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

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
    const promptOverride = body?.style === 'realistic' ? REALISTIC_BUST_PROMPT : undefined;

    if (!athleteId || !selfieDataUri) {
      return jsonResponse({ error: 'athlete_id and selfie_data_uri are required.' }, 400);
    }

    if (!ALLOWED_ATHLETE_IDS.includes(athleteId)) {
      return jsonResponse({ error: 'Avatar generation is not turned on for this athlete yet.' }, 403);
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

    const { imageUrl, metadata } = await createAvatarFaceLayer(selfieDataUri, athleteId, model, FAL_KEY, promptOverride);

    // Re-host the fal.ai result (a temporary URL) in our own Storage so the
    // Player Card has a stable, permanent image to point at.
    const imageRes = await fetch(imageUrl);
    const imageBytes = new Uint8Array(await imageRes.arrayBuffer());
    const storagePath = `${athleteId}/${crypto.randomUUID()}.png`;
    const { error: uploadErr } = await adminClient.storage
      .from('avatar-faces')
      .upload(storagePath, imageBytes, { contentType: 'image/png', upsert: false });
    if (uploadErr) throw uploadErr;
    const { data: publicUrlData } = adminClient.storage.from('avatar-faces').getPublicUrl(storagePath);

    return jsonResponse({ image_url: publicUrlData.publicUrl, metadata });
  } catch (err) {
    if (err instanceof ModerationRejectedError) {
      return jsonResponse({ error: 'That photo could not be used — try a different one.' }, 422);
    }
    return jsonResponse({ error: err instanceof Error ? err.message : 'Could not generate the avatar.' }, 500);
  }
});
