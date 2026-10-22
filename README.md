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
4. 消去または文章での変更を選び、OpenAI画像編集APIを実行
5. 元画像と修正PNGを手動切替・パカパカ比較
6. 修正PNG、RUNWAY用・SwitchX用のプロンプトを個別またはまとめて保存
7. SwitchX用に白=維持・黒=編集領域の静止画PNGまたは全フレームマスクMP4を出力

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
