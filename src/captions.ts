import type {Slide} from './model';
// Type-only imports keep this module runnable by Node's type stripping (scripts/captions-apply.mjs).
export type Caption={start:number;duration:number;text:string};
export const MAX_CAPTIONS=20,MAX_CAPTION_LENGTH=120;
export const MAX_CAPTION_LINES=12;
export function captionTextError(text:string):string|null {
 if(!text.trim())return '字幕の文を入力するか、この字幕を削除してください。';
 if(Array.from(text).length>MAX_CAPTION_LENGTH)return `字幕は1個${MAX_CAPTION_LENGTH}文字以内にしてください。`;
 if(text.split('\n').length>MAX_CAPTION_LINES)return `字幕の改行は${MAX_CAPTION_LINES}行以内にしてください。字幕を分けるか、改行を減らしてください。`;
 return null;
}
/** Indices of every caption that shares display time with another caption. */
export function overlappingCaptions(captions:Caption[]):Set<number> {
 const overlaps=new Set<number>();
 for(let i=0;i<captions.length;i++)for(let j=i+1;j<captions.length;j++){
  const a=captions[i],b=captions[j];
  if(a.start<b.start+b.duration-1e-9&&b.start<a.start+a.duration-1e-9){overlaps.add(i);overlaps.add(j);}
 }
 return overlaps;
}
/** Comfortable reading speed for Japanese subtitles, in characters per second. */
export const CHARS_PER_SECOND=6;
const LEAD=.3,GAP=.15,TAIL=.5,MIN=1.6;
const round=(n:number)=>Math.round(n*100)/100;
export const readingSeconds=(text:string)=>Math.max(MIN,Array.from(text.replace(/\s/g,'')).length/CHARS_PER_SECOND+.5);
/**
 * Lays captions out back to back at reading speed. When the slide is longer than
 * that needs, each caption stretches so the subtitles cover the whole slide.
 */
export function timeCaptions(texts:string[],slideDuration:number){
 const lines=texts.map(t=>t.trim()).filter(Boolean);
 if(lines.length>MAX_CAPTIONS)throw new Error(`字幕は1スライド${MAX_CAPTIONS}個以内にしてください。`);
 if(lines.some(t=>Array.from(t).length>MAX_CAPTION_LENGTH))throw new Error(`字幕は1個${MAX_CAPTION_LENGTH}文字以内にしてください。`);
 if(!lines.length)return{captions:[] as Caption[],duration:slideDuration};
 const base=lines.map(readingSeconds),needed=LEAD+base.reduce((n,s)=>n+s,0)+GAP*(lines.length-1)+TAIL;
 if(needed>60)throw new Error(`字幕の表示に${needed.toFixed(1)}秒必要です。1スライドの上限は60秒です。字幕を減らすか短くしてください。`);
 const duration=Math.min(60,Math.max(slideDuration,Math.ceil(needed*10)/10)),scale=Math.max(1,(duration-LEAD-TAIL-GAP*(lines.length-1))/(needed-LEAD-TAIL-GAP*(lines.length-1)));
 let t=LEAD;
 const captions=lines.map((text,i)=>{const c={start:round(t),duration:round(base[i]*scale),text};t+=base[i]*scale+GAP;return c;});
 // Keep the last caption inside the slide even after rounding or the 60s cap.
 const last=captions[captions.length-1];last.duration=round(Math.max(.1,Math.min(last.duration,duration-last.start)));
 return{captions,duration};
}
/** Changes a slide's length, keeping elements and captions inside it. */
export function withDuration(s:Slide,duration:number):Slide{
 const next={...s,duration};
 // Elements that leave near the end keep their distance from it, so exits still close the slide.
 if(s.elements)next.elements=s.elements.map(e=>{const start=Math.min(e.start,duration-.1),tail=s.duration-(e.start+e.duration),anchored=tail>-.01&&tail<=1.5;return{...e,start,duration:round(Math.max(.1,anchored?duration-Math.max(0,tail)-start:Math.min(e.duration,duration-start)))};});
 if(s.captions)next.captions=s.captions.filter(c=>c.start<duration-.05).map(c=>({...c,duration:round(Math.max(.1,Math.min(c.duration,duration-c.start)))}));
 return next;
}
