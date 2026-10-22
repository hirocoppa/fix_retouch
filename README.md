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
2. フレームを取り込み、赤ブラシまたは四角で修正範囲を指定
3. 消去または文章での変更を選び、OpenAI画像編集APIを実行
4. 元画像と修正PNGを手動切替・パカパカ比較
5. 修正PNG、RUNWAY用・SwitchX用のプロンプトを個別またはまとめて保存
6. SwitchX用に白=維持・黒=編集領域の静止画PNGまたは全フレームマスクMP4を出力

## 技術上の注意

- AIへは赤い範囲の周囲を切り出して送り、生成結果を元サイズのフレームへ合成します。指定範囲外は元画像の画素を使用します。
- 現在のUIは**フレーム全体に赤い印を描き、バックエンド側で自動クロップする方式**です。要望されている「先に手動トリミングしてから赤線を描く」UIは今後の開発項目です。
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
