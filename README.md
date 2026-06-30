# めやすあっと

AT Protocol（Bluesky）のユーザー向けに、匿名・ワンボタンでテキストや画像を送信できる目安箱サービスです。

ユーザー（クリエイター）は自分専用の目安箱URLを持ち、誰でも匿名でメッセージを送ることができます。届いたメッセージに回答すると、OGP画像付きのカードとしてBluesky・X上でシェアでき、質問と回答のやり取りをそのまま投稿として完結できます。

## 主な機能

### 目安箱の作成・ログイン

- Blueskyのハンドルを使ってサインインするだけで、自分専用の目安箱ページが作成されます。
- パスワードなどの認証情報をアプリ側で保持することはなく、Bluesky（AT Protocol）のOAuth認証を利用します。

### メッセージの送信（匿名投稿）

- 訪問者は目安箱ページから、テキスト（最大1000文字）と画像（最大4枚）をログイン不要・匿名で送信できます。
- スパム対策としてCAPTCHA（Cloudflare Turnstile）による検証と、送信元IPごとの送信回数制限（同一クリエイター宛に1時間あたり5通まで）を設けています。

### 記名メッセージ

- ログイン中の送信者は「名入れメッセージ」を選択することで、匿名ではなく自分のアカウントを明かしてメッセージを送ることもできます。
- 記名メッセージを送ると、質問の内容が送信者自身のPDS（Personal Data Server）にもレコードとして記録され、AT Protocol上で参照可能な投稿として残ります。

### 受信箱（ダッシュボード）

- クリエイターは届いたメッセージを「未読」「既読」「回答済み」のタブで管理できます。
- メッセージの既読・未読の切り替えや削除、目安箱URLのコピーなどがダッシュボードから行えます。

### 通知（プロキシBot連携）

- 新着メッセージの通知を有効にしておくと、専用のプロキシBotがクリエイターへBluesky上でメンション付きの通知を投稿します。
- クリエイターはBotをフォローするだけで、自分のBlueskyアカウントの認証情報を渡すことなくリアルタイムの通知を受け取れます。

### 回答とBlueskyへのシェア

- クリエイターは届いたメッセージに対して回答を投稿できます。
- 回答すると、質問と回答の内容を表示するOGP画像付きのシェアモーダルが表示され、Bluesky・Xへワンクリックで投稿したり、リンクをコピーしたりできます。
- 回答の内容もクリエイターのPDSにレコードとして記録され、元の質問レコードと相互に参照し合う形で保存されます。

### OGP画像による見栄えのよいシェア

- メッセージごと・目安箱ごとに、質問文や送信者情報（記名メッセージの場合）、クリエイター情報を含む動的なOGP画像が自動生成されます。
- Bluesky・XなどでURLを共有した際に、リッチなプレビューカードとして表示されます。

### 設定

- 目安箱の表示名のカスタマイズ
- 新着メッセージ通知のON/OFF切り替え
- 表示言語の切り替え（日本語／英語）

## 技術スタック

- フロントエンド/バックエンド: [SvelteKit](https://svelte.dev/docs/kit)
- 認証・データ連携: AT Protocol（Bluesky OAuth、PDSへのレコード書き込み）
- インフラ: Cloudflare（Workers、R2、Turnstile 等）

## 開発

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

### Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
