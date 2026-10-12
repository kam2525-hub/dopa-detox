/**
 * 脱・ドパガキ道場 (DopaDetox Dojo) - Main Logic
 */

// ==========================================================================
// 1. Game State & Persistence (LocalStorage)
// ==========================================================================
const STORAGE_KEY = 'dopadetox_state_v1';

const DEFAULT_STATE = {
  exp: 0,
  streak: 1,
  lastActiveDate: new Date().toISOString().slice(0, 10),
  habits: {
    morningNoPhone: false,
    mealNoPhone: false,
    toiletNoPhone: false,
    disableNotifications: false,
    bedNoScreen: false,
    grayscaleMode: false
  },
  lastQuizResult: null
};

class GameState {
  constructor() {
    this.data = this.loadState();
    this.checkDailyReset();
  }

  loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_STATE, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('Failed to load state from localStorage:', e);
    }
    return { ...DEFAULT_STATE };
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Failed to save state to localStorage:', e);
    }
  }

  checkDailyReset() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.data.lastActiveDate !== today) {
      const last = new Date(this.data.lastActiveDate);
      const curr = new Date(today);
      const diffDays = Math.round((curr - last) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Continuous streak!
        this.data.streak += 1;
      } else if (diffDays > 1) {
        // Streak broken
        this.data.streak = 1;
      }

      // Reset daily habits
      this.data.habits = {
        morningNoPhone: false,
        mealNoPhone: false,
        toiletNoPhone: false,
        disableNotifications: false,
        bedNoScreen: false,
        grayscaleMode: false
      };
      this.data.lastActiveDate = today;
      this.save();
    }
  }

  addExp(amount) {
    this.data.exp += amount;
    this.save();
    this.updateUI();
    if (window.soundEngine) {
      window.soundEngine.playChime();
    }
  }

  getLevel() {
    // 100 EXP per level
    return Math.floor(this.data.exp / 100) + 1;
  }

  getTitle() {
    const lvl = this.getLevel();
    if (lvl <= 1) return '脳汁漬け見習い';
    if (lvl <= 2) return '前頭葉解凍中';
    if (lvl <= 3) return '脱ゾンビ修行生';
    if (lvl <= 5) return '集中力の求道者';
    if (lvl <= 8) return '静寂のマスター';
    if (lvl <= 12) return 'デジタル隠者';
    return '脱ドパガキ解脱仙人';
  }

  updateUI() {
    const lvl = this.getLevel();
    const title = this.getTitle();
    const currentLvlExp = this.data.exp % 100;
    const streak = this.data.streak;

    const streakEl = document.getElementById('stat-streak');
    if (streakEl) streakEl.textContent = `${streak}日連続`;

    const titleEl = document.getElementById('stat-title');
    if (titleEl) titleEl.textContent = `Lv.${lvl} ${title}`;

    const expTextEl = document.getElementById('stat-exp-text');
    if (expTextEl) expTextEl.textContent = `${currentLvlExp} / 100 EXP`;

    const expFillEl = document.getElementById('stat-exp-fill');
    if (expFillEl) expFillEl.style.width = `${currentLvlExp}%`;
  }
}

const state = new GameState();

// ==========================================================================
// 2. Navigation Tabs
// ==========================================================================
function initNavigation() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }

      // If user switches away during Zen Challenge, cancel it
      if (targetId !== 'tab-zen' && window.zenChallenge && window.zenChallenge.isRunning) {
        window.zenChallenge.fail('タブを切り替えたため、修行が中断されました');
      }
    });
  });
}

// ==========================================================================
// 3. Audio Controller
// ==========================================================================
function initAudioUI() {
  const rainBtn = document.getElementById('btn-sound-rain');
  const oceanBtn = document.getElementById('btn-sound-ocean');
  const droneBtn = document.getElementById('btn-sound-drone');
  const stopBtn = document.getElementById('btn-sound-stop');
  const soundBtns = [rainBtn, oceanBtn, droneBtn];

  function clearActive() {
    soundBtns.forEach(b => b && b.classList.remove('active'));
  }

  if (rainBtn) {
    rainBtn.addEventListener('click', () => {
      clearActive();
      rainBtn.classList.add('active');
      window.soundEngine.playRain();
    });
  }

  if (oceanBtn) {
    oceanBtn.addEventListener('click', () => {
      clearActive();
      oceanBtn.classList.add('active');
      window.soundEngine.playOcean();
    });
  }

  if (droneBtn) {
    droneBtn.addEventListener('click', () => {
      clearActive();
      droneBtn.classList.add('active');
      window.soundEngine.playDrone();
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      clearActive();
      window.soundEngine.stopAmbient();
    });
  }
}

// ==========================================================================
// 4. Tab 1: 脳汁診断 (Dopamine Addiction Quiz)
// ==========================================================================
const QUIZ_QUESTIONS = [
  {
    q: 'ショート動画（TikTok, Shorts, Reels）を開いたら、気づけば30分以上時間が溶けている',
    dim: 'instant', // instant gratification
    options: [
      { text: '全くない（意識して制限している）', score: 0 },
      { text: 'たまにある（週に1〜2回程度）', score: 1 },
      { text: 'よくある（ほぼ毎日のように溶ける）', score: 2 },
      { text: '日常茶飯事（気がついたら深夜になっている）', score: 3 }
    ]
  },
  {
    q: 'YouTubeや動画コンテンツは、常に1.5倍速〜2倍速以上で見ないと遅くてイライラする',
    dim: 'focus', // focus deficit
    options: [
      { text: '等倍でゆったり楽しんでいる', score: 0 },
      { text: '急いでいる時だけ倍速にする', score: 1 },
      { text: '基本的に1.25〜1.5倍速で見ている', score: 2 },
      { text: '2倍速以上じゃないと耐えられない・文字スクロールも爆速', score: 3 }
    ]
  },
  {
    q: 'トイレや食事中、スマホを見ていないと何か手持ち無沙汰で落ち着かない',
    dim: 'withdrawal', // withdrawal
    options: [
      { text: '食事やトイレにスマホは持ち込まない', score: 0 },
      { text: 'たまに持っていく程度', score: 1 },
      { text: 'ほぼ毎回片手でスマホを見ながら済ませる', score: 2 },
      { text: 'スマホがないと排泄や食事が始まらないレベル', score: 3 }
    ]
  },
  {
    q: 'スマホの通知が鳴っていないのに、ポケットで震えた気がして画面を確認してしまう（ファントム・バイブレーション）',
    dim: 'withdrawal',
    options: [
      { text: 'そんな経験はほとんどない', score: 0 },
      { text: 'ごく稀にある', score: 1 },
      { text: '週に何度か錯覚して画面を見る', score: 2 },
      { text: 'しょっちゅう幻聴・幻の振動を感じる', score: 3 }
    ]
  },
  {
    q: 'ちょっとした待ち時間（エレベーター、信号待ち、電子レンジの1分）に無意識にスマホをポケットから出している',
    dim: 'instant',
    options: [
      { text: '周囲の景色を見たり考え事をして待てる', score: 0 },
      { text: '退屈なら見ることもある', score: 1 },
      { text: '数秒でも手が勝手にスマホに伸びる', score: 2 },
      { text: 'ロック解除までがもはや無条件反射の脊髄反射', score: 3 }
    ]
  },
  {
    q: '活字の本や長文の記事を読むと、数行読んだだけで頭に入らなくなりブラウザバックしたくなる',
    dim: 'focus',
    options: [
      { text: '長文や書籍もじっくり読める', score: 0 },
      { text: '多少疲れるが読める', score: 1 },
      { text: '集中が途切れやすく要約ばかり探してしまう', score: 2 },
      { text: '3行以上の文章を見ると脳が拒絶反応を起こす', score: 3 }
    ]
  },
  {
    q: '勉強やPC作業中、開始5分も経たずにSNS・まとめサイト・別タブを開いてしまう',
    dim: 'focus',
    options: [
      { text: '作業に入れば20〜30分以上没頭できる', score: 0 },
      { text: '15分くらいで一息つく', score: 1 },
      { text: '数分ごとにタブを切り替えてマルチタスクになる', score: 2 },
      { text: '集中という概念が消滅した（1分と持たない）', score: 3 }
    ]
  },
  {
    q: '布団に入ってから「あと5分だけ」とスマホを見続け、気づけば睡眠時間を削っている',
    dim: 'withdrawal',
    options: [
      { text: '就寝前はスマホを置いてスムーズに眠る', score: 0 },
      { text: 'たまに15分くらい見る日がある', score: 1 },
      { text: 'ほぼ毎日30分〜1時間は画面を見つめている', score: 2 },
      { text: 'スマホを顔に落とすまで無限スクロールが止まらない', score: 3 }
    ]
  },
  {
    q: '何かを調べる・選ぶ時、自分で熟考する前にSNSの「まとめショート」や「結論だけ教えて」を探す',
    dim: 'cognitive', // cognitive passivity
    options: [
      { text: '一次情報や本を読み、自分で考える', score: 0 },
      { text: '概要を把握した上で自分で吟味する', score: 1 },
      { text: '誰かがまとめたタイパ情報しか見たくない', score: 2 },
      { text: '「結論から言え」思考になり、考えるプロセス自体が苦痛', score: 3 }
    ]
  },
  {
    q: '「何もしないでボーッとする時間」が退屈すぎて、不安やイライラを感じる',
    dim: 'cognitive',
    options: [
      { text: 'ボーッとする時間は心地よくリラックスできる', score: 0 },
      { text: '少し退屈だが平気', score: 1 },
      { text: '常に何か情報や音楽を流していないと落ち着かない', score: 2 },
      { text: '静寂や無刺激が耐え難い恐怖・苦痛である', score: 3 }
    ]
  }
];

class QuizEngine {
  constructor() {
    this.currentIndex = 0;
    this.answers = [];
    this.init();
  }

  init() {
    this.renderQuestion();
    const retakeBtn = document.getElementById('btn-quiz-retake');
    if (retakeBtn) {
      retakeBtn.addEventListener('click', () => this.restart());
    }
  }

  restart() {
    this.currentIndex = 0;
    this.answers = [];
    const questionCard = document.getElementById('quiz-question-card');
    const resultCard = document.getElementById('quiz-result-card');
    if (questionCard) questionCard.style.display = 'block';
    if (resultCard) resultCard.style.display = 'none';
    this.renderQuestion();
  }

  renderQuestion() {
    const q = QUIZ_QUESTIONS[this.currentIndex];
    const total = QUIZ_QUESTIONS.length;

    const numEl = document.getElementById('quiz-question-num');
    const textEl = document.getElementById('quiz-question-text');
    const progressFill = document.getElementById('quiz-progress-fill');
    const optionsGrid = document.getElementById('quiz-options-grid');

    if (numEl) numEl.textContent = `質問 ${this.currentIndex + 1} / ${total}`;
    if (textEl) textEl.textContent = q.q;
    if (progressFill) progressFill.style.width = `${((this.currentIndex) / total) * 100}%`;

    if (optionsGrid) {
      optionsGrid.innerHTML = '';
      q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerHTML = `<span>${opt.text}</span> <span style="opacity:0.4; font-size:0.8rem;">+${opt.score}点</span>`;
        btn.addEventListener('click', () => this.selectOption(opt.score, q.dim));
        optionsGrid.appendChild(btn);
      });
    }
  }

  selectOption(score, dim) {
    this.answers.push({ score, dim });
    this.currentIndex++;

    if (this.currentIndex < QUIZ_QUESTIONS.length) {
      this.renderQuestion();
    } else {
      this.showResults();
    }
  }

  showResults() {
    const totalScore = this.answers.reduce((acc, cur) => acc + cur.score, 0);

    // Dimension breakdown (out of max possible)
    const dims = { instant: 0, focus: 0, withdrawal: 0, cognitive: 0 };
    const maxDims = { instant: 6, focus: 9, withdrawal: 9, cognitive: 6 };

    this.answers.forEach(a => {
      dims[a.dim] += a.score;
    });

    const dimRatios = {
      instant: Math.round((dims.instant / maxDims.instant) * 100),
      focus: Math.round((dims.focus / maxDims.focus) * 100),
      withdrawal: Math.round((dims.withdrawal / maxDims.withdrawal) * 100),
      cognitive: Math.round((dims.cognitive / maxDims.cognitive) * 100)
    };

    let rank = '';
    let rankColor = '';
    let title = '';
    let desc = '';
    let prescriptions = [];

    if (totalScore >= 25) {
      rank = 'SSS級';
      rankColor = 'var(--accent-dopa)';
      title = '脳汁液状化ドパガキ';
      desc = '前頭葉がショート動画の超高周波刺激に焼かれ、完全に液状化しています。日常の退屈に1秒も耐えられず、ドーパミン受容体が枯渇しています。今すぐスマホを文鎮化し、緊急デトックスを行ってください。';
      prescriptions = [
        '今すぐ「脳汁SOS」タブで90秒の波乗り呼吸を実践する',
        'スマホの画面表示を「モノクロ（白黒）」に設定し刺激を激減させる',
        '「何もしないチャレンジ」1分コースから前頭葉のリハビリを開始'
      ];
    } else if (totalScore >= 18) {
      rank = 'S級';
      rankColor = '#fb923c';
      title = '刺激ゾンビドパガキ';
      desc = '無意識の無限スクロールが日常化し、集中力の持続時間が金魚レベル（数分）まで短縮されています。「何かしながら別のものを見る」マルチタスクで常に脳がオーバーヒート状態です。';
      prescriptions = [
        '食事中とトイレへのスマホ持ち込みを今日から絶対禁止にする',
        'ショート動画アプリをトップ画面から削除し、通知を全オフにする',
        '「活字リハビリ」で1日1篇、じっくり文字を味わう練習を始める'
      ];
    } else if (totalScore >= 11) {
      rank = 'A級';
      rankColor = 'var(--accent-gold)';
      title = 'ドパガキ予備軍';
      desc = '現代のアルゴリズムの罠に片足を踏み入れています。ふとした隙間時間にスマホを開く癖がついており、油断すると一気に前頭葉がハックされる危険信号です。';
      prescriptions = [
        '寝る前30分はスマホを手の届かない場所に隔離する',
        '「何もしないチャレンジ」3分間に挑戦し、退屈を友にする感覚を養う',
        '習慣防壁チェックリストで毎日の防衛ルーティンを定着させる'
      ];
    } else if (totalScore >= 5) {
      rank = 'B級';
      rankColor = 'var(--accent-cyan)';
      title = '一般健全者';
      desc = 'テクノロジーに振り回されず、適度な距離感を保てています。たまに誘惑に負けることはあっても、自制心と集中力の基礎体力が維持されています。';
      prescriptions = [
        '現在の良好なデジタル付き合いを維持する',
        'さらに深い集中力（ディープワーク）を目指し瞑想習慣を取り入れる'
      ];
    } else {
      rank = '仙人級';
      rankColor = 'var(--accent-zen)';
      title = '脱ドパガキ解脱マスター';
      desc = '現代の過剰刺激社会における奇跡の存在。静寂を愛し、前頭葉はクリスタルのように研ぎ澄まされています。デジタルアルゴリズムの傀儡ではなく、自らの意志で時間を支配しています。';
      prescriptions = [
        '道場の「何もしないチャレンジ」5分を悠々とクリアしてみせよ',
        '迷えるドパガキたちにこの道場を教えて救済してあげてください'
      ];
    }

    // Award initial EXP for completing quiz
    state.addExp(30);

    const questionCard = document.getElementById('quiz-question-card');
    const resultCard = document.getElementById('quiz-result-card');
    if (questionCard) questionCard.style.display = 'none';
    if (resultCard) resultCard.style.display = 'block';

    const rankTitleEl = document.getElementById('result-rank-title');
    const rankNameEl = document.getElementById('result-rank-name');
    const rankDescEl = document.getElementById('result-rank-desc');
    const scoreValEl = document.getElementById('result-score-val');
    const prescListEl = document.getElementById('result-presc-list');

    if (rankTitleEl) rankTitleEl.textContent = `判定結果：${rank}`;
    if (rankNameEl) {
      rankNameEl.textContent = title;
      rankNameEl.style.color = rankColor;
    }
    if (rankDescEl) rankDescEl.textContent = desc;
    if (scoreValEl) scoreValEl.textContent = `${totalScore} / 30 点`;

    if (prescListEl) {
      prescListEl.innerHTML = '';
      prescriptions.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p;
        prescListEl.appendChild(li);
      });
    }

    // Draw Radar Chart
    this.drawRadarChart(dimRatios);

    // Share Text Link
    const shareBtn = document.getElementById('btn-quiz-share');
    if (shareBtn) {
      const shareText = encodeURIComponent(
        `【脱・ドパガキ道場】診断結果：私は「${rank} ${title}」（スコア: ${totalScore}/30点）でした！\n脳汁過剰分泌から前頭葉を取り戻す修行中。\n#ドパガキ卒業 #脱ドパガキ道場 #ドーパミンデトックス`
      );
      shareBtn.href = `https://twitter.com/intent/tweet?text=${shareText}`;
      shareBtn.target = '_blank';
    }
  }

  drawRadarChart(ratios) {
    const svg = document.getElementById('radar-svg');
    if (!svg) return;

    // Center at (150, 150), Radius = 100
    const cx = 150, cy = 150, r = 100;
    const angles = [
      -Math.PI / 2, // Top: 即時刺激依存
      0,            // Right: 集中力欠如
      Math.PI / 2,  // Bottom: 禁断症状
      Math.PI       // Left: 思考停止
    ];

    const values = [
      ratios.instant / 100,
      ratios.focus / 100,
      ratios.withdrawal / 100,
      ratios.cognitive / 100
    ];

    const points = angles.map((ang, i) => {
      const val = Math.max(0.15, values[i]); // Minimum shape
      const x = cx + r * val * Math.cos(ang);
      const y = cy + r * val * Math.sin(ang);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const polygon = document.getElementById('radar-polygon');
    if (polygon) {
      polygon.setAttribute('points', points);
    }
  }
}

// ==========================================================================
// 5. Tab 2: 脳汁SOS (緊急ドーパミンスワップ)
// ==========================================================================
const OFFLINE_ACTIONS = [
  {
    title: '冷たい水で顔を洗う & 1杯の水を飲む',
    desc: '冷水刺激（ダイビング反射）によって副交感神経が急激に活性化し、興奮した脳汁ループを物理的に鎮静化させます。'
  },
  {
    title: '天井の四隅を10秒ずつじっと見つめる',
    desc: '視線を意図的に遠くへ向けることで、スマホ画面による過剰なトンネル視野（交感神経刺激）をリセットします。'
  },
  {
    title: '肩を耳まで上げてストンと落とす × 5回',
    desc: 'スマホ首で凝り固まった僧帽筋をほぐし、脳への血流を正常化させて理性を司る前頭葉を目覚めさせます。'
  },
  {
    title: '手のひらを全力でグーパー × 10回',
    desc: '手の感覚受容器を刺激することで、無意識に親指をスワイプしようとする自動操縦運動を断ち切ります。'
  },
  {
    title: '窓を開けて外の空気を3回深呼吸',
    desc: '部屋の二酸化炭素濃度を下げ、新鮮な酸素を脳に供給。現実世界の外気に触れることでデジタル幻影から復帰します。'
  },
  {
    title: 'その場でスクワット15回',
    desc: '大腿四頭筋に負荷をかけてドーパミンの過剰分泌欲求を健全な筋運動エネルギーとして消費します。'
  }
];

class SOSManager {
  constructor() {
    this.urgeTimer = null;
    this.secondsLeft = 90;
    this.breathCycleTimer = null;
    this.breathPhase = 0; // 0: inhale, 1: hold, 2: exhale, 3: hold
    this.init();
  }

  init() {
    const triggerBtn = document.getElementById('btn-sos-trigger');
    const completeActionBtn = document.getElementById('btn-gacha-complete');
    const rerollBtn = document.getElementById('btn-gacha-reroll');

    if (triggerBtn) {
      triggerBtn.addEventListener('click', () => this.activateSOS());
    }

    if (completeActionBtn) {
      completeActionBtn.addEventListener('click', () => {
        state.addExp(25);
        alert('✨ オフライン行動達成！前頭葉が刺激の波を乗り越えました！ (+25 EXP)');
        completeActionBtn.disabled = true;
        completeActionBtn.textContent = '済（EXP獲得済）';
      });
    }

    if (rerollBtn) {
      rerollBtn.addEventListener('click', () => this.rollGacha());
    }
  }

  activateSOS() {
    const sosBox = document.getElementById('sos-active-box');
    if (sosBox) sosBox.style.display = 'block';

    // Scroll to box
    sosBox.scrollIntoView({ behavior: 'smooth' });

    // Start 90s Urge Surfing timer
    this.startUrgeTimer();
    this.startBreathing();
    this.rollGacha();

    // Play soothing bell
    if (window.soundEngine) {
      window.soundEngine.playBell(260);
    }
  }

  startUrgeTimer() {
    if (this.urgeTimer) clearInterval(this.urgeTimer);
    this.secondsLeft = 90;
    const counterEl = document.getElementById('urge-timer-counter');

    const updateDisplay = () => {
      const m = Math.floor(this.secondsLeft / 60);
      const s = this.secondsLeft % 60;
      if (counterEl) {
        counterEl.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
      }
    };
    updateDisplay();

    this.urgeTimer = setInterval(() => {
      this.secondsLeft--;
      updateDisplay();

      if (this.secondsLeft <= 0) {
        clearInterval(this.urgeTimer);
        this.stopBreathing();
        state.addExp(35);
        if (window.soundEngine) window.soundEngine.playBell(432);
        alert('🎉 90秒の波乗り完了！衝動のピークが過ぎ去りました。前頭葉の勝利です！ (+35 EXP)');
      }
    }, 1000);
  }

  startBreathing() {
    if (this.breathCycleTimer) clearInterval(this.breathCycleTimer);
    const circle = document.getElementById('breathing-circle');
    const text = document.getElementById('breathing-instruction');

    const phases = [
      { text: '息を吸う (4秒)', scale: 'scale(1.8)' },
      { text: '息を止める (4秒)', scale: 'scale(1.8)' },
      { text: '息を吐く (4秒)', scale: 'scale(1)' },
      { text: '息を止める (4秒)', scale: 'scale(1)' }
    ];

    let phase = 0;
    const runPhase = () => {
      const p = phases[phase];
      if (text) text.textContent = p.text;
      if (circle) circle.style.transform = p.scale;
      phase = (phase + 1) % phases.length;
    };

    runPhase();
    this.breathCycleTimer = setInterval(runPhase, 4000);
  }

  stopBreathing() {
    if (this.breathCycleTimer) clearInterval(this.breathCycleTimer);
    const text = document.getElementById('breathing-instruction');
    if (text) text.textContent = '整いました';
  }

  rollGacha() {
    const act = OFFLINE_ACTIONS[Math.floor(Math.random() * OFFLINE_ACTIONS.length)];
    const titleEl = document.getElementById('gacha-action-title');
    const descEl = document.getElementById('gacha-action-desc');
    const completeBtn = document.getElementById('btn-gacha-complete');

    if (titleEl) titleEl.textContent = act.title;
    if (descEl) descEl.textContent = act.desc;
    if (completeBtn) {
      completeBtn.disabled = false;
      completeBtn.textContent = '実行完了した (+25 EXP)';
    }
  }
}

// ==========================================================================
// 6. Tab 3: 何もしないチャレンジ (Zen Silence Challenge)
// ==========================================================================
class ZenChallenge {
  constructor() {
    this.targetSeconds = 60;
    this.remainingSeconds = 60;
    this.timer = null;
    this.isRunning = false;
    this.hasMovedMouse = 0;
    this.init();
  }

  init() {
    window.zenChallenge = this;

    const timeBtns = document.querySelectorAll('.zen-time-btn');
    timeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.isRunning) return;
        timeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.targetSeconds = parseInt(btn.getAttribute('data-seconds'), 10);
        this.updateTimeDisplay(this.targetSeconds);
      });
    });

    const startBtn = document.getElementById('btn-zen-start');
    const cancelBtn = document.getElementById('btn-zen-cancel');

    if (startBtn) startBtn.addEventListener('click', () => this.start());
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.cancel());

    // Anti-distraction event listeners
    document.addEventListener('visibilitychange', () => {
      if (this.isRunning && document.hidden) {
        this.fail('他のタブやアプリに切り替えたため、前頭葉が刺激に負けました！');
      }
    });

    window.addEventListener('blur', () => {
      if (this.isRunning) {
        this.fail('別ウィンドウをクリックしたため、集中が中断されました！');
      }
    });

    window.addEventListener('keydown', (e) => {
      if (this.isRunning && e.key !== 'Escape') {
        this.fail('キーボードに触れたため、沈黙の戒律が破られました！');
      }
    });

    let lastMouseX = 0, lastMouseY = 0;
    window.addEventListener('mousemove', (e) => {
      if (!this.isRunning) return;
      const dist = Math.hypot(e.clientX - lastMouseX, e.clientY - lastMouseY);
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      if (dist > 40) { // Tolerant to slight nudge, but fails on deliberate movement
        this.hasMovedMouse++;
        if (this.hasMovedMouse > 4) {
          this.fail('マウスを大きく動かしたため、沈黙が破られました！');
        }
      }
    });
  }

  updateTimeDisplay(secs) {
    const timerEl = document.getElementById('zen-timer-big');
    if (!timerEl) return;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    timerEl.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  start() {
    this.isRunning = true;
    this.remainingSeconds = this.targetSeconds;
    this.hasMovedMouse = 0;

    const setupView = document.getElementById('zen-setup-view');
    const activeView = document.getElementById('zen-active-view');
    const failMsg = document.getElementById('zen-fail-message');

    if (setupView) setupView.style.display = 'none';
    if (activeView) activeView.style.display = 'block';
    if (failMsg) failMsg.style.display = 'none';

    this.updateTimeDisplay(this.remainingSeconds);

    if (window.soundEngine) {
      window.soundEngine.playBell(300);
      // Auto-start rain or drone if not already playing
      if (!window.soundEngine.currentTrack) {
        window.soundEngine.playDrone();
      }
    }

    this.timer = setInterval(() => {
      this.remainingSeconds--;
      this.updateTimeDisplay(this.remainingSeconds);

      if (this.remainingSeconds <= 0) {
        this.success();
      }
    }, 1000);
  }

  success() {
    clearInterval(this.timer);
    this.isRunning = false;

    let earnedExp = 50;
    if (this.targetSeconds === 180) earnedExp = 160;
    if (this.targetSeconds === 300) earnedExp = 300;

    state.addExp(earnedExp);

    if (window.soundEngine) {
      window.soundEngine.playBell(432);
    }

    alert(`🧘 修行達成！何もしない沈黙に耐え抜きました！前頭葉が深く休息しました。 (+${earnedExp} EXP)`);
    this.resetViews();
  }

  fail(reason) {
    clearInterval(this.timer);
    this.isRunning = false;

    const failMsg = document.getElementById('zen-fail-message');
    const failReason = document.getElementById('zen-fail-reason');
    if (failReason) failReason.textContent = reason;
    if (failMsg) failMsg.style.display = 'block';

    this.resetViews();
  }

  cancel() {
    clearInterval(this.timer);
    this.isRunning = false;
    this.resetViews();
  }

  resetViews() {
    const setupView = document.getElementById('zen-setup-view');
    const activeView = document.getElementById('zen-active-view');
    if (setupView) setupView.style.display = 'block';
    if (activeView) activeView.style.display = 'none';
  }
}

// ==========================================================================
// 7. Tab 4: 活字リハビリ (Slow Reading Dojo)
// ==========================================================================
const READING_TEXTS = [
  {
    title: '宮沢賢治『銀河鉄道の夜』より',
    author: '宮沢賢治',
    paragraphs: [
      'ジョバンニは、いつか町はずれの丘の上に立っていました。草のにおいが、冷たい夜の空気の中に濃くただよっていました。',
      '見上げると、南の空いっぱいに、天の川が白くぼうっと光り、まるで巨きな白い野原のようでした。そのところどころには、小さな青い星や赤い星が、静かにまたたいていました。',
      'ジョバンニは胸がいっぱいになって、何度も深く息を吸いました。「僕の体の中に、あの星たちの光が染みこんでくるようだ」と、彼はひとりごとを言いました。',
      '世の中の人々は、あんなに急いでどこへ行くのだろう。小さな灯りをもとめて、ただ忙しく走り回っているのではないだろうか。静かな銀河を見つめていると、急ぐことのすべてが幻のように思えてくるのでした。'
    ],
    question: 'ジョバンニが南の空を見上げた時、天の川はどのように見えたと描写されていますか？',
    answers: ['金色の滝のよう', '巨きな白い野原のよう', '激しく燃える火のよう'],
    correct: 1
  },
  {
    title: 'マルクス・アウレリウス『自省録』より',
    author: 'マルクス・アウレリウス (第16代ローマ皇帝)',
    paragraphs: [
      '朝起きたとき、自分自身にこう言い聞かせよ。「今日私は、お節介な者、恩知らずな者、傲慢な者、不実な者、嫉妬深い者、利己的な者に出会うだろう」と。',
      '彼らがそうであるのは、真の善と悪の区別を知らないからである。しかし私は、善の本質が美であり、悪の本質が醜であることを知っている。だから何者も私を傷つけることはできない。',
      '外の出来事に心を乱されるな。暇を作って何か真に善いことを学び、あちらこちらへと振り回されるのをやめよ。',
      '多くの人は、人生の目的も定めず、あらゆる衝動に身を任せて奔走し、息絶える。自分の魂の動きに注意を向けない者が、どうして幸福になれようか。'
    ],
    question: 'アウレリウスが説く、外の出来事に心を乱されないためにやめるべきこととは？',
    answers: ['あちらこちらへと振り回されること', '他人に親切にすること', '朝早く起きること'],
    correct: 0
  },
  {
    title: '鴨長明『方丈記』より',
    author: '鴨長明',
    paragraphs: [
      'ゆく河の流れは絶えずして、しかももとの水にあらず。よどみに浮ぶうたかたは、かつ消えかつ結びて、久しくとどまりたるためしなし。世にある人と栖（すみか）と、またかくのごとし。',
      '朝に死に、夕べに生まるるならひ、ただ水の泡にぞ似たりける。知らず、生まれ死ぬる人、いづくより来たりて、いづくへか去る。',
      'また知らず、仮の宿り、誰がために心を悩まし、何によりてか目を喜ばしむる。その主と栖と、無常を争ふさま、いはば朝顔と露とに異ならず。',
      '静かなる山中に住みて、心のおもむくままに暮らすとき、世のわずらわしき栄枯盛衰は、すべて我が心の外の出来事にすぎぬと知るのである。'
    ],
    question: '『方丈記』の冒頭で、人の命や仮の住まいは何に例えられていますか？',
    answers: ['風に舞う木の葉', '水に浮かぶ泡（うたかた）', '枯れ野の煙'],
    correct: 1
  }
];

class SlowReadingDojo {
  constructor() {
    this.currentTextIndex = 0;
    this.startTime = null;
    this.init();
  }

  init() {
    this.renderTextSelector();
    this.loadText(0);
  }

  renderTextSelector() {
    const container = document.getElementById('reading-selector-row');
    if (!container) return;
    container.innerHTML = '';

    READING_TEXTS.forEach((item, idx) => {
      const btn = document.createElement('button');
      btn.className = `zen-time-btn ${idx === this.currentTextIndex ? 'active' : ''}`;
      btn.textContent = item.title;
      btn.addEventListener('click', () => {
        document.querySelectorAll('#reading-selector-row .zen-time-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.loadText(idx);
      });
      container.appendChild(btn);
    });
  }

  loadText(index) {
    this.currentTextIndex = index;
    this.startTime = Date.now();
    const data = READING_TEXTS[index];

    const titleEl = document.getElementById('reading-title');
    const authorEl = document.getElementById('reading-author');
    const boxEl = document.getElementById('reading-box');
    const quizBox = document.getElementById('reading-quiz-box');

    if (titleEl) titleEl.textContent = data.title;
    if (authorEl) authorEl.textContent = `筆者: ${data.author}`;
    if (quizBox) quizBox.style.display = 'none';

    if (boxEl) {
      boxEl.innerHTML = '';
      data.paragraphs.forEach((pText, pIdx) => {
        const p = document.createElement('p');
        p.className = 'reading-p';
        p.textContent = pText;
        p.addEventListener('click', () => {
          document.querySelectorAll('.reading-p').forEach(el => el.classList.remove('reading-highlight'));
          p.classList.add('reading-highlight');
        });
        boxEl.appendChild(p);
      });
    }

    const finishBtn = document.getElementById('btn-reading-finish');
    if (finishBtn) {
      finishBtn.style.display = 'inline-flex';
      finishBtn.onclick = () => this.showReadingQuiz();
    }
  }

  showReadingQuiz() {
    const elapsedSecs = Math.round((Date.now() - this.startTime) / 1000);
    if (elapsedSecs < 15) {
      alert('⚠️ 読むスピードが早すぎます！倍速・流し読みのドパガキ癖が出ています。一行ずつ味わって深呼吸しながら読み直してみましょう。');
      return;
    }

    const data = READING_TEXTS[this.currentTextIndex];
    const quizBox = document.getElementById('reading-quiz-box');
    const questionEl = document.getElementById('reading-quiz-q');
    const optionsGrid = document.getElementById('reading-quiz-options');

    if (questionEl) questionEl.textContent = data.question;
    if (optionsGrid) {
      optionsGrid.innerHTML = '';
      data.answers.forEach((ans, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = ans;
        btn.addEventListener('click', () => {
          if (idx === data.correct) {
            state.addExp(40);
            alert('🎉 正解！文章の文脈と余韻をしっかり捉えられました！ (+40 EXP)');
            quizBox.style.display = 'none';
          } else {
            alert('❌ 不正解です。もう一度落ち着いて本文を読み返してみましょう。');
          }
        });
        optionsGrid.appendChild(btn);
      });
    }

    if (quizBox) {
      quizBox.style.display = 'block';
      quizBox.scrollIntoView({ behavior: 'smooth' });
    }
  }
}

// ==========================================================================
// 8. Tab 5: 習慣・防壁 (Habits & Hacks)
// ==========================================================================
function initHabitsUI() {
  const habitItems = document.querySelectorAll('.habit-item');

  habitItems.forEach(item => {
    const key = item.getAttribute('data-habit');
    if (state.data.habits[key]) {
      item.classList.add('checked');
    }

    item.addEventListener('click', () => {
      const isNowChecked = !item.classList.contains('checked');
      if (isNowChecked) {
        item.classList.add('checked');
        state.data.habits[key] = true;
        state.addExp(15);
      } else {
        item.classList.remove('checked');
        state.data.habits[key] = false;
        state.save();
      }
    });
  });
}

// ==========================================================================
// Application Bootstrap
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  state.updateUI();
  initNavigation();
  initAudioUI();
  initHabitsUI();

  window.quizEngine = new QuizEngine();
  window.sosManager = new SOSManager();
  window.zenChallenge = new ZenChallenge();
  window.slowReadingDojo = new SlowReadingDojo();

  // Switch to quiz tab on action button
  const startTrainBtn = document.getElementById('btn-goto-training');
  if (startTrainBtn) {
    startTrainBtn.addEventListener('click', () => {
      const tabZen = document.querySelector('[data-tab="tab-zen"]');
      if (tabZen) tabZen.click();
    });
  }
});
