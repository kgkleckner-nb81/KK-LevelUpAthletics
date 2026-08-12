// Level Up Athletics — avatar face-layer generation pipeline.
//
// Framework-free (no Supabase imports) so the exact same module runs both
// inside the generate-avatar-face Edge Function (index.ts) and inside the
// local Deno test script (test.ts) — one implementation, two callers.
//
// Real API shapes below were pulled from fal.ai's live docs, not assumed:
// - fal-ai/flux-2-pro/edit:  safety_tolerance 1 (strictest) - 5 (permissive), default 2
// - fal-ai/nano-banana-2/edit: safety_tolerance 1 (strictest) - 6 (permissive), default 4
//   (different scale AND different param shape than flux — aspect_ratio/resolution,
//   not image_size — this is why callers must not assume the two edit models share
//   a request shape)
// - fal-ai/birefnet/v2: model variant "Portrait" (not a separate model id)
// All three are async queue jobs: POST to submit, GET to poll status, GET to
// fetch the result once COMPLETED. Auth header: "Authorization: Key $FAL_KEY".

export type EditModel = 'flux-2-pro' | 'nano-banana-2';

export interface GenerationMetadata {
  seed: number;
  model: EditModel;
  modelEndpoint: string;
  timestamp: string;
}

export interface AvatarFaceResult {
  imageUrl: string;
  metadata: GenerationMetadata;
}

// Thrown when fal's safety checker rejects the input/output — never retried,
// meant to be shown to a parent as "try a different photo," not a generic error.
export class ModerationRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModerationRejectedError';
  }
}

// Thrown for anything else that fails after retries are exhausted.
export class FalGenerationError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'FalGenerationError';
  }
}

const FAL_QUEUE_BASE = 'https://queue.fal.run';

// Locked prompt template — do not edit inline without re-testing against a
// real photo first (see supabase/functions/generate-avatar-face/test.ts).
// v2: added a basic "Rookie" uniform + cap so every default avatar starts
// dressed for the part, before any Gear Locker cosmetics are equipped on
// top. "No additional text/logos" (not a blanket "no text") deliberately
// carves out room for the one intentional ROOKIE chest text.
export const STYLIZED_BUST_PROMPT =
  'Convert this photo into a 2D stylized illustrated bust portrait, ' +
  'front-facing, neutral gradient background, centered head and shoulders, ' +
  "wearing a simple gray and navy baseball uniform with 'ROOKIE' across " +
  'the chest and a plain navy baseball cap, polished shading and lighting, ' +
  'no additional text, no logos, age-appropriate and safe style suitable ' +
  'for a youth sports platform.';

// Experimental alternate — under evaluation, not locked. Same structural
// constraints as the locked template (front-facing, neutral background,
// centered head/shoulders, rookie uniform + cap, no additional text/logos,
// age-appropriate), swapped toward a photorealistic render instead of an
// illustrated one.
export const REALISTIC_BUST_PROMPT =
  'Render this photo as a polished, photorealistic portrait, front-facing, ' +
  'neutral gradient background, centered head and shoulders, wearing a ' +
  "simple gray and navy baseball uniform with 'ROOKIE' across the chest " +
  'and a plain navy baseball cap, natural studio lighting and soft ' +
  'shading, sports-trading-card photo quality, no additional text, no ' +
  'logos, age-appropriate and safe style suitable for a youth sports ' +
  'platform.';

const EDIT_MODEL_ENDPOINTS: Record<EditModel, string> = {
  'flux-2-pro': 'fal-ai/flux-2-pro/edit',
  'nano-banana-2': 'fal-ai/nano-banana-2/edit',
};

const BIREFNET_ENDPOINT = 'fal-ai/birefnet/v2';

// Stable hash of the athlete's UUID into fal's valid int32 seed range, so
// regenerating for the same athlete without an explicit "reroll" reproduces
// the same result. Not cryptographic — just needs to be deterministic and
// well-distributed.
export function deriveDeterministicSeed(athleteId: string): number {
  let hash = 2166136261; // FNV-1a 32-bit offset basis
  for (let i = 0; i < athleteId.length; i++) {
    hash ^= athleteId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Force unsigned, then clamp into a safe positive int32 range.
  return (hash >>> 0) % 2147483647;
}

interface QueueSubmitResponse {
  request_id: string;
  status_url: string;
  response_url: string;
}

interface QueueStatusResponse {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED';
  queue_position?: number;
}

async function falFetch(url: string, falKey: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  return res;
}

async function submitFalJob(
  modelEndpoint: string,
  payload: Record<string, unknown>,
  falKey: string,
): Promise<QueueSubmitResponse> {
  const res = await falFetch(`${FAL_QUEUE_BASE}/${modelEndpoint}`, falKey, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new FalGenerationError(`fal submit failed (${res.status}) for ${modelEndpoint}: ${body}`);
  }
  return res.json();
}

async function pollFalJob(
  statusUrl: string,
  falKey: string,
  { maxAttempts = 60, intervalMs = 2000 } = {},
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await falFetch(statusUrl, falKey);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new FalGenerationError(`fal status check failed (${res.status}): ${body}`);
    }
    const status: QueueStatusResponse = await res.json();
    if (status.status === 'COMPLETED') return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new FalGenerationError(`fal job did not complete within ${maxAttempts * intervalMs}ms`);
}

async function fetchFalResult<T>(responseUrl: string, falKey: string): Promise<T> {
  const res = await falFetch(responseUrl, falKey);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // fal surfaces safety-checker rejections as a 4xx with a NSFW/moderation
    // message in the body — distinguish that from a generic failure so
    // createAvatarFaceLayer can decide whether a retry makes sense.
    if (res.status === 422 || /nsfw|safety|flagged|moderat/i.test(body)) {
      throw new ModerationRejectedError(`fal flagged this generation: ${body}`);
    }
    throw new FalGenerationError(`fal result fetch failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function runFalJob<T>(
  modelEndpoint: string,
  payload: Record<string, unknown>,
  falKey: string,
): Promise<T> {
  const submitted = await submitFalJob(modelEndpoint, payload, falKey);
  await pollFalJob(submitted.status_url, falKey);
  return fetchFalResult<T>(submitted.response_url, falKey);
}

interface FluxEditResult {
  images: { url: string }[];
  seed: number;
}

interface NanoBananaEditResult {
  images: { url: string }[];
}

interface BirefnetResult {
  image: { url: string };
}

// Step 1: selfie -> stylized bust portrait via the chosen edit model.
export async function generateStylizedBust(
  selfieUrlOrDataUri: string,
  athleteId: string,
  model: EditModel = 'flux-2-pro',
  falKey: string,
  promptOverride?: string,
): Promise<{ imageUrl: string; metadata: GenerationMetadata }> {
  const seed = deriveDeterministicSeed(athleteId);
  const modelEndpoint = EDIT_MODEL_ENDPOINTS[model];
  const timestamp = new Date().toISOString();
  const prompt = promptOverride ?? STYLIZED_BUST_PROMPT;

  if (model === 'flux-2-pro') {
    const result = await runFalJob<FluxEditResult>(modelEndpoint, {
      prompt,
      image_urls: [selfieUrlOrDataUri],
      image_size: 'portrait_4_3',
      seed,
      safety_tolerance: '1', // strictest on flux's 1(strict)-5(permissive) scale
      output_format: 'png',
    }, falKey);
    return {
      imageUrl: result.images[0].url,
      metadata: { seed: result.seed ?? seed, model, modelEndpoint, timestamp },
    };
  }

  // nano-banana-2: different param shape (aspect_ratio/resolution, not
  // image_size) and a different safety_tolerance scale (1-6, not 1-5) —
  // does not return seed in its response, so we report back the seed we sent.
  const result = await runFalJob<NanoBananaEditResult>(modelEndpoint, {
    prompt,
    image_urls: [selfieUrlOrDataUri],
    aspect_ratio: '3:4',
    resolution: '1K',
    seed,
    safety_tolerance: '1', // strictest on nano-banana-2's 1(strict)-6(permissive) scale
    output_format: 'png',
    limit_generations: true,
  }, falKey);
  return {
    imageUrl: result.images[0].url,
    metadata: { seed, model, modelEndpoint, timestamp },
  };
}

// Step 2: background removal, Portrait variant.
export async function removeBackground(imageUrl: string, falKey: string): Promise<string> {
  const result = await runFalJob<BirefnetResult>(BIREFNET_ENDPOINT, {
    image_url: imageUrl,
    model: 'Portrait',
    output_format: 'png',
    refine_foreground: true,
  }, falKey);
  return result.image.url;
}

// Moderation extension point — currently a no-op stub. A real moderation
// check gets wired in later; this app handles images of minors, so this
// seam needs to stay obvious to whoever picks it up next.
export async function reviewGeneratedImage(
  _imageUrl: string,
  _metadata: GenerationMetadata,
): Promise<{ approved: boolean; reason?: string }> {
  return { approved: true };
}

async function withRetry<T>(fn: () => Promise<T>, { attempts = 3, baseDelayMs = 1000 } = {}): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ModerationRejectedError) throw err; // never retry a rejection
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
    }
  }
  throw lastErr instanceof Error
    ? new FalGenerationError(`fal generation failed after ${attempts} attempts: ${lastErr.message}`, lastErr)
    : new FalGenerationError(`fal generation failed after ${attempts} attempts`, lastErr);
}

// Full pipeline: generate -> remove background -> moderation seam.
export async function createAvatarFaceLayer(
  selfieUrlOrDataUri: string,
  athleteId: string,
  model: EditModel = 'flux-2-pro',
  falKey: string = Deno.env.get('FAL_KEY') ?? '',
  promptOverride?: string,
): Promise<AvatarFaceResult> {
  if (!falKey) throw new FalGenerationError('FAL_KEY is not set');

  const { imageUrl: bustUrl, metadata } = await withRetry(() =>
    generateStylizedBust(selfieUrlOrDataUri, athleteId, model, falKey, promptOverride)
  );
  const cutoutUrl = await withRetry(() => removeBackground(bustUrl, falKey));

  const review = await reviewGeneratedImage(cutoutUrl, metadata);
  if (!review.approved) {
    throw new ModerationRejectedError(review.reason ?? 'Generated image failed review');
  }

  return { imageUrl: cutoutUrl, metadata };
}
