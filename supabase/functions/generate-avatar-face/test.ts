// Local pipeline test — runs the real fal.ai pipeline against a sample
// photo and saves the result locally. No Supabase involved; pure
// verification that generateStylizedBust -> removeBackground ->
// reviewGeneratedImage works end-to-end before anything gets wired to the
// live app.
//
// Usage:
//   FAL_KEY=... deno run --allow-net --allow-env --allow-read --allow-write \
//     supabase/functions/generate-avatar-face/test.ts \
//     <path-to-selfie.jpg> <fake-athlete-id> [--model=flux-2-pro|nano-banana-2] [--style=illustrated|realistic]
//
// --style=realistic uses the experimental REALISTIC_BUST_PROMPT (pipeline.ts)
// instead of the locked STYLIZED_BUST_PROMPT — for A/B comparison only, does
// not change what the shipped Edge Function uses by default.
//
// FAL_KEY is read from the environment (see ~/.zshrc) — never hardcode it.

import { createAvatarFaceLayer, REALISTIC_BUST_PROMPT, type EditModel } from './pipeline.ts';

function parseArgs() {
  const [photoPath, athleteId, ...rest] = Deno.args;
  if (!photoPath || !athleteId) {
    console.error('Usage: test.ts <path-to-selfie.jpg> <fake-athlete-id> [--model=flux-2-pro|nano-banana-2] [--style=illustrated|realistic]');
    Deno.exit(1);
  }
  const modelFlag = rest.find((a) => a.startsWith('--model='));
  const model = (modelFlag ? modelFlag.split('=')[1] : 'flux-2-pro') as EditModel;
  if (model !== 'flux-2-pro' && model !== 'nano-banana-2') {
    console.error(`Unknown --model value "${model}" — expected flux-2-pro or nano-banana-2`);
    Deno.exit(1);
  }
  const styleFlag = rest.find((a) => a.startsWith('--style='));
  const style = styleFlag ? styleFlag.split('=')[1] : 'illustrated';
  if (style !== 'illustrated' && style !== 'realistic') {
    console.error(`Unknown --style value "${style}" — expected illustrated or realistic`);
    Deno.exit(1);
  }
  return { photoPath, athleteId, model, style };
}

// String.fromCharCode(...bytes) blows the call stack on multi-MB images
// (spreading the whole array as function args) — encode in chunks instead.
function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function guessMimeType(path: string): string {
  const ext = path.toLowerCase().split('.').pop();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

async function main() {
  const { photoPath, athleteId, model, style } = parseArgs();
  const falKey = Deno.env.get('FAL_KEY');
  if (!falKey) {
    console.error('FAL_KEY is not set in this shell. See ~/.zshrc setup.');
    Deno.exit(1);
  }

  console.log(`Reading ${photoPath}...`);
  const bytes = await Deno.readFile(photoPath);
  const base64 = bytesToBase64(bytes);
  const dataUri = `data:${guessMimeType(photoPath)};base64,${base64}`;

  const promptOverride = style === 'realistic' ? REALISTIC_BUST_PROMPT : undefined;
  console.log(`Running createAvatarFaceLayer (model=${model}, style=${style}, athleteId=${athleteId})...`);
  const started = performance.now();

  const { imageUrl, metadata } = await createAvatarFaceLayer(dataUri, athleteId, model, falKey, promptOverride);

  const elapsedSec = ((performance.now() - started) / 1000).toFixed(1);
  console.log(`Done in ${elapsedSec}s.`);
  console.log('Metadata:', JSON.stringify(metadata, null, 2));
  console.log('Result URL:', imageUrl);

  console.log('Downloading result...');
  const res = await fetch(imageUrl);
  const outBytes = new Uint8Array(await res.arrayBuffer());
  const outPath = `./avatar-test-output-${model}-${style}-${athleteId}.png`;
  await Deno.writeFile(outPath, outBytes);
  console.log(`Saved to ${outPath}`);
}

main().catch((err) => {
  console.error(`Pipeline failed: ${err.name ?? 'Error'}: ${err.message ?? err}`);
  Deno.exit(1);
});
