export type QuestionCategory = {
	id: string;
	emoji: string;
	label: { ja: string; en: string };
	templates: { ja: string[]; en: string[] };
};

export const questionCategories: QuestionCategory[] = [
	{
		id: 'daily',
		emoji: '☀️',
		label: { ja: '日常', en: 'Daily' },
		templates: {
			ja: [
				'今日の朝ごはんは何を食べましたか？',
				'睡眠時間は平均してどのくらいですか？',
				'最近食べた美味しいものは何ですか？',
				'よく行くカフェで必ず頼むメニューはありますか？',
				'好きなラーメンの味（醤油、味噌、豚骨など）は何ですか？',
				'休日はインドア派ですか？アウトドア派ですか？',
				'水族館に行ったら一番見たい生き物は何ですか？',
				'犬派ですか？猫派ですか？',
				'毎日欠かさずやっているルーティンはありますか？',
				'好きな季節とその理由を教えてください。',
				'ストレス解消法は何かありますか？',
				'最近買ったもので一番良かったものは何ですか？',
				'部屋のインテリアや環境におけるこだわりポイントはありますか？',
				'好きなおにぎりの具は何ですか？',
				'スマホのホーム画面の壁紙は何にしていますか？',
				'よく使う絵文字を3つ教えてください。',
				'野球などのスポーツ観戦は好きですか？',
				'家で作業するときは何かBGMをかけますか？',
				'1日の中で一番好きな時間はいつですか？',
				'最近、思わず笑ってしまった出来事はありますか？'
			],
			en: [
				'What did you have for breakfast today?',
				'On average, how many hours do you sleep?',
				"What's something delicious you've eaten recently?",
				'Is there a go-to menu item you always order at your favorite cafe?',
				"What's your favorite ramen flavor (soy sauce, miso, tonkotsu, etc.)?",
				'Are you more of an indoor or outdoor person on your days off?',
				'If you went to an aquarium, what creature would you want to see most?',
				'Are you a dog person or a cat person?',
				'Is there a routine you do without fail every day?',
				"What's your favorite season and why?",
				'Do you have any go-to ways to relieve stress?',
				"What's the best thing you've bought recently?",
				"Do you have any particular preferences for your room's interior or setup?",
				"What's your favorite onigiri filling?",
				"What's your phone's home screen wallpaper?",
				'Name three emojis you use a lot.',
				'Do you enjoy watching sports like baseball?',
				'Do you play any BGM while working at home?',
				"What's your favorite time of day?",
				'Has anything made you laugh out loud recently?'
			]
		}
	},
	{
		id: 'entertainment',
		emoji: '🎬',
		label: { ja: 'エンタメ', en: 'Entertainment' },
		templates: {
			ja: [
				'好きな音楽のジャンルは何ですか？',
				'音楽はサブスクで聴きますか？CDなどを買いますか？',
				'人生で一番影響を受けたアニメは何ですか？',
				'最近見た映画やドラマで面白かったものは？',
				'シミュレーションゲームや経営ゲームは好きですか？',
				'何度も読み返している漫画はありますか？',
				'おすすめのアーティストやバンドを教えてください。',
				'ライブやフェスなどのイベントによく行きますか？',
				'カラオケで必ず歌う曲は何ですか？',
				'最近プレイして面白かったゲームは何ですか？',
				'好きな声優さんはいますか？',
				'小説と漫画、どちらを読むことが多いですか？',
				'好きな映画のジャンル（SF、ホラー、アクションなど）は何ですか？',
				'子供の頃に好きだったテレビ番組は何ですか？',
				'音楽を聴くとき、歌詞とメロディのどちらを重視しますか？',
				'好きなボードゲームやカードゲームはありますか？',
				'テーマパークで一番好きなアトラクションは何ですか？',
				'好きなYouTuberや配信者はいますか？',
				'今までで一番泣けた作品は何ですか？',
				'誰かに絶対おすすめしたいエンタメ作品を1つ教えてください。'
			],
			en: [
				"What's your favorite music genre?",
				'Do you listen to music on streaming services, or do you buy CDs?',
				'What anime has influenced you the most in your life?',
				"What's a movie or drama you watched recently that was good?",
				'Do you like simulation or management games?',
				'Is there a manga you keep rereading?',
				"Any artists or bands you'd recommend?",
				'Do you often go to live shows or festivals?',
				'What song do you always sing at karaoke?',
				"What's a game you played recently that was fun?",
				'Do you have a favorite voice actor?',
				'Do you read novels or manga more often?',
				"What's your favorite movie genre (sci-fi, horror, action, etc.)?",
				'What TV show did you like as a kid?',
				'When listening to music, do you focus more on the lyrics or the melody?',
				'Do you have a favorite board game or card game?',
				"What's your favorite ride at a theme park?",
				'Do you have a favorite YouTuber or streamer?',
				"What's the work that made you cry the most?",
				"What's one piece of entertainment you'd absolutely recommend to someone?"
			]
		}
	},
	{
		id: 'values',
		emoji: '💭',
		label: { ja: '価値観', en: 'Values' },
		templates: {
			ja: [
				'タイムマシンがあったら、過去と未来どちらに行きたいですか？',
				'100万円を今日中に使い切るなら何に使いますか？',
				'無人島に1つだけ持っていくなら何ですか？',
				'超能力が1つだけ使えるならどんな能力がいいですか？',
				'人生で一番の大きな決断は何でしたか？',
				'座右の銘や大切にしている言葉はありますか？',
				'自分を動物に例えると何だと思いますか？',
				'朝型ですか？夜型ですか？',
				'宝くじで高額当選したら仕事を辞めますか？',
				'宇宙人はいると思いますか？',
				'過去の自分にアドバイスできるとしたら何と言いますか？',
				'完璧な休日とはどんな1日ですか？',
				'これだけは絶対に譲れないというこだわりはありますか？',
				'失敗したとき、どうやって立ち直りますか？',
				'好きな言葉や名言はありますか？',
				'新しいことに挑戦するとき、慎重派ですか？直感派ですか？',
				'生まれ変わるならまた人間が良いですか？',
				'人生において一番大切だと思うものは何ですか？',
				'10年後の自分はどうなっていると思いますか？',
				'「自分らしさ」とは何だと思いますか？'
			],
			en: [
				'If you had a time machine, would you go to the past or the future?',
				'If you had to spend a million yen by the end of today, what would you spend it on?',
				'If you could only bring one thing to a deserted island, what would it be?',
				'If you could have one superpower, what would it be?',
				"What's the biggest decision you've made in your life?",
				'Do you have a motto or a phrase you cherish?',
				'If you compared yourself to an animal, what would it be?',
				'Are you a morning person or a night owl?',
				'If you won a huge lottery prize, would you quit your job?',
				'Do you believe aliens exist?',
				'If you could give advice to your past self, what would you say?',
				'What does a perfect day off look like for you?',
				"Is there something you absolutely won't compromise on?",
				'How do you bounce back after failing at something?',
				'Do you have a favorite quote or saying?',
				'When trying something new, are you cautious or do you go with your gut?',
				'If you were reincarnated, would you want to be human again?',
				'What do you think matters most in life?',
				"Where do you think you'll be in 10 years?",
				'What do you think "being yourself" really means?'
			]
		}
	},
	{
		id: 'oshi',
		emoji: '💖',
		label: { ja: '推し活', en: 'Fan Life' },
		templates: {
			ja: [
				'今一番熱中している「推し」は誰（何）ですか？',
				'推しを知ったきっかけは何ですか？',
				'推しの魅力を3つの言葉で表すと？',
				'推し活をしていて一番幸せを感じる瞬間はいつですか？',
				'グッズは保存用と使う用で複数買うタイプですか？',
				'推しに言われてみたいセリフはありますか？',
				'好きなVTuberはいますか？',
				'痛バッグを作ったり、推しカラーのものを集めたりしますか？',
				'推しのライブやイベントのために遠征したことはありますか？',
				'推し活を始めてから自分の中で変わったことはありますか？'
			],
			en: [
				'Who (or what) is your biggest "oshi" right now?',
				'What got you into your oshi in the first place?',
				"Describe your oshi's appeal in three words.",
				'When do you feel happiest while doing fan activities?',
				'Do you buy multiples of merch — one to keep, one to use?',
				"Is there a line you'd love to hear your oshi say to you?",
				'Do you have a favorite VTuber?',
				"Do you make itabags or collect things in your oshi's color?",
				"Have you ever traveled far for your oshi's live show or event?",
				'Has anything about you changed since you started your fan activities?'
			]
		}
	},
	{
		id: 'creative',
		emoji: '🎨',
		label: { ja: '創作', en: 'Creative' },
		templates: {
			ja: [
				'イラストを描く際、主線ありと主線なしのどちらが好きですか？',
				'創作のアイデア（お題など）はどこから得ることが多いですか？',
				'作品を完成させるまでに大体どれくらいの時間がかかりますか？',
				'スランプに陥ったときの脱出方法はありますか？',
				'創作活動を始めたきっかけは何ですか？',
				'好きな色や、作品でよく使う配色はありますか？',
				'デジタルツール（3Dモデリングなど）を使った表現に興味はありますか？',
				'二次創作と一次創作、どちらを描く（作る）ことが多いですか？',
				'作業環境（PC、タブレット、ソフトなど）を教えてください。',
				'自分の作品の中で一番気に入っているものを教えてください。'
			],
			en: [
				'When drawing illustrations, do you prefer with or without line art?',
				'Where do you usually get ideas or prompts for your creative work?',
				'About how long does it take you to finish a piece?',
				'Do you have a way to get out of a creative slump?',
				'What got you started with creating things?',
				'Do you have a favorite color or color scheme you often use in your work?',
				'Are you interested in expressing yourself with digital tools like 3D modeling?',
				'Do you make more fan works or original works?',
				"What's your work setup like (PC, tablet, software, etc.)?",
				"What's your favorite piece among your own work?"
			]
		}
	},
	{
		id: 'tech',
		emoji: '💻',
		label: { ja: '技術', en: 'Tech' },
		templates: {
			ja: [
				'開発エディタは何を使っていますか？（VSCodeなど）',
				'最近注目しているAPIや技術プロトコルはありますか？',
				'自作のBotやスクリプトを運用していますか？',
				'コーディング中にAI支援ツール（Copilotなど）は利用していますか？',
				'個人開発のアイデアはどのように思いつきますか？',
				'サーバー環境（ラズパイやVPSなど）の構築は好きですか？',
				'プログラミングを勉強し始めたきっかけは何ですか？',
				'開発中に行き詰まった時の解決法（デバッグ手順など）は？',
				'好きなプログラミング言語とその理由を教えてください。',
				'今後作ってみたいWebサービスやアプリはありますか？'
			],
			en: [
				'What code editor do you use (e.g. VSCode)?',
				"Are there any APIs or tech protocols you've been paying attention to lately?",
				"Do you run any bots or scripts you've made yourself?",
				'Do you use AI coding assistants (like Copilot) while coding?',
				'How do you come up with ideas for personal projects?',
				'Do you enjoy setting up server environments (like a Raspberry Pi or VPS)?',
				'What got you started learning to program?',
				"What's your go-to way to solve problems when you get stuck (debugging steps, etc.)?",
				"What's your favorite programming language and why?",
				"Is there a web service or app you'd like to build in the future?"
			]
		}
	},
	{
		id: 'streaming',
		emoji: '🎙️',
		label: { ja: '配信', en: 'Streaming' },
		templates: {
			ja: [
				'初配信のときは緊張しましたか？',
				'配信中によく飲む飲み物は何ですか？',
				'配信の企画はどのようにして考えていますか？',
				'リスナーさんに呼ばれたいあだ名などはありますか？',
				'コラボ配信をしてみたい人はいますか？',
				'配信環境（マイク、オーディオインターフェースなど）のこだわりは？',
				'配信を始めてから嬉しかったエピソードを教えてください。',
				'雑談枠とゲーム実況枠、どちらが好きですか？',
				'配信前に必ずやるルーティンはありますか？',
				'今後、配信で挑戦してみたいことは何ですか？'
			],
			en: [
				'Were you nervous during your first stream?',
				'What do you usually drink while streaming?',
				'How do you come up with ideas for your stream content?',
				"Is there a nickname you'd like viewers to call you?",
				"Is there anyone you'd like to do a collab stream with?",
				'Do you have any particular setup preferences (mic, audio interface, etc.)?',
				"What's a moment that made you happy since you started streaming?",
				'Do you prefer chatting streams or gameplay streams?',
				'Do you have a routine you always do before streaming?',
				"What's something you'd like to try in a future stream?"
			]
		}
	},
	{
		id: 'school',
		emoji: '🏫',
		label: { ja: '学校', en: 'School' },
		templates: {
			ja: [
				'学生時代（または現在）、一番得意だった科目は何ですか？',
				'部活動やサークルは何に入っていましたか？',
				'学校の給食や学食で好きだったメニューは何ですか？',
				'修学旅行や遠足で一番の思い出はどこですか？',
				'席替えのとき、教室のどのあたりの席が好きでしたか？',
				'宿題は先に終わらせる派でしたか？ギリギリ派でしたか？',
				'文化祭や体育祭ではどんな役割を担当することが多かったですか？',
				'休み時間はどうやって過ごすのが好きでしたか？',
				'先生に怒られた思い出はありますか？',
				'学生時代の自分に一言声をかけるなら何と言いますか？'
			],
			en: [
				'What subject were you (or are you) best at in school?',
				'What club or circle activity were you part of?',
				'What was your favorite school lunch or cafeteria menu item?',
				"What's your best memory from a school trip or field trip?",
				'During seat changes, which part of the classroom did you like sitting in?',
				'Do you finish homework early, or do it at the last minute?',
				'What role did you usually take on during school festivals or sports days?',
				'How did you like to spend your breaks between classes?',
				'Do you have a memory of getting scolded by a teacher?',
				'If you could say one thing to your school-age self, what would it be?'
			]
		}
	}
];
