import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// The AI-assistant workflow runs from the command line: PDF → project → stills → captions → WebM.
test('PDF becomes a captioned silent WebM through the command-line workflow',async()=>{
 test.setTimeout(240000);
 const dir=mkdtempSync(join(tmpdir(),'slide-caption-silent-movie-cli-')),run=(script:string,...args:string[])=>execFileSync('npm',['run','--silent',script,'--',...args],{encoding:'utf8'});
 run('pdf:project','user-test/coffee-break.pdf',join(dir,'project.json'),'--seconds','5','--motion','none');
 const project=JSON.parse(readFileSync(join(dir,'project.json'),'utf8'));
 expect(project.slides).toHaveLength(3);expect(project.audio).toBeNull();
 expect(project.slides.every((s:any)=>s.layout==='page'&&s.duration===5&&s.motion==='none'&&s.image.startsWith('data:image/jpeg'))).toBe(true);
 run('captions:export',join(dir,'project.json'),join(dir,'work'));
 for(const n of ['01','02','03'])for(const f of [`slide-${n}.png`,`slide-${n}-grid.png`])expect(readFileSync(join(dir,'work',f)).subarray(1,4).toString()).toBe('PNG');
 const slides=JSON.parse(readFileSync(join(dir,'work','slides.json'),'utf8')).slides;expect(slides.map((s:any)=>s.id)).toEqual(project.slides.map((s:any)=>s.id));
 expect(slides[0].motion).toEqual({type:'none',amount:.85,focusX:.65,focusY:.5});
 writeFileSync(join(dir,'work','captions.json'),JSON.stringify({slides:[{index:1,captions:['一杯のコーヒーから、小さな休憩が始まります。','湯気の立つカップが、ひと息つく合図です。'],motion:{type:'zoom-in',amount:.5,focusX:.75,focusY:.45}},{index:2,motion:{type:'pan-right',amount:.3,focusY:.4}},{id:slides[2].id,captions:['机の上には、書きかけのメモとコーヒー。']}]}));
 const report=run('captions:apply',join(dir,'project.json'),join(dir,'work','captions.json'),join(dir,'captioned.json'));
 expect(report).toContain('スライド 1: 字幕 2個、表示時間 5秒 →');expect(report).toContain('動き 大きく寄る（強さ50%・注目 横75% 縦45%）');expect(report).toContain('スライド 2: 動き 右へ移動');
 const captioned=JSON.parse(readFileSync(join(dir,'captioned.json'),'utf8'));
 expect(captioned.slides[0].captions).toHaveLength(2);expect(captioned.slides[0].duration).toBeGreaterThan(5);
 expect(captioned.slides[0]).toMatchObject({motion:'zoom-in',motionAmount:.5,focusX:.75,focusY:.45});
 expect(captioned.slides[1]).toMatchObject({motion:'pan-right',motionAmount:.3,focusX:.65,focusY:.4,duration:5});expect(captioned.slides[2].motion).toBe('none');
 expect(captioned.slides[1].captions).toBeUndefined();expect(captioned.slides[2].captions).toHaveLength(1);
 writeFileSync(join(dir,'work','bad.json'),JSON.stringify({slides:[{index:1,motion:{type:'spin',focusX:2}}]}));
 expect(()=>execFileSync('npm',['run','--silent','captions:apply','--',join(dir,'project.json'),join(dir,'work','bad.json'),join(dir,'bad-out.json')],{stdio:'pipe'})).toThrow(/motion.type/);
 expect(existsSync(join(dir,'bad-out.json'))).toBe(false);
 run('video:export',join(dir,'captioned.json'),join(dir,'out.webm'));
 const webm=readFileSync(join(dir,'out.webm'));
 expect(webm.subarray(0,4).toString('hex')).toBe('1a45dfa3');expect(webm.includes('V_VP8')).toBe(true);expect(webm.includes('A_OPUS')).toBe(false);
 expect(existsSync(join(dir,'project.json'))).toBe(true);
});
// The whole PDF is one project that the app opens at startup; more than one project is refused.
test('startup project is a single project, validated before the folder is replaced',async()=>{
 // The startup folder is not in Git (it holds the user's PDF pages), so it may be missing in a fresh checkout.
 const startup='public/examples/startup',had=existsSync(join(startup,'startup.json'));
 const before=had?readFileSync(join(startup,'startup.json'),'utf8'):undefined,saved=had?readFileSync(join(startup,'project.json')):undefined;
 const dir=mkdtempSync(join(tmpdir(),'slide-caption-silent-movie-startup-'));
 writeFileSync(join(dir,'bad.json'),JSON.stringify({version:1,name:'x',slides:[],audio:null}));
 expect(()=>execFileSync('npm',['run','--silent','startup:set','--',join(dir,'bad.json')],{stdio:'pipe'})).toThrow();
 expect(()=>execFileSync('npm',['run','--silent','startup:set','--','tests/fixtures/coffee-break-project.json','tests/fixtures/coffee-break-project.json'],{stdio:'pipe'})).toThrow(/1つ/);
 expect(had?readFileSync(join(startup,'startup.json'),'utf8'):existsSync(join(startup,'startup.json'))).toBe(had?before:false);
 try{
  const report=execFileSync('npm',['run','--silent','startup:set','--','tests/fixtures/coffee-break-project.json','--source','coffee.pdf'],{encoding:'utf8'});
  expect(report).toContain('起動時: ひと息のコーヒー時間（3枚・12秒）');
  expect(JSON.parse(readFileSync(join(startup,'startup.json'),'utf8'))).toMatchObject({source:'coffee.pdf',file:'project.json',slides:3});
 }finally{if(had){writeFileSync(join(startup,'startup.json'),before!);writeFileSync(join(startup,'project.json'),saved!);}else rmSync(startup,{recursive:true,force:true});}
});
// PDF pages are split into parts that move on their own; once they have all arrived the page looks as it did.
test('PDF page is split into separately animated parts with a check report',async()=>{
 test.setTimeout(240000);
 const dir=mkdtempSync(join(tmpdir(),'slide-caption-silent-movie-parts-')),run=(script:string,...args:string[])=>execFileSync('npm',['run','--silent',script,'--',...args],{encoding:'utf8'});
 run('pdf:project','user-test/coffee-break.pdf',join(dir,'project.json'));
 const plan={slides:[{index:1,background:{animation:'none'},parts:[
  {name:'イラストの台紙',box:[.59,.075,.955,.925],key:['#10272d'],animation:'zoom',start:0,enter:.8},
  {name:'夕日',box:[.745,.105,.948,.5],key:['#e7d6b8'],animation:'zoom',start:.3,loop:'pulse'},
  {name:'コーヒーカップ',box:[.645,.395,.94,.725],key:['#e7d6b8','#d69d68','#a8b395','#90a085'],animation:'pop',start:.6,loop:'sway'},
  {name:'湯気',box:[.69,.16,.83,.39],key:['#e7d6b8','#d69d68'],animation:'float',start:1.4,loop:'float'},
  {name:'見出し',box:[.045,.235,.45,.365],key:true,animation:'slide-up',start:.3,distance:60},
 ]}]};
 writeFileSync(join(dir,'elements.json'),JSON.stringify(plan));
 const report=run('elements:build',join(dir,'project.json'),join(dir,'elements.json'),join(dir,'parts.json'),'--check',join(dir,'check'));
 const diff=Number(report.match(/スライド 1: 部品 5個＋背景、元のページとの差 ([\d.]+)%/)?.[1]);
 expect(diff).toBeLessThan(.3);expect(report).toContain('スライド 2: そのまま（PDFページ全体・カメラの動き）');expect(report).not.toContain('0.3%超');
 for(const f of ['bg-01.png','steps-01.png'])expect(readFileSync(join(dir,'check',f)).subarray(1,4).toString()).toBe('PNG');
 const parts=JSON.parse(readFileSync(join(dir,'parts.json'),'utf8')),original=JSON.parse(readFileSync(join(dir,'project.json'),'utf8'));
 const first=parts.slides[0];
 expect(first.layout).toBe('layers');expect(first.id).toBe(original.slides[0].id);expect(first.image).toBe(original.slides[0].image);
 expect(first.elements.map((e:any)=>e.name)).toEqual(['ページの背景','イラストの台紙','夕日','コーヒーカップ','湯気','見出し']);
 expect(first.elements.slice(1).every((e:any)=>e.type==='image'&&e.src.startsWith('data:image/png'))).toBe(true);
 expect(first.elements[3]).toMatchObject({animation:'pop',start:.6,loop:'sway',duration:3.4});
 expect(parts.slides[1]).toEqual(original.slides[1]);
 // Captions lengthen the slide and the parts stay until its end.
 writeFileSync(join(dir,'captions.json'),JSON.stringify({slides:[{index:1,captions:['湯気の立つカップが、ひと休みの始まりを告げます。','まずは手を止めて、香りに気づくところから。']}]}));
 run('captions:apply',join(dir,'parts.json'),join(dir,'captions.json'),join(dir,'captioned.json'));
 const captioned=JSON.parse(readFileSync(join(dir,'captioned.json'),'utf8')).slides[0];
 expect(captioned.duration).toBeGreaterThan(4);for(const e of captioned.elements)expect(e.start+e.duration).toBeCloseTo(captioned.duration,1);
 // Asked to change a part by name, only its motion changes; a part shown to the end still ends with the slide.
 writeFileSync(join(dir,'tune.json'),JSON.stringify({slides:[{index:1,parts:{'コーヒーカップ':{enter:1.2,start:.9,loop:'none'}}}]}));
 const tuneReport=run('elements:tune',join(dir,'captioned.json'),join(dir,'tune.json'),join(dir,'tuned.json'));
 expect(tuneReport).toContain('スライド 1「コーヒーカップ」: 登場の秒数 0.7 → 1.2、登場時刻 0.6 → 0.9、表示中の動き sway → none');
 const tuned=JSON.parse(readFileSync(join(dir,'tuned.json'),'utf8')).slides[0],cup=tuned.elements.find((e:any)=>e.name==='コーヒーカップ');
 expect(cup).toMatchObject({enter:1.2,start:.9,loop:'none',animation:'pop'});expect(cup.start+cup.duration).toBeCloseTo(tuned.duration,2);
 const {enter,start,loop,duration,...rest}=cup,{enter:_e,start:_s,loop:_l,duration:_d,...was}=captioned.elements.find((e:any)=>e.name==='コーヒーカップ');expect(rest).toEqual(was);
 expect(tuned.captions).toEqual(captioned.captions);expect(tuned.duration).toBe(captioned.duration);
 writeFileSync(join(dir,'bad-tune.json'),JSON.stringify({slides:[{index:1,parts:{'月':{enter:1}}}]}));
 expect(()=>execFileSync('npm',['run','--silent','elements:tune','--',join(dir,'captioned.json'),join(dir,'bad-tune.json'),join(dir,'bad-tuned.json')],{stdio:'pipe'})).toThrow(/要素「月」が見つかりません/);
 writeFileSync(join(dir,'bad-tune.json'),JSON.stringify({slides:[{index:1,parts:{'見出し':{x:10}}}]}));
 expect(()=>execFileSync('npm',['run','--silent','elements:tune','--',join(dir,'captioned.json'),join(dir,'bad-tune.json'),join(dir,'bad-tuned.json')],{stdio:'pipe'})).toThrow(/x は不可/);
 expect(existsSync(join(dir,'bad-tuned.json'))).toBe(false);
 // Text-only animations are refused for image parts, and nothing is written.
 writeFileSync(join(dir,'bad.json'),JSON.stringify({slides:[{index:1,parts:[{name:'見出し',box:[.1,.2,.5,.4],animation:'chars'}]}]}));
 expect(()=>execFileSync('npm',['run','--silent','elements:build','--',join(dir,'project.json'),join(dir,'bad.json'),join(dir,'bad-out.json')],{stdio:'pipe'})).toThrow(/lines・chars/);
 expect(existsSync(join(dir,'bad-out.json'))).toBe(false);
});
