// Reads the colour of a slide image at given points, for the `key` colours in elements.json.
// Usage: npm run colors -- <project.json> <slide number> <x,y> [<x,y> …]   (x and y from 0 to 1, as on the grid images)
// The image is decoded by Chrome's canvas, so no image library beyond the app's own setup is needed.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {withApp} from './app-session.mjs';
const [input,slide,...points]=process.argv.slice(2);
if(!input||!slide||!points.length){console.error('Usage: npm run colors -- <project.json> <スライド番号> <x,y> [<x,y> …]');process.exit(1);}
const project=JSON.parse(readFileSync(resolve(input),'utf8')),image=project.slides?.[Number(slide)-1]?.image;
if(!image){console.error(`スライド ${slide} に画像がありません。`);process.exit(1);}
const at=points.map(p=>{const [x,y]=p.split(',').map(Number);if(!(x>=0&&x<=1&&y>=0&&y<=1))throw new Error(`位置は0〜1で書いてください: ${p}`);return [x,y];});
const colors=await withApp(page=>page.evaluate(async([src,at])=>{
 const img=new Image();img.src=src;await img.decode();
 const canvas=Object.assign(document.createElement('canvas'),{width:img.naturalWidth,height:img.naturalHeight}),c=canvas.getContext('2d');c.drawImage(img,0,0);
 return at.map(([x,y])=>{const d=c.getImageData(Math.min(canvas.width-1,Math.floor(x*canvas.width)),Math.min(canvas.height-1,Math.floor(y*canvas.height)),1,1).data;
  return '#'+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('');});
},[image,at]));
points.forEach((p,i)=>console.log(p,colors[i]));
