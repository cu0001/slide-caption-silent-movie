import { useEffect, useRef, useState } from 'react';
import { CanvasPlayer, type PlayerRef } from './CanvasPlayer';
import { Licenses } from './Licenses';
import { loadPcmWav } from './audio';
import { demo, FPS, totalFrames, frames, locate, validateProject, type Project, type Slide } from './model';
import { loadAssets, type Assets } from './render';
import { exportWebm, checkSupport } from './export';
import {CaptionEditor} from './CaptionEditor';
// The app shows a project the slide-caption-silent-movie skill made (motion, parts and captions are written by the AI assistant)
// and lets only the captions be corrected. Without ?sample= it opens the startup project the skill last set
// (public/examples/startup/); ?sample=demo keeps the built-in demo, the others open the coffee-break.pdf examples.
const samples={coffee:'coffee-break-captions',pdf:'coffee-pdf',elements:'coffee-elements',captions:'coffee-captions'} as const;
type Startup={source:string;file:string};
const requested=new URLSearchParams(window.location.search).get('sample');
const sampleKey:keyof typeof samples|'demo'|'start'=requested==='demo'||(requested??'') in samples?requested as keyof typeof samples|'demo':'start';
async function fetchStartup(){
  const r=await fetch('/examples/startup/startup.json');if(!r.ok)throw new Error('起動時のプロジェクトがありません。「開く」でプロジェクトを読み込んでください。');
  const info=await r.json() as Startup;
  const p=await fetch(`/examples/startup/${info.file}`);if(!p.ok)throw new Error('起動時のプロジェクトを読み込めません。');
  return {value:await p.json(),message:`${info.source} を開きました。字幕は右側で直せます。`};
}
async function fetchSample(key:keyof typeof samples){
  const r=await fetch(`/examples/${samples[key]}-project.json`);if(!r.ok)throw new Error('サンプルを読み込めません。');
  return {value:await r.json(),message:'サンプルを開きました。字幕は右側で直せます。'};
}
const readFile = (file: File) => new Promise<string>((resolve, reject) => {const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file);});
function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
async function embedProject(p: Project) {
  if (!p.audio || p.audio.src.startsWith('data:')) return p;
  const response = await fetch(p.audio.src); if (!response.ok) throw new Error('音声を保存できません。');
  const src = await readFile(new File([await response.blob()], 'audio.wav', {type:'audio/wav'}));
  return {...p, audio:{...p.audio, src}};
}
const clock=(seconds:number)=>`${Math.floor(seconds/60)}分${String(Math.round(seconds%60)).padStart(2,'0')}秒`;
export function App() {
  const [project, setProject] = useState<Project>(demo);
  const [projectSession, setProjectSession] = useState(0);
  const [selected, setSelected] = useState(0);
  const [assets, setAssets] = useState<Assets>(new Map());
  const [ready, setReady] = useState(false);
  const [opening, setOpening] = useState(sampleKey!=='demo');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('字幕は右側で直せます。');
  const [support, setSupport] = useState<string|null>(null);
  const [result, setResult] = useState<string | null>(null);
  const player = useRef<PlayerRef>(null);
  const cancel = useRef<AbortController | null>(null);
  // Only the latest open request may replace the project or report its result.
  const loadGeneration = useRef(0);
  const slide = project.slides[selected];
  const startOf=(index:number)=>project.slides.slice(0,index).reduce((n,s)=>n+frames(s),0);
  // Keep only this project's image load. Caption edits reuse the same promise and decoded images.
  const imageLoad = useRef<{sources:string[];promise:Promise<Assets>} | null>(null);
  useEffect(() => {
    let active = true;
    const sources = [...new Set(project.slides.flatMap(s=>[s.image,...(s.elements??[]).filter(e=>e.type==='image').map(e=>e.src)]).filter((s):s is string=>typeof s==='string'))].sort();
    const previous = imageLoad.current;
    if (!previous || sources.length !== previous.sources.length || sources.some((src,i)=>src!==previous.sources[i])) {
      setReady(false);
      imageLoad.current = {sources,promise:loadAssets(project)};
    }
    const loading = imageLoad.current!;
    loading.promise.then(a => {if (active) {setAssets(a); setReady(true);}}).catch(e => {
      if(active) {imageLoad.current=null; setMessage('画像の読み込みに失敗しました: ' + e.message);}
    });
    return () => {active = false;};
  }, [project]);
  useEffect(() => {let active=true; checkSupport(Boolean(project.audio)).then(() => {if(active) setSupport(null);}).catch(e => {if(active) setSupport(e.message);}); return()=>{active=false;};}, [Boolean(project.audio)]);
  useEffect(() => () => {if(result) URL.revokeObjectURL(result);}, [result]);
  useEffect(()=>{
    if(sampleKey==='demo')return;
    let active=true;
    const request=++loadGeneration.current;
    const current=()=>active&&request===loadGeneration.current;
    (sampleKey==='start'?fetchStartup():fetchSample(sampleKey)).then(({value,message})=>{
      if(current()){const opened=validateProject(value);openProject(opened);setMessage(message);}
    }).catch(e=>{if(current())setMessage(e.message);}).finally(()=>{if(current())setOpening(false);});
    return()=>{active=false;};
  },[]);
  function change(p: Project) {player.current?.pause(); setProject(p); setResult(null);}
  // Opening a file starts a fresh player and editor, even when it reuses the same slide IDs.
  function openProject(p: Project) {change(p);setSelected(0);setProjectSession(session=>session+1);}
  function update(patch: Partial<Slide>) {change({...project, slides:project.slides.map((s,i)=>i===selected?{...s,...patch}:s)});}
  function choose(index: number) {if(index<0||index>=project.slides.length)return;setSelected(index); player.current?.seekTo(startOf(index)+24);}
  // While playing or seeking, the slide list and the caption panel follow the slide on screen.
  const follow=(frame:number)=>{const index=locate(project,frame).index;setSelected(current=>current===index?current:index);};
  // ← / → (and PageUp / PageDown) move between slides, except while typing or on the seek bar.
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      const t=e.target as HTMLElement;if(busy||e.altKey||e.ctrlKey||e.metaKey||t.closest('input,textarea,select,[contenteditable]'))return;
      const step=e.key==='ArrowRight'||e.key==='PageDown'?1:e.key==='ArrowLeft'||e.key==='PageUp'?-1:0;
      if(step){e.preventDefault();choose(selected+step);}
    };
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  });
  const current=useRef<HTMLOListElement>(null);
  // Keep the selected slide visible by scrolling the list itself, never the page (the preview stays on screen).
  useEffect(()=>{
    const list=current.current,item=list?.querySelector<HTMLElement>('[aria-current=true]');if(!list||!item)return;
    const top=item.offsetTop,bottom=top+item.offsetHeight;// .slides is positioned, so offsetTop is inside the list
    if(top<list.scrollTop)list.scrollTop=top-4;else if(bottom>list.scrollTop+list.clientHeight)list.scrollTop=bottom-list.clientHeight+4;
  },[selected]);
  async function importProject(file?: File) {
    if (!file) return;
    const request=++loadGeneration.current;
    const current=()=>request===loadGeneration.current;
    if (file.size > 120*1024*1024) {setOpening(false);setMessage('プロジェクトは120MB以内で指定してください。'); return;}
    setOpening(true);
    try {
      const p = validateProject(JSON.parse(await file.text())); await loadAssets(p);
      if(!current())return;
      if (p.audio) {const context = new AudioContext(); try {await loadPcmWav(p.audio.src,context);} finally {await context.close();}}
      if(current()){openProject(p); setMessage('プロジェクトを開きました。');}
    } catch(e) {if(current())setMessage('読み込みできません: ' + (e instanceof Error?e.message:String(e)));}
    finally {if(current())setOpening(false);}
  }
  async function saveProject() {
    try {const p = validateProject(await embedProject(project)); download(new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),'video-project.json'); setMessage('字幕を含むプロジェクトを保存しました。');} catch(e) {setMessage('保存できません: ' + (e instanceof Error?e.message:String(e)));}
  }
  async function render() {
    player.current?.pause(); setBusy(true); setProgress(0); setResult(null); setMessage('動画を書き出しています。長い動画は数分かかります。');
    cancel.current = new AbortController();
    try {
      const snapshot = validateProject(await embedProject(project));
      const blob = await exportWebm(snapshot,setProgress,cancel.current.signal);
      setResult(URL.createObjectURL(blob)); download(blob,'video.webm'); setMessage('WebMを書き出しました。下の動画で確認できます。');
    } catch(e) {setMessage(e instanceof Error?e.message:String(e));}
    finally {setBusy(false); cancel.current = null;}
  }
  return <div className="app">
    <header>
      <div className="title"><span>スライド動画</span><h1>{project.name}</h1></div>
      <div className="actions">
        <label className="button">開く<input aria-label="プロジェクトを開く" type="file" accept=".json" disabled={busy} onChange={e=>{void importProject(e.target.files?.[0]);e.target.value='';}} /></label>
        <button onClick={saveProject} disabled={busy}>保存</button>
        <button className="primary" onClick={render} disabled={busy || !ready || opening || Boolean(support)}>{busy?`${Math.round(progress*100)}% 書き出し中`:'WebMを書き出す'}</button>
      </div>
    </header>
    <main>
      <section className="stage">
        <div className="preview"><CanvasPlayer key={projectSession} ref={player} project={project} assets={assets} ready={ready && !opening && !busy} onFrame={follow}/></div>
        <nav className="pager" aria-label="スライドの移動">
          <button aria-label="前のスライド" disabled={busy||selected===0} onClick={()=>choose(selected-1)}>‹ 前へ</button>
          <div className="pager-position"><strong>{selected+1}</strong><span> / {project.slides.length}枚</span><small>{clock(startOf(selected)/FPS)}〜 · {slide.duration.toFixed(1)}秒</small></div>
          <button aria-label="次のスライド" disabled={busy||selected===project.slides.length-1} onClick={()=>choose(selected+1)}>次へ ›</button>
        </nav>
        <p className="meta"><span>{ready&&!opening?'プレビュー準備完了':'素材を読み込み中…'}</span><span>← → キーでも移動できます · 全{project.slides.length}枚 · {clock(totalFrames(project)/FPS)}</span></p>
        <div className="status" role="status">{message}</div>
        {support&&<p className="warning">{support}</p>}
        {busy && <div className="render-progress"><progress max={1} value={progress}/><button onClick={()=>cancel.current?.abort()}>中止</button></div>}
        {result && <div className="output"><h2>書き出した動画</h2><video aria-label="書き出した動画" src={result} controls/><a href={result} download="video.webm">WebMをもう一度保存</a></div>}
        <ol ref={current} className="slides" aria-label="スライド一覧">{project.slides.map((s,i)=><li key={s.id}><button aria-label={`スライド ${i+1}`} aria-current={selected===i} disabled={busy} onClick={()=>choose(i)}>
          <span className="thumb" style={{background:s.color}}>{s.image && <img src={s.image} alt=""/>}</span>
          <span className="slide-label"><b>{i+1}</b>{s.captions?.length?`字幕 ${s.captions.length}`:'字幕なし'}</span>
        </button></li>)}</ol>
      </section>
      <aside>
        <p className="aside-heading">スライド {selected+1} / {project.slides.length}<span>{slide.duration.toFixed(1)}秒</span></p>
        <CaptionEditor key={`${projectSession}:${slide.id}`} slide={slide} update={update} seek={frame=>player.current?.seekTo(startOf(selected)+frame)} disabled={busy}/>
      </aside>
    </main>
    <footer><Licenses /><span>素材はこのブラウザ内で処理します</span></footer>
  </div>;
}
