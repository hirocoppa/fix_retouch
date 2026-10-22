## GitHub Pagesで無料公開（採用する方式）

1. GitHubの `hirocoppa/fix_retouch` → **Settings → General → Danger Zone → Change repository visibility** から **Public** に変更（コミット履歴も公開されます）。
2. **Settings → Pages → Build and deployment** で Source を **GitHub Actions** に設定。
3. **Actions** タブから **Deploy static app to GitHub Pages** を実行するか、`main` に更新を反映すると自動デプロイされます。
4. 公開に成功すると `https://hirocoppa.github.io/fix_retouch/` からアプリを開けます。公開完了まではこのURLは利用できません。

この方式では動画や画像はブラウザ内で処理し、ChatGPTとの画像受け渡しは手動です。**全フレームのSwitchXマスクMP4自動追跡はまだGitHub Pagesでは利用できません**（サーバー版のPython/FFmpegが必要）。静止マスクPNGと個別プロンプトは利用できます。認証なしのPublicサイトとなるので、アクセス制限はありません。

# fix_retouch

RUNWAY / SwitchX 向け動画レタッチ補助アプリです。元動画の1フレームからOpenAI画像編集による修正済みPNGを作り、RUNWAY用・SwitchX用の個別の英語プロンプトと、SwitchX用のフレーム追跡マスク動画（MP4）を出力します。

## インストール・起動

Node.js 20以上、Python 3、FFmpeg/ffprobe（libx264対応）、OpenCVが必要です。

```bash
npm install
python3 -m pip install -r requirements.txt
export OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
npm start
```

ブラウザで **http://localhost:3000** を開いてください。OpenAI APIの利用にはChatGPTの契約とは別の課金が発生します。APIキーはサーバーの環境変数のみで管理し、GitHubへコミットしないでください。

## 操作手順

1. 動画を読み込み、スライダーでフレームを選択
2. フレームを取り込んでマウスでトリミング範囲をドラッグし、「この範囲にトリミング」で確定\n3. **トリミング後の拡大画像上**で赤ブラシまたは赤い四角で修正箇所を指定
4. 消去または文章での変更を選び、赤印入りトリミングPNGとChatGPT用指示文をそれぞれコピー・保存\n5. ChatGPTの画面を開き、赤印画像と指示文を手動で渡して画像を修正\n6. ChatGPTから修正済み画像をダウンロードし、アプリのドロップ欄へドラッグ＆ドロップ（ファイル選択や画像の貼り付けも可）
7. 元画像と修正PNGを手動切替・パカパカ比較
8. 修正PNG、RUNWAY用・SwitchX用のプロンプトを個別またはまとめて保存
9. SwitchX用に白=維持・黒=編集領域の静止画PNGまたは全フレームマスクMP4を出力

## 技術上の注意

- AIへは赤い範囲の周囲を切り出して送り、生成結果を元サイズのフレームへ合成します。指定範囲外は元画像の画素を使用します。
- 現在のUIは**先に手動トリミングしてから赤い印を描く方式**です。AIへはそのトリミング画像と赤印から生成したマスクを送信し、結果を元フレームの同じ座標に合成します。SwitchXマスクも元解像度の白黒画像へ座標変換します。
- マスク動画はOpenCVの特徴点追跡で幾何学的に伝搬します。遮蔽、激しい動き、カメラ移動などでずれることがあります。警告件数を表示しますが、出力動画の全編を目視確認してください。
- マスク動画は元解像度・名目FPSで固定フレームレートに変換して出力します。VFR素材のタイムスタンプ完全一致や色調・AI修正領域の完全な一致は保証しません。
- 現段階では短い動画のローカルテスト向けで、最大3600フレーム、アップロード上限150MBです。大きな動画での本格運用に向けた最適化は未対応です。
- RUNWAYやSwitchXへの直接送信・動画自体のAI編集機能はありません。作ったファイルを手動で渡す設計です。
- フレーム追跡にはPython実行環境・FFmpegのインストールが必要です。

## フォルダ構成

- `public/index.html` — 操作画面
- `server.js` — Node/Expressバックエンド
- `track_mask.py` — OpenCV追跡、FFmpegマスク動画エンコード
- `package.json`, `requirements.txt` — 依存関係
- `.env.example` — 環境変数サンプル

## 開発ステータス

GitHubへのソース登録・読み戻し確認済み。今回登録した版を実動画・OpenAI APIで一通り動作検証する作業は未実施です。

## URLで開くWebアプリとして公開（Render）

このリポジトリの `Dockerfile` と `render.yaml` は、Node.js / Python / FFmpeg の実行環境をRenderで構築するための設定です。初回はRenderアカウントでのセットアップが必要です。

1. [Render](https://dashboard.render.com/select-repo?type=blueprint) にログインし、GitHubのプライベートリポジトリ `hirocoppa/fix_retouch` を接続する。
2. New → Blueprint からリポジトリを選び、`render.yaml` を適用する。
3. Renderの環境変数 `OPENAI_API_KEY` にOpenAI APIキー、`APP_ACCESS_PASSWORD` に推測されにくいパスワードを登録する（GitHubには書き込まない）。
4. Renderでデプロイに成功すると `https://<render-assigned-host>.onrender.com` のURLが発行される。URLを開くと認証ダイアログが出るので、ユーザー名には任意の文字（例: `user`）、パスワードには手順3のものを入力する。
5. GitHubの `main` の変更はRender側で自動デプロイされる設定です。

Renderの構成はFreeプラン（月額0円）です。OpenAI APIの画像編集には別途従量課金が発生するため、アプリの全機能を完全無料で使用することはできません。無料のまま使う場合はAI画像編集を実行せず、フレーム選択・手動マスク・プロンプト作成などの機能に限定してください。動画は150 MB以下を想定し、長時間動画の処理はサーバーのメモリ・タイムアウト制限で失敗する場合があります。本番運用にはジョブキュー・外部ストレージ導入が望まれます。

**GitHubへのコード登録だけでは公開URLは発行されません。Render側での初回接続・デプロイが必要です。**

## ChatGPT Plusを利用した手動画像編集

アプリ側では画像AIのAPIを呼び出さず、トリミング済みの赤印PNGと専用指示文を生成します。ChatGPTの画面に手動で渡して編集した画像を、ドラッグ＆ドロップ・ファイル選択・クリップボード貼り付けでアプリに戻せます。トリミング元の座標を保持し、赤印部分のみを元の解像度の画像へ合成します。ChatGPTによって出力サイズが変わった場合は、トリミングサイズにリサイズしてから合成するため、生成部分の画質・質感が一致するとは限りません。未指定部分は元のピクセルを保持します。

現在のサイトには開発用の /api/edit が残っていますが、通常の操作画面からは利用しません。完全無料のサイト公開を目指す場合、SwitchX用のサーバー側マスク追跡は別途ブラウザ内実装が必要です。

## 完全無料の静的Web版（Cloudflare Pages）

**代替案: Cloudflare Pages**。プライベートGitHubリポジトリを維持しつつ、Cloudflareの無料枠で静的Webアプリを公開できます。Render/Dockerサーバーの起動は不要です。

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) に無料アカウントでログインします。
2. **Workers & Pages → Create → Pages → Connect to Git** で GitHub の `hirocoppa/fix_retouch` を選びます。
3. Production branch: `main`。Framework preset: `None`。Build command: **空欄**。Build output directory: **`public`** とします。
4. 保存してデプロイすると `https://(プロジェクト名).pages.dev` のURLが表示されます。このURLで、動画の取り込み、トリミング、赤い印、ChatGPTへのコピー/保存と手動の画像戻し、元解像度合成、パカパカ比較、静止マスクPNG・両プロンプトの生成ができます。

重要: Web版の `/api/edit` は使用しません。ChatGPT Plusの画面で画像を手動編集し、結果をWeb版に戻します。Cloudflare Pages公開ではGitHubのコードはPrivateのままですが、発行されるWebサイト自体には別途アクセス制御を設定しない限り第三者がアクセスできるため、機密の映像素材の取り扱いに注意してください。静的Web版で動画ファイルを選んでもサーバーにはアップロードしません。

**未対応:** 全フレームの動体追跡マスクMP4生成。既存の実装はPython/FFmpegが必要なため、この無料静的Web版では使えません。表示されるボタンからは処理を呼び出さず、未対応メッセージを表示します。1枚の白黒マスクPNGは出力できます。

この設定をGitHubへ反映してもCloudflareアカウント側での初回接続は自動ではできません。初回接続後はGitHub更新の自動デプロイが可能です。

## ChatGPTへの画像2枚まとめ保存（2026-10-22）

手動トリミング後、赤い線または**塗りつぶさない赤い四角の枠線**で指示し、`ChatGPT用画像2枚をまとめて保存` を押します。保存するのは、赤印なしのトリミング画像と、赤印付きのトリミング画像の2枚のPNGです。ChatGPTに貼る指示文は従来のコピー操作を使います。赤い四角は指示画像の表示上は枠線のみですが、SwitchXマスクと戻し画像の合成では四角の**内側**が編集領域です。

Chrome/Edge対応のFile System Access APIを使い、初回は保存先フォルダを指定し、以降は同じフォルダに2枚を書き出します。フォルダハンドルはIndexedDBへ保存し、ページを閉じた後も再利用します。ブラウザやOSの仕様により再度アクセス許可を求める場合があります。別の場所へ保存したい場合は「保存先を変更」を押してください。Safariなど同API非対応ブラウザではフォルダ指定保存は利用できません。
