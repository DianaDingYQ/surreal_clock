/**
 * Surreal prompt generation for the AI image generation layer.
 * Architecture is swappable — wire `generateImage(prompt)` to DALL-E, Stable Diffusion,
 * Replicate, or any other backend without touching anything else.
 */

const TEMPLATES = {
  circle: [
    'A surreal melting clock face dissolving into mercury pools, Dalí-inspired, dreamlike cinematic lighting, liquid gold drips',
    'An ancient eye suspended in liquid amber, melting at its edges, baroque chiaroscuro, otherworldly museum art',
    'A mirrored sphere melting into silver rivers, impossible reflections, dark atmospheric studio, hyper-real surrealism',
    'A celestial orb of wax slowly dissolving, candlelight interior, dreamlike fog, romantic surrealist oil painting',
  ],
  square: [
    'A melting architectural doorway dissolving into hot wax, brutalist surrealism, long shadows, atmospheric fog, dark cinematic',
    'A glass cube slowly liquifying, refracting impossible prismatic colors, dark studio lighting, ultra-detailed surreal render',
    'An ancient stone window frame melting like candle wax, dreamlike decay, baroque darkness, museum installation',
    'A television set turning to liquid obsidian, glowing static dissolving, cinematic noir surrealism',
  ],
  triangle: [
    'A crystal pyramid melting into prismatic liquid, dark atmosphere, rainbow refractions, surreal otherworldly dreamscape',
    'A mountain peak liquifying at golden dusk, dreamscape dissolution, painterly cinematic moodiness, surreal landscape',
    'An ancient obelisk turning to molten obsidian, smoke and cinematic shadows, surrealist oil painting, dark romanticism',
    'A shattered mirror pyramid melting, infinite reflections dissolving, dark void background, hyper-realistic surrealism',
  ],
  blob: [
    'An amorphous creature of silver mercury morphing through impossible shapes, dark dreamscape, cinematic surrealism',
    'A surreal melting cloud of iridescent matter dissolving into cosmic void, painterly surrealism, atmospheric lighting',
    'An organic mass of melting crystal and smoke, translucent layers, dramatic chiaroscuro, museum-quality surreal art',
    'A formless entity of liquid glass and shadow, dissolution mid-transformation, cinematic dark surrealism',
  ],
};

const SUFFIX =
  ', 8k resolution, museum installation art, surrealist masterwork, liquid textures, dreamlike atmosphere';

export function generatePrompt(shape) {
  const options = TEMPLATES[shape] ?? TEMPLATES.blob;
  const base = options[Math.floor(Math.random() * options.length)];
  return base + SUFFIX;
}

export function getShapeLabel(shape) {
  return { circle: 'CIRCLE', square: 'SQUARE', triangle: 'TRIANGLE', blob: 'FORM' }[shape] ?? 'FORM';
}

/**
 * Placeholder image generation — replace body with real API call.
 * Returns a Promise that resolves to an image URL (or null for canvas fallback).
 *
 * Example real implementation:
 *   const res = await fetch('https://api.openai.com/v1/images/generations', {
 *     method: 'POST',
 *     headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ prompt, n: 1, size: '1024x1024' }),
 *   });
 *   const data = await res.json();
 *   return data.data[0].url;
 */
export async function generateImage(_prompt) {
  // Simulate generation latency
  await new Promise((r) => setTimeout(r, 2800));
  // Return null → triggers the canvas-based generative art fallback
  return null;
}
