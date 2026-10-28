# 詳しい使い方・コマンド・技術仕様

[はじめての方は README へ](../README.md)

このページは、コマンドを手動で実行する方や、開発・配布をする方向けの資料です。以下のコマンドは、プロジェクト直下のフォルダーで実行してください。

ブラウザで見るスライド動画のツールです。PDFはAIアシスタント（slide-caption-silent-movie スキル）がページごとに部品へ切り分けて動きと字幕を付け、PDF全体を1本の流れの動画にします。アプリではプレビューと字幕の修正をして、**WebM（VP8映像、音声がある場合はOpus音声）** で書き出します。無音で見られる字幕付きの動画を主な用途にしています。

MPEG系のコーデック（MP4・H.264・AAC・MP3など）は使いません。Remotion / HyperFrames / FFmpeg / ffmpeg.wasmも使わず、プレビューは独自実装のCanvasプレーヤーです。

## 前提条件

### 使うだけの場合

| 必要なもの | バージョン・条件 | 用途 |
|---|---|---|
| Google Chrome | 最新版（WebCodecsでVP8/Opusをエンコードできること） | 編集・プレビュー・WebM書き出し |
| Node.js | 22.13以降または24系（Vite 8の条件は 20.19以降 / 22.12以降） | 開発サーバーの起動・ビルド |
| npm | Node.jsに付属するもの（動作確認は11.19） | 依存パッケージのインストール |

`npm run build` で作った `dist/` を静的HTTPサーバーに置く場合、利用者に必要なのはChromeだけです。HTTPSまたはlocalhostで開いてください。インターネット接続やAIサービス、APIキーは不要です。

### 開発・テスト・サンプル再生成をする場合

| 必要なもの | バージョン・条件 | 用途 |
|---|---|---|
| Google Chrome（インストール済みのもの） | 最新版 | `npm test`（Playwrightが `channel: 'chrome'` で使用） |
| Python | 3系（動作確認は3.14、標準ライブラリのみ） | `scripts/*.py` によるサンプル・デモ音声の再生成 |

### AIアシスタントで字幕を作る場合

| 必要なもの | 条件 | 用途 |
|---|---|---|
| 画像を読めるAIアシスタント | Claude Codeなど、ローカルのファイル読み取りとコマンド実行ができるもの | スライドの静止画と文字を見て字幕を書く |
| Google Chrome・Node.js・npmのモジュール | 上と同じ | `pdf:project`・`captions:export`・`video:export`（アプリの処理をChromeで実行）、`captions:apply`（字幕の書き込み。Node.jsの型除去機能を使用） |

### npmで入るモジュール

`npm ci` で `package-lock.json` どおりに入ります。バージョンは固定しています。

| パッケージ | バージョン | ライセンス | 用途 |
|---|---|---|---|
| react / react-dom | 19.2.0 | MIT | 画面 |
| mediabunny | 1.62.1 | MPL-2.0 | WebMの組み立て（VP8/Opus） |
| pdfjs-dist | 6.4.299 | Apache-2.0 | PDFの読み込み（ページの画像化） |
| pdf-lib | 1.17.1 | MIT | PDFの保存 |
| vite | 8.3.5 | MIT | 開発サーバー・ビルド（開発用） |
| typescript | 5.9.3 | Apache-2.0 | 型チェック（開発用） |
| @playwright/test | 1.56.1 | Apache-2.0 | ブラウザテスト（開発用） |
| @types/react / @types/react-dom | 19.2.2 | MIT | 型定義（開発用） |

FFmpeg、Remotion、HyperFrames、動画用のWASMエンコーダーは使いません。`npm run dev` と `npm run build` の前に依存関係の監査が自動で走り、これらが混入すると停止します。

## 起動

```sh
npm ci
npm run dev
```

起動すると、いつも使っているブラウザでアプリが自動で開きます（開かないときは、表示されたlocalhostのアドレスを開いてください）。HTTPSまたはlocalhostが必要です。最初は、slide-caption-silent-movie スキルで最後に作ったプロジェクト（`public/examples/startup/`）が開きます。スキルで新しく作るたびに `npm run startup:set` で置き換わります。このフォルダには利用者のPDFのページ画像が入るので、Gitには含めず（`.gitignore`）、`npm run build` の `dist/` からも取り除きます。まだ作っていないときは「開く」でプロジェクトを読み込んでください。以前の起動時サンプル（`coffee-break.pdf`、29.8秒）は `/?sample=coffee` で、組み込みデモ（音声付き）は `/?sample=demo` で開けます。エンコード非対応時は理由を表示して書き出しを止め、別コーデックへ切り替えません。

## ユーザーテスト（はじめての方へ）

まず動きを確かめたい方は、[user-test/](../user-test/README.md) の手順で試せます。テスト用のPDF `user-test/coffee-break.pdf`（3ページ）をAIアシスタントに渡すと、字幕とカメラの動きが付いた無音の動画が `output/coffee-break/` にできます。

```text
/slide-caption-silent-movie user-test/coffee-break.pdf
```

手順書には、確認すること（字幕の内容・読みやすさ、ページごとの動きの違い、音声が無いことなど）と、アプリで読み込んで手直しする方法、結果の記録の書き方をまとめています。

## 画面でできること

画面は、プレビュー・スライドの一覧・選んだスライドの字幕欄だけのシンプルな作りです。

1. 直したいスライドへ移ります。プレビューの下の「前へ」「次へ」、←→キー（入力欄の外で）、スライドの一覧、再生バーのどれでも移れます。いま何枚目か・何分何秒からかはプレビューの下に表示され、再生バーの細い線がスライドの区切りです。再生中は一覧と字幕欄が今のスライドについていきます。
2. 右側で字幕の文・開始・表示秒数を直します。「確認」でその字幕の場面を表示します。「まとめて書き直す」に1行1つずつ入力すると、読む速さに合わせて時間を割り当て直します。
3. 「保存」で字幕を含むプロジェクトJSONを保存し、「WebMを書き出す」で動画にします。保存したJSONは「開く」で読み込めます。

スライドの追加・削除・並べ替え、タイトル・画像・音声・カメラや要素の動きは画面では変えません。動きや切り分けを直したいときはAIアシスタントに頼みます。自動保存はありません。

## 要素ごとのアニメーション

「要素ごとに動かす」スライドでは、文字・画像・図形がそれぞれ独立した要素として動きます。このスライドはAIアシスタントが作ります（PDFのページを部品に切り分けて動きを付けます。「AIアシスタントに作ってもらう」を参照）。アプリには要素の一覧や動きを調整する欄はありません。

動きを直したいときは、Claude Codeで「8枚目の共有金庫室をもっとゆっくり登場させて」「1枚目の見出しを先に出して」のように、スライドの番号と画面に見えているもので頼みます。アシスタントが要素を探して `npm run elements:tune` で値を書き換えます。1スライド40要素までです。

動きは3段階あります。

- 登場の動き: ふわっと表示・上下左右から跳ねて登場・弾むように登場・ゼロから拡大・回転しながら登場・上から落ちてバウンド・ぼかしから現れる・ゆらぐ・左から描き出す・1行ずつ表示・1文字ずつ跳ねる
- 表示中の動き: 上下にただよう・鼓動する・左右にゆれる・ゆっくり寄る・回り続ける
- 退場の動き: フェードアウト・上下左右へ飛ぶ・縮んで消える・回転して消える・ぼけて消える（秒数指定可）

登場はRemotionの `spring()` と同じ考え方の減衰ばねで、行き過ぎを数%に抑えた落ち着いた動きで止まります（「上から落ちてバウンド」だけ少し弾みます）。ばねは解析解で計算するため、同じフレームは常に同じ絵になります。動画の全フレームは要素ごとの設定と時間から描画し、プレビューと書き出しで同じ処理を使います。

`/?sample=elements` で要素別のコーヒーサンプルを開けます。`public/examples/coffee-elements-project.json`（`npm run samples:prepare` または `npm test` で生成。Gitには含めません）が編集用データです。完成動画 `coffee-elements.webm` は `npm test` で `examples/element-motion/` に作られます。サンプルは基本サンプルの文字とSVGを部品ごとに再構成したものです。生成手順は `scripts/generate-element-sample.py` にあります。

この機能はPDFの編集構造を完全に自動復元するものではありません。部品は色を手がかりに画像として切り出すので、PDFに焼き込まれた文字・図は画像のまま動きます（文字を打ち直すことはしません）。

## 字幕（無音の動画向け）

音を出さずに見られる動画のために、各スライドの下部に字幕を表示できます。字幕はすべての表示方法（文字と画像・PDFページ・要素ごと）で使え、プレビューと書き出しで同じ処理で描画します。PDFページに字幕を付けた場合は、補足字幕の帯の代わりに字幕を表示します。字幕は手動改行を含め12行以内で入力してください。画面内に収まるよう文字サイズを調整します。表示時間がほかの字幕と重なる場合は警告を表示し、開始・秒数を修正するまで保存・書き出しを止めます。

### 画面で作る

右側の字幕欄で、1つずつ文・開始・秒数を直せます。「まとめて書き直す」に1行1つずつ入力して「字幕を作る（時間を自動で割り当て）」を押すと、読む速さ（毎秒6文字）で表示時間を割り当て、足りない場合はスライドの表示時間を伸ばします。スライドのほうが長いときは、字幕をスライド全体に広げます。1スライド20個、1個120文字までです。上限を超える入力や、表示に60秒を超える字幕は、元の字幕を変更せずエラーを表示します。空欄の字幕は文を入力するか削除してください。不正な状態では保存・動画書き出しができません。

### AIアシスタントに作ってもらう

Claude CodeなどのAIアシスタントが、スライドを画像と文字で確認し、PDFページを部品（見出し・本文・イラストの中の物など）に切り分けて部品ごとの動きを付け、説明の字幕を書きます。写真が主役のページなど部品に分けにくいページは、カメラの動き（種類・強さ・寄る場所）を選びます。PDFを渡せば、プロジェクト作成から字幕入りの動画書き出しまでをアプリを開かずに行えます。アプリにAPIキーは不要です。手順はプロジェクト内のスキル [.claude/skills/slide-caption-silent-movie/SKILL.md](../.claude/skills/slide-caption-silent-movie/SKILL.md) にまとめてあり、Claude Codeでこのフォルダを開いて「`資料.pdf` に字幕を付けて動画にして」のように頼むと使われます。

アシスタントが実行するコマンドは次のとおりです（手で実行することもできます）。どれもアプリと同じ処理を、手元のGoogle Chromeで動かします。

```sh
npm run pdf:project -- 資料.pdf output/資料/project.json                    # PDFの各ページを全画面スライドに
npm run captions:export -- output/資料/project.json output/資料/work         # スライドの静止画と文字を書き出す
# AIアシスタントが work/*.png・slides.json・元のPDFを見て work/elements.json（部品の位置・背景の色・動き）を書く
npm run elements:build -- output/資料/project.json output/資料/work/elements.json output/資料/elements-project.json --check output/資料/work/check
# AIアシスタントが work/check/ の確認画像を見て直し、work/captions.json を書く
npm run captions:apply -- output/資料/elements-project.json output/資料/work/captions.json output/資料/資料-captions.json
npm run video:export -- output/資料/資料-captions.json output/資料/資料-captions.webm  # WebMを書き出す
```

- `pdf:project`: PDFの取り込み（40MB・60ページ以内、パスワードなし）。ページ数が多くてもパートに分けず、1つのプロジェクトにします。`--seconds 5` で1ページの秒数、`--motion none` などでカメラの動きを指定できます。
- `captions:export`: PDFページはカメラの動きなしでページ全体を、要素ごとのスライドは全要素が出そろった瞬間を写します。字幕は描きません。寄る場所を読み取るための10%刻みの方眼つき画像（`-grid.png`）も書き出します。
- `elements:build`: PDFページを部品に切り分けて「要素ごとに動かす」スライドにします。`elements.json` の形式は `{"slides":[{"id":"<スライドID>","parts":[{"name":"カップ","box":[0.65,0.4,0.94,0.73],"key":["#e7d6b8"],"animation":"pop","start":0.6,"loop":"sway"}]}]}` です。`box` は部品を囲む四角（画面に対する0〜1）、`key` は部品の後ろの面の色で、この色に近い画素を透明にして物の形だけを動かします。部品を抜いた跡は近くの面の色で埋めるので、部品が登場する前も自然な画面になります。全部品が出そろった画面と元のページとの差を表示し、`--check` で登場途中の4コマ（`steps-01.png`…）と部品を抜いた背景（`bg-01.png`…）を書き出します。載っていないページはカメラの動きのまま残ります。色で切り分けるため、単色や数色の平らな面の上の物に向いています（写真やグラデーションの上の物は分けられません）。
- `elements:tune`: 「要素ごとに動かす」スライドの、名前を指定した要素の動きだけを変えます。形式は `{"slides":[{"index":2,"parts":{"太陽":{"enter":1.2},"見出し":{"start":0.6}}}]}` です。変えられるのは `animation`・`start`・`enter`・`distance`・`loop`・`exit`・`exitDuration` で、要素ごとに「前の値 → 新しい値」を表示します。
- `captions:apply`: `captions.json` の形式は `{"slides":[{"id":"<スライドID>","captions":["一文目。","二文目。"],"motion":{"type":"zoom-in","amount":0.6,"focusX":0.72,"focusY":0.45}}]}`（`id` の代わりに1から数える `index` も可。`captions` と `motion` はどちらも省略可）。`motion` はPDFページのカメラの動きで、AIアシスタントがページの内容を見て種類・強さ・寄る場所を選びます。時間は画面と同じ規則で割り当て、字幕で伸びたスライドでは終わり際に退場する要素も終わりに合わせて移動します。
- `video:export`: 「WebMを書き出す」と同じ書き出し。音声のないプロジェクトは音声トラックなしになります。10分を超える動画（100MB前後）も、少しずつ取り出してファイルに書きます。
- `startup:set`: 字幕入りのプロジェクト1つを、アプリの起動時に開くプロジェクトにします（`public/examples/startup/project.json`。Gitと `dist/` には含めません）。
- `colors`: スライド画像の指定した位置の色を読みます（`npm run colors -- <project.json> 1 0.3,0.5 0.62,0.2`）。`elements.json` の `key` の色を決めるのに使います。画像はChromeで読みます。
- `video:check`: 書き出したWebMをアプリと同じMediabunnyで読み、長さ・大きさ・映像と音声の形式を表示し、途中の2コマをPNGに書き出します（`npm run video:check -- <video.webm> [コマの出力先]`）。FFmpeg/ffprobeは使いません。

出力したJSONはアプリの「開く」で読み込み、字幕を手直しできます。`output/` と `captions-work/` は作業用で、Gitには含めません。

`/?sample=captions` で、AIアシスタントが3枚のスライドを見て字幕を書いた無音のサンプル（28.5秒）を開けます。編集用データは `public/examples/coffee-captions-project.json`（`npm run samples:prepare` または `npm test` で生成）にあり、完成動画は `npm test` で `examples/captions/` に作られます。

## PDFとカメラの動き

PDFは `npm run pdf:project`（AIアシスタントが実行）で各ページを画像化し、全画面のスライドにします。40MB・60ページ以内、パスワードなしのPDFが対象です。素材を外部サーバーへ送りません。

部品に分けにくいページは、ページ全体をカメラで見せます（「大きく寄る」「全体へ引く」「右へ移動」「左へ移動」「静止」、強さ、注目位置。最大1.7倍）。どの動きにするかはAIアシスタントが `captions.json` の `motion` で決めます。

`/?sample=pdf` でPDFサンプルを開けます。試すPDFには `user-test/coffee-break.pdf` を使えます。

## 音声入力

非圧縮RIFF WAV（PCM 8/16/24/32bit またはIEEE float 32/64bit、1〜2ch、8〜192kHz、30MB・10分以内）のみです。独自のWAV読取処理を使い、圧縮音声のデコーダーを呼び出しません。拡張子やMIMEを偽装しても、MP3・AAC・圧縮WAV・未対応subtypeは拒否します。MP3/AAC入りのプロジェクトは読み込めないため、音声を非圧縮WAVに置き換えてください。

## 映像・出力

- 1280×720、30fps。VP8 約4Mbps、Opus 128kbps/48kHz/2ch。
- 1〜60枚、各1〜60秒、全体60分以内。20分を超える動画も1本で保存・書き出しできます。音声開始位置は30fpsへ丸めます。
- 音声は動画長で切り、前後を無音にします。Opusのエンコーダー遅延・端数パディングには環境差があります。
- 音声は5秒ずつ処理し、動画は8MBのチャンクとBlobで保持します。動画全体の連続したArrayBufferや、動画全長分の非圧縮音声は確保しません。完成動画と素材を保持する容量は必要で、長時間の書き出し速度や完走可否は端末のメモリ・空き容量によって異なります。入力WAVの上限（30MB・10分）は従来どおりで、音声が終わった後は無音になります。

## ライセンスへの対応

独自コードと独自デモ素材はMIT、React系はMIT、MediabunnyはMPL-2.0です。フッターの「ライセンス・使用条件」から原文、依存関係一覧、公開元、同梱したMPL対象ソース、コーデック方針を確認できます。Mediabunnyのソースを改変していません。`npm run build` の成果物には、必要な原文と対応ソースを一緒に入れます。`dist/` を配布するときは `dist/licenses/` も保持してください。

[第三者ライセンス](../THIRD_PARTY_NOTICES.md)、[利用方針と一次資料](CODEC_POLICY.md)を参照してください。

これはコーデックの利用方針とソフトウェアライセンス上の配布対応です。すべての第三者特許の不存在や、特定組織の規則への適合を保証しません。ブラウザ/OS内部の実装を変えず、ブラウザ自体のFFmpegコード不存在も保証しません。ユーザーのPDF・画像・音声等の権利は別途必要です。

## 検証・配布

```sh
npm run audit:dependencies
npm run build
npm test
```

監査はFFmpeg/Remotion/HyperFrames、動画用WASM、未確認ライセンスの混入を検出すると失敗します。

`npm test` は必要なサンプルを実行前に自動生成し、専用ポート5187のサーバーを起動します。個別のテストも、ほかのテストの出力に依存せず実行できます。サンプルをアプリや配布物に含めたい場合は、先に `npm run samples:prepare` を実行してください（ChromeとPython 3が必要です）。利用者の `public/examples/startup/` はサンプル生成では変更しません。

`npm test` は確認のため、完成動画・PDF・スクリーンショット・確認用JSONを `examples/` と `docs/` に書き出します。これらは成果物なのでGitには含めません（`.gitignore` で除外）。必要なときは `npm test` で作り直してください。テストはインストール済みChromeを使い、WebMの実際のVP8/Opusトラック、全360フレーム、映像の照合、音声開始・音量、プレビューの再生/停止/シーク、WAV入力検査、保存・再読込、非対応環境での停止、中止、ライセンス原文・対応ソースの提供を確認します。

`npm run build` で作った `dist/` を、そのまま静的HTTPサーバーで提供できます。`public/licenses/` は開発サーバー用にも自動生成されます。

## 主要ファイル

- `src/render.ts`: プレビュー/書き出し共通のフレーム描画。
- `src/captions.ts`: 字幕の時間割り当てとスライド長の変更（アプリと `captions:apply` で共用）。
- `scripts/pdf-project.mjs` / `captions-export.mjs` / `elements-build.mjs` / `elements-tune.mjs` / `captions-apply.mjs` / `video-export.mjs` / `pixel-colors.mjs` / `video-check.mjs`: AIアシスタント用のコマンド（PDF取り込み・静止画書き出し・部品への切り分け・動きの修正・字幕の書き込み・WebM書き出し・色の読み取り・動画の確認）。`app-session.mjs` がアプリの処理をChromeで動かします。部品への切り分けは `src/split.ts` です。
- `src/CanvasPlayer.tsx`: 独自プレーヤー。CanvasとWeb Audioの共通時計。
- `src/audio.ts`: 圧縮コーデックを使わないWAV入力。
- `src/export.ts`: VP8/Opusのみを指定したWebM生成。
- `src/Licenses.tsx`: 使用条件・原文・対応ソースへの案内。
- `scripts/audit-dependencies.mjs`: パッケージとライセンスの監査。
- `scripts/copy-notices.mjs`: ライセンス原文とMPL対象ソースの同梱。

PDF.js 6.4.299（Apache-2.0）とpdf-lib 1.17.1（MIT）を使っています。PDF.jsは `useWasm:false` で読み込み、worker・文字マップ・JS画像デコーダーだけを配布します。npmパッケージ内の未使用PDF用WASM、Liberation等のフォントバイナリ、Node専用Canvasは静的配布物に含めません。対応する画像デコーダー/文字マップのライセンス原文も同梱しています。
