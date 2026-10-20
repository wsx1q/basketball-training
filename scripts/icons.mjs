import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
await mkdir('public',{recursive:true});
const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="100" fill="#173d30"/><circle cx="256" cy="256" r="155" fill="none" stroke="#c9d7a8" stroke-width="12"/><path d="M101 256h310M256 101v310M150 143q212 113 0 226M362 143q-212 113 0 226" fill="none" stroke="#c9d7a8" stroke-width="9"/><circle cx="360" cy="369" r="30" fill="#df984c"/></svg>`);
for(const [name,size] of [['icon-192',192],['icon-512',512],['apple-touch-icon',180]])await sharp(svg).resize(size,size).png().toFile(`public/${name}.png`);
