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
const count=(text:string)=>Array.from(text).length;
/** Puts an empty caption at `index` (0 = first), right after the one above it. Captions shown from then on move back and the slide grows by the added time. */
export function insertCaption(s:Slide,index:number):Slide{
 const captions=s.captions??[];
 if(captions.length>=MAX_CAPTIONS)throw new Error(`字幕は1スライド${MAX_CAPTIONS}個までです。`);
 const added=MIN+GAP,previous=captions[index-1];
 if(s.duration+added>60)throw new Error('字幕を足すと、このスライドが上限の60秒を超えます。ほかの字幕を短くするか減らしてください。');
 const start=round(previous?previous.start+previous.duration+GAP:Math.min(LEAD,captions[0]?.start??LEAD));
 const next=withDuration(s,round(s.duration+added));
 // Timing is set by hand here, so the list order need not be the order on screen: move by time, not by position.
 const later=(c:Caption)=>c.start>=start-.005?{...c,start:round(c.start+added)}:c;
 next.captions=[...captions.slice(0,index).map(later),{text:'',start,duration:MIN},...captions.slice(index).map(later)];
 return next;
}
/** Where to cut a caption: the cursor when it stands inside the text, else the punctuation nearest the middle, else the middle. */
function splitPoint(text:string,cursor?:number){
 const usable=(at:number)=>at>0&&at<text.length&&text.slice(0,at).trim()!==''&&text.slice(at).trim()!=='';
 if(cursor!==undefined&&usable(cursor))return cursor;
 const breaks=[...text.matchAll(/[、。！？!?，,．\n]+/g)].map(m=>m.index+m[0].length).filter(usable);
 if(breaks.length)return breaks.reduce((best,at)=>Math.abs(at-text.length/2)<Math.abs(best-text.length/2)?at:best);
 const chars=Array.from(text.trim());
 if(chars.length<2)throw new Error('1文字の字幕は分けられません。');
 // Counted from the end: searching for the second half would find an earlier copy of it ("わくわく").
 return text.trimEnd().length-chars.slice(Math.ceil(chars.length/2)).join('').length;
}
/** A caption's time as typed in the editor, kept inside the slide and to 1/100 s so 5.3 − 5.2 is not 0.0999…. */
export function fitCaption(c:Caption,slideDuration:number):Caption{
 const start=round(Math.max(0,Math.min(slideDuration-.1,c.start)));
 return{...c,start,duration:round(Math.max(.1,Math.min(c.duration,slideDuration-start)))};
}
/** Cuts one caption in two; each half gets a share of the time in proportion to its length. */
export function splitCaption(s:Slide,index:number,cursor?:number):Slide{
 const captions=s.captions??[],c=captions[index];
 if(captions.length>=MAX_CAPTIONS)throw new Error(`字幕は1スライド${MAX_CAPTIONS}個までです。`);
 const at=splitPoint(c.text,cursor),first=c.text.slice(0,at).trim(),second=c.text.slice(at).trim();
 if(c.duration<.2)throw new Error('表示時間が短すぎて分けられません。');
 const share=round(Math.max(.1,Math.min(c.duration-.1,c.duration*count(first)/(count(first)+count(second)))));
 return{...s,captions:[...captions.slice(0,index),{text:first,start:c.start,duration:share},{text:second,start:round(c.start+share),duration:round(c.duration-share)},...captions.slice(index+1)]};
}
/** Joins a caption with the one below it; the result is shown from where the earlier of the two starts to where the later one ends. */
export function mergeCaptions(s:Slide,index:number):Slide{
 const captions=s.captions??[],a=captions[index],b=captions[index+1];
 if(!b)throw new Error('下に字幕がありません。');
 const text=a.text+b.text;
 if(count(text)>MAX_CAPTION_LENGTH)throw new Error(`つなぐと${MAX_CAPTION_LENGTH}文字を超えます。先に文を短くしてください。`);
 const start=Math.min(a.start,b.start);
 return{...s,captions:[...captions.slice(0,index),{text,start,duration:round(Math.max(a.start+a.duration,b.start+b.duration)-start)},...captions.slice(index+2)]};
}
