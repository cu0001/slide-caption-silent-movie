import {useEffect,useState} from 'react';
import {FPS,type Slide} from './model';
import {timeCaptions,withDuration,captionTextError,overlappingCaptions,MAX_CAPTIONS,MAX_CAPTION_LENGTH,type Caption} from './captions';
// The only thing edited in the app: the selected slide's captions (text and timing). A new set of lines is timed at
// reading speed and lengthens the slide when needed.
export function CaptionEditor({slide,update,seek,disabled}:{slide:Slide;update:(patch:Partial<Slide>)=>void;seek:(frame:number)=>void;disabled:boolean}){
 const captions=slide.captions??[];
 const overlaps=overlappingCaptions(captions);
 const [error,setError]=useState('');
 const captionText=captions.map(c=>c.text).join('\n');
 const [draft,setDraft]=useState(captionText);
 // Text edits and deletions update the rewrite draft; timing edits keep an unfinished draft.
 useEffect(()=>{setDraft(captionText);},[captionText]);
 function create(){
  try {
  const {captions:next,duration}=timeCaptions(draft.split('\n'),slide.duration);
  update(duration>slide.duration?{...withDuration(slide,duration),captions:next}:{captions:next});
  setError('');
  } catch(e) {setError(e instanceof Error?e.message:String(e));}
 }
 function patch(i:number,p:Partial<Caption>){update({captions:captions.map((c,j)=>j===i?{...c,...p}:c)});}
 function confirm(c:Caption){
  const first=Math.ceil(c.start*FPS),last=Math.ceil((c.start+c.duration)*FPS)-1;
  const target=Math.round((c.start+Math.min(.3,c.duration/2))*FPS);
  seek(Math.min(last,Math.max(first,target)));
 }
 return <section className="caption-editor" aria-label="字幕の編集">
  {captions.map((c,i)=><div className="caption-item" key={i}>
   <label>字幕 {i+1}<textarea aria-label={`字幕の文 ${i+1}`} rows={2} aria-invalid={Boolean(captionTextError(c.text))} aria-describedby={captionTextError(c.text)?`caption-error-${i}`:undefined} maxLength={MAX_CAPTION_LENGTH} value={c.text} disabled={disabled} onChange={e=>patch(i,{text:e.target.value})}/></label>
   {captionTextError(c.text)&&<p id={`caption-error-${i}`} className="warning" role="alert">{captionTextError(c.text)}</p>}
   {overlaps.has(i)&&<p id={`caption-overlap-${i}`} className="warning" role="alert">ほかの字幕と表示時間が重なっています。開始時刻か表示秒数を調整してください。</p>}
   <div className="timing"><label>開始<input aria-label={`字幕の開始 ${i+1}`} aria-invalid={overlaps.has(i)} aria-describedby={overlaps.has(i)?`caption-overlap-${i}`:undefined} type="number" min={0} max={slide.duration-.1} step={.1} value={c.start} disabled={disabled} onChange={e=>{const start=Math.max(0,Math.min(slide.duration-.1,Number(e.target.value)));patch(i,{start,duration:Math.min(c.duration,slide.duration-start)});}}/>秒</label><label>表示<input aria-label={`字幕の秒数 ${i+1}`} aria-invalid={overlaps.has(i)} aria-describedby={overlaps.has(i)?`caption-overlap-${i}`:undefined} type="number" min={.1} max={slide.duration-c.start} step={.1} value={c.duration} disabled={disabled} onChange={e=>patch(i,{duration:Math.max(.1,Math.min(slide.duration-c.start,Number(e.target.value)))})}/>秒</label>
    <button className="link" disabled={disabled} onClick={()=>confirm(c)}>確認</button><button className="link" aria-label={`字幕を削除 ${i+1}`} disabled={disabled} onClick={()=>update({captions:captions.filter((_,j)=>j!==i)})}>削除</button></div>
  </div>)}
  {!captions.length&&<p className="hint">このスライドには字幕がありません。</p>}
  <details className="rewrite" open={!captions.length}>
   <summary>まとめて書き直す</summary>
   <p className="hint">1行に1つずつ入力すると、読む速さに合わせて時間を割り当てます。足りないときはスライドを伸ばします。</p>
   <textarea aria-label="字幕の一括入力" rows={5} value={draft} disabled={disabled} onChange={e=>setDraft(e.target.value)}/>
   {error&&<p className="warning" role="alert">{error}</p>}
   <div className="row"><button disabled={disabled||!draft.trim()} onClick={create}>字幕を作る（時間を自動で割り当て）</button>{captions.length>0&&<button disabled={disabled} onClick={()=>{update({captions:[]});setDraft('');}}>字幕をすべて外す</button>}</div>
  </details>
  {captions.length>=MAX_CAPTIONS&&<small>字幕は1スライド{MAX_CAPTIONS}個までです。</small>}
 </section>;
}
