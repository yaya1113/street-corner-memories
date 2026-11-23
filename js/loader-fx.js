/* =========================================================
   加载页粒子：尘埃汇聚成题献「记忆里的那条街」
   ---------------------------------------------------------
   「一屏三拍」：① 星尘聚字 → ② 字定格 → ③ 文案与按钮浮现（CSS 靠 .armed 负责）
   本文件只管前两拍：混沌漂浮(appear) → 汇聚(converge) → 定格(settle)。
   ★ 演完【不自动跳转、不自动亮屏】，停在同一屏等用户点击；
     背景「亮起来」只发生在 app.js 点击后加的 .entering 里。

   ★ 必须遵守的点（踩了就废）：
   1. 光斑必须预渲染成 sprite，用 drawImage + 正常合成，绝不逐帧 shadowBlur；
   2. 取点要在 document.fonts.ready 之后，否则量到的是回退字体的字宽；
   3. 采样步长【固定 3 个设备像素、绝不能乘 DPR】——乘了在 2× 屏上目标点少一半；
   4. 不要用 globalCompositeOperation='lighter'：重叠处加色会冲成一片白；
   5. 真字 .loader-dedicate 的透明度由本脚本逐帧写（上限 0.42），
      写死 1 会变成「粒子字 + 真字」两行叠在一起；
      其下的英文小字 .loader-dedicate-en 用同一条曲线同步淡入（上限相同），
      两行是同一组「题献」，亮度必须一致；
   6. 字号 / 字距 / 字重 / 垂直中心必须与 style.css 的
      --title-size、--title-ls、font-weight、top:38% 严格一致，否则真字与粒子错位；
      ★ TITLE 常量必须与 index.html 的 .loader-dedicate 文字逐字相同；
   7. 降级分支也必须走 announceFormed()，不能自动放行。
   ========================================================= */
(() => {
  const TITLE = '记忆里的那条街';
  /* 与 css 里 .loader-dedicate 的 font-family 同一套宋体系：
     粒子字形与真字必须用同一套字，否则真字一淡入就会和粒子错开半字 */
  const FONT_STACK = '"Source Han Serif SC","Noto Serif SC","Songti SC","SimSun","STSong",serif';
  const DPR = Math.min(devicePixelRatio || 1, 2);
  /* 窄屏不做粒子：字太小聚不出来，且上万粒点在手机上白烧电。
     分支与 css 的 max-width:760px 兜底大致对齐。 */
  const CANVAS_OK = innerWidth >= 820;

  /* 时间轴（秒）——出现 0.5 → 汇聚 1.9（戏肉）→ 定格 1.0 */
  const T = { appear: 0.5, converge: 1.9, settle: 1.0 };
  const FORM_AT = T.appear + T.converge;            // 2.4s：粒子正好铺满笔画

  /* ① 字号公式必须与 CSS 的 --title-size: clamp(34px,4.4vw,52px) 完全一致（桌面端封顶 52px） */
  const titlePx = () => Math.min(Math.max(innerWidth * 0.044, 34), 52);
  /* ② 字距对应 --title-ls: .1em */
  const titleLs = () => titlePx() * 0.1;
  /* ③ 题献中心高度：与 CSS 的 top:38% 严格对齐 */
  const TITLE_Y_RATIO = 0.38;

  /* ④ 色板：黄昏的尘埃是「暖灰 + 一点香槟」，靠亮度层次而不是饱和度撑画面。
     ★ size 区间比常规粒子大一档：这一屏的粒子是唯一主角，太小就聚不成"标题"。 */
  const PALETTE = [
    { color: '#9d9280', weight: 30, size: [1.0, 1.9] },
    { color: '#b3a58c', weight: 26, size: [1.0, 2.0] },
    { color: '#8d7a5e', weight: 20, size: [0.9, 1.7] },
    { color: '#7a5a44', weight: 12, size: [0.9, 1.6] },
    { color: '#8a4f3a', weight: 8,  size: [0.9, 1.6] },
    { color: '#e6dcc4', weight: 4,  size: [1.1, 2.0] },
  ];

  const loader = document.getElementById('loader');
  const bg     = document.getElementById('loaderBg');
  const ded    = document.getElementById('loaderDedicate');
  const dedEn  = document.getElementById('loaderDedicateEn');
  const cv     = document.getElementById('loaderFx');
  if (!loader || !cv || !loader.isConnected) return;
  const ctx = cv.getContext('2d');

  let W = 0, H = 0, particles = [], startAt = 0, raf = 0, formed = false;

  window.__loaderFinish = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };

  /* ---- 0. 成形播报：CSS 靠 .armed 浮出文案与按钮，app.js 靠它放行点击 ---- */
  function announceFormed() {
    if (formed) return;
    formed = true;
    /* ★ 用 .armed 而不是旧的 .text-formed —— 语义更准（"解锁可交互"），
       也避免和已删掉的旧 CSS 规则同名打架。 */
    loader.classList.add('armed');
    window.dispatchEvent(new CustomEvent('loader:formed'));
  }

  /* 无障碍 / 窄屏降级：不跑粒子，静态字 + 暗底，同样停在等点击。
     ★ 必须也走 announceFormed，不能自动放行 —— 否则不看动画的用户
       会在还没读完文案时就被推进街道页。 */
  if (!CANVAS_OK || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    loader.classList.add('as-text');
    if (bg) bg.style.filter = 'blur(16px) saturate(.5) brightness(.3)';
    /* ★ 这一条是补的：canvas 不显式设 width/height 就是默认 300×150，
       而 CSS 把它拉到满屏 → 像素被非等比拉伸（414 宽的手机上比例是 0.72 : 0.17），
       既浪费一次拉伸合成，也让"降级分支"看起来像出了故障。
       降级分支本来就不画任何东西，直接把画布收掉最干净。 */
    if (cv) cv.style.display = 'none';
    announceFormed();
    return;
  }

  /* ---- 1. 预渲染光斑 sprite（亮核收在 10%、36% 衰减掉） ---- */
  function makeSprite(color) {
    const r = 32, c = document.createElement('canvas');
    c.width = c.height = r * 2;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0,    color);
    grad.addColorStop(0.10, color + 'cc');
    grad.addColorStop(0.36, color + '26');
    grad.addColorStop(1,    color + '00');
    g.fillStyle = grad;
    g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
    return c;
  }
  const sprites = PALETTE.map(p => Object.assign({}, p, { cv: makeSprite(p.color) }));

  function pickColor() {
    let t = Math.random() * 100;
    for (const s of sprites) { if ((t -= s.weight) <= 0) return s; }
    return sprites[0];
  }

  /* ---- 2. 取点：把文字栅格化，按固定步长收集「笔画内」的格子 ---- */
  function collectTargets(fontPx, letterSpacing) {
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const g = off.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '600 ' + fontPx + 'px ' + FONT_STACK;
    const chars = [...TITLE];
    const widths = chars.map(ch => g.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + letterSpacing * (chars.length - 1);
    let x = W / 2 - total / 2;
    const y = H * TITLE_Y_RATIO;
    chars.forEach((ch, i) => {
      g.fillText(ch, x + widths[i] / 2, y);
      x += widths[i] + letterSpacing;
    });

    /* ★ 固定 3 个设备像素，不乘 DPR */
    const step = 3;    const img = g.getImageData(0, 0, W, H).data;
    const cells = [];
    for (let py = 0; py < H; py += step) {
      for (let px = 0; px < W; px += step) {
        if (img[(py * W + px) * 4 + 3] > 128) cells.push([px, py]);
      }
    }
    for (let i = cells.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    return cells;
  }

  /* ---- 3. 生成粒子：先散在混沌的雾里，再被吸向笔画 ---- */
  function buildParticles(cells) {
    const MAX = 16000;
    const n = Math.min(cells.length, MAX);
    const CX = W * 0.5, CY = H * 0.42;
    const out = [];
    for (let i = 0; i < n; i++) {
      const tx = cells[i][0], ty = cells[i][1];
      const delay = Math.random() * 0.3;
      const tw = Math.random() * Math.PI * 2;
      const dx = CX + (Math.random() - 0.5) * W * 1.55;
      const dy = CY + (Math.random() - 0.5) * H * 0.95;
      const tc = T.appear + delay;
      const fx = dx + Math.sin(tc * 0.55 + tw) * 40 * DPR;
      const fy = dy + Math.cos(tc * 0.46 + tw * 1.3) * 30 * DPR;
      /* 收敛时长按剩余窗口归一：无论错峰早晚，每一粒都恰好在 FORM_AT 落定 */
      const wander = Math.random() < 0.14 ? 1 : 0;
      const dur = (T.converge - delay) * (0.72 + Math.random() * 0.28) * (wander ? 0.88 : 1);
      const mx = (fx + tx) / 2, my = (fy + ty) / 2;
      const nx = -(ty - fy), ny = tx - fx;
      const len = Math.hypot(nx, ny) || 1;
      const bend = (Math.random() - 0.5) * Math.min(180, len * 0.35);
      const s = pickColor();
      out.push({
        tx, ty, fx, fy,
        cx: mx + (nx / len) * bend, cy: my + (ny / len) * bend,
        dur, delay, tw,
        size: s.size[0] + Math.random() * (s.size[1] - s.size[0]),
        sprite: s.cv,
        a: 0.55 + Math.random() * 0.30,       // 0.55~0.85：第一帧就清晰可见
      });
    }
    return out;
  }

  const smooth = t => t * t * (3 - 2 * t);
  const easeBack = t => { const c = 1.35; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };

  function drawParticle(q, x, y, core, alpha) {
    /* ⑤ 绘制尺寸 3.0（配合更大的 size）：落定后约 3~6 CSS px 的尘埃点 */
    const d = core * 3.0 * DPR;
    ctx.globalAlpha = alpha;
    ctx.drawImage(q.sprite, x - d / 2, y - d / 2, d, d);
  }

  /* ---- 4. 主循环 ---- */
  function frame(now) {
    if (!startAt) startAt = now;
    const t = (now - startAt) / 1000;

    /* ⑦ 暗版底全程几乎不放亮：「亮起来」整段交给点击后的 .entering，
       这样第一屏只有一次亮度爬升，粒子戏始终是暗底上的一层星尘。 */
    const k = Math.min(1, Math.max(0, (t - T.appear * 0.5) / (T.converge + T.settle)));
    const p = smooth(k);
    if (bg) {
      bg.style.filter =
        'blur(' + (22 - 4 * p).toFixed(1) + 'px)' +          /* 22 → 18，只微动 */
        ' saturate(' + (0.45 + 0.10 * p).toFixed(2) + ')' +
        ' brightness(' + (0.26 + 0.06 * p).toFixed(2) + ')';  /* 0.26 → 0.32 */
    }
    /* ⑥ 真字封顶 0.42：它只负责磨平边缘，粒子才是主角。
       ★ 不允许在这里写到 1 —— 一旦真字全亮，就成了"粒子字 + 真字"两行字叠着。
       英文小字走同一条曲线：整组题献一起浮现、一起停在同一个亮度档。 */
    if (ded) {
      const d = Math.min(1, Math.max(0, (t - T.appear * 0.6) / (T.converge * 0.8)));
      ded.style.opacity = String(Math.min(0.42, d * 0.42));
    }
    if (dedEn) {
      const d = Math.min(1, Math.max(0, (t - T.appear * 0.6) / (T.converge * 0.8)));
      dedEn.style.opacity = String(Math.min(0.42, d * 0.42));
    }

    /* 落定后画布继续以极低亮度缓缓淡出（把画面交还给背景与文案），
       避免粒子字和下方文案同时亮着；到 FORM_AT+1.1s 就彻底收掉 rAF。 */
    const out = t > FORM_AT ? Math.min(1, (t - FORM_AT) / 1.1) : 0;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';

    for (const q of particles) {
      let x, y, core, alpha;
      const tc = T.appear + q.delay;
      if (t < tc) {
        const u = Math.min(1, t / T.appear);
        x = q.dx + Math.sin(t * 0.55 + q.tw) * 40 * DPR;
        y = q.dy + Math.cos(t * 0.46 + q.tw * 1.3) * 30 * DPR;
        core = q.size * 0.85;
        alpha = q.a * (0.30 + 0.45 * u) * (1 - out);
      } else {
        const local = (t - tc) / q.dur;
        const e = local <= 0 ? 0 : local >= 1 ? 1 : easeBack(local);
        const ea = Math.min(1, e);       // 回弹段 e 略 >1，透明度必须钳制
        const b = 1 - e;
        x = b * b * q.fx + 2 * b * e * q.cx + e * e * q.tx;
        y = b * b * q.fy + 2 * b * e * q.cy + e * e * q.ty;
        core = q.size * (2.8 - 1.8 * e);
        alpha = q.a * (0.30 + 0.70 * ea) * (1 - out);
      }
      const breathe = 1 + Math.sin(t * 1.5 + q.tw) * 0.03;
      drawParticle(q, x, y, core * breathe, alpha);
    }
    ctx.globalAlpha = 1;

    if (!formed && t >= FORM_AT) announceFormed();
    /* 画布收掉后彻底停：不 dispatch 任何"结束"事件，这一屏等用户点。
       亮版底的对焦由 app.js 在点击时加 .entering 触发。 */
    if (t < FORM_AT + 1.2) raf = requestAnimationFrame(frame);
    else window.__loaderFinish();
  }

  /* ---- 5. 启动：等字体就绪之后再取点 ---- */
  function boot() {
    if (!loader.isConnected) return;
    W = cv.width  = Math.round(innerWidth * DPR);
    H = cv.height = Math.round(innerHeight * DPR);
    /* ★ 字号与字距直接量 CSS 的最终计算值，而不是复刻 clamp 公式。
       公式一旦和 css 不同步（改过 --title-size 或媒体查询里的覆盖值），
       粒子就会聚到"另一个字号"上去，看着像凝聚错了。
       量 DOM 得到的值永远等于眼睛看到的那一行字。 */
    let fontPx = Math.round(titlePx() * DPR);
    let lsPx = titleLs() * DPR;
    if (ded) {
      const cs = getComputedStyle(ded);
      const fs = parseFloat(cs.fontSize);
      const lsp = parseFloat(cs.letterSpacing);
      if (fs > 0) fontPx = Math.round(fs * DPR);
      if (!isNaN(lsp) && lsp > 0) lsPx = lsp * DPR;
    }
    const cells = collectTargets(fontPx, lsPx);
    if (!cells.length) {           /* 取点失败：静态兜底，停在等点击 */
      loader.classList.add('as-text');
      if (bg) bg.style.filter = 'blur(16px) saturate(.5) brightness(.3)';
      announceFormed();
      return;
    }
    particles = buildParticles(cells);
    raf = requestAnimationFrame(frame);
  }
  const ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  ready.then(boot);
})();
