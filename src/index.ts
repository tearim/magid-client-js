// Entry of the embed build (npm run build:embed → dist-embed/magid-embed.js, CSS included):
//   import { mountMagid } from './magid-embed.js';
//   const magid = mountMagid(document.getElementById('story'), { baseUrl: 'https://stories.example.org', story: '…' });
export { mountMagid, type MagidHandle } from './mount';
export type { MagidMountOptions } from './options';
