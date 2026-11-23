/* =========================================================
   首页巡街的小黑猫：走位与"什么时候做什么小动作"的编排
   ---------------------------------------------------------
   分工极清楚：
     · 本文件只负责【走到哪个位置、停多久、此刻切哪个动作状态】
     · 具体动作帧全在 css（cat-step-a/b、cat-bounce、cat-tail-sway…）
   位移写在外层 .loader-cat 的 translate3d，身体动作写在里层各 <g>，
   两套系统不抢同一个属性，不会出现瞬移或抖动。

   ★ 每轮的"路过小节目"随机抽取（张望 / 跳一步 / 坐下 / 舔爪），
     不会每轮都一样；走出右侧后歇 9~17 秒再回来。
   ★ 单次穿越约 15 秒（走路段合计）；进入老街（.entering）立刻收工。
   ★ pointer-events:none + 外层 overflow:hidden：不吃点击、无横向滚动条。
   ========================================================= */
(() => {
  const cat = document.getElementById('loaderCat');
  const loader = document.getElementById('loader');
  if (!cat || !loader) return;

  /* 不做动效的机器上：不放猫出来（CSS 里也已把所有动作帧关掉） */
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const STATES = ['look', 'hop', 'sit', 'lick'];   // 可抽的小节目
  const rnd = (a, b) => a + Math.random() * (b - a);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const width = () => cat.offsetWidth || 140;

  /* 还能不能继续演：节点没了 / 已经进老街，就地收手 */
  function live() {
    return cat.isConnected && loader.isConnected && !loader.classList.contains('entering');
  }

  function setX(x) {
    cat.dataset.x = String(x);
    cat.style.transform = 'translate3d(' + x + 'px,0,0)';
  }

  /* 走到 x（像素）。speed 为基准速度 px/s，rAF 逐帧推进：
     末端自然减速 + 步频轻微起伏，不会出现匀速滑行的机械感。 */
  function walkTo(x, speed) {
    return new Promise(resolve => {
      let last = performance.now();
      const step = now => {
        if (!live()) return resolve();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        let cur = parseFloat(cat.dataset.x || '0');
        const d = x - cur;
        if (Math.abs(d) < 1) { setX(x); return resolve(); }
        const ease = Math.min(1, Math.abs(d) / 46);      // 越接近终点越收力
        const wobble = 1 + Math.sin(now / 420) * 0.16;   // 步频轻微起伏
        setX(cur + Math.sign(d) * Math.min(Math.abs(d), speed * wobble * ease * dt));
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /* 切一个动作状态，维持 ms 后自己解除 */
  function act(cls, ms) {
    if (!live()) return Promise.resolve();
    cat.classList.add(cls);
    return wait(ms).then(() => cat.classList.remove(cls));
  }

  /* 抽 1~2 个小节目，每轮组合都不一样 */
  function pickStops() {
    const pool = STATES.slice();
    const n = 1 + (Math.random() < 0.55 ? 1 : 0);
    const out = [];
    for (let i = 0; i < n && pool.length; i++) {
      out.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
    }
    return out;
  }

  const DUR = { look: 1700, hop: 750, sit: 3200, lick: 2400 };

  async function stroll() {
    if (!live()) return;
    const w = innerWidth, cw = width();

    /* 从左侧自然出现 */
    cat.classList.remove('look', 'hop', 'sit', 'lick');
    setX(-cw - 20);
    cat.classList.add('show');
    await wait(600);

    /* 慢悠悠走进画面中段（走路段合计约 15s 穿越一屏） */
    await walkTo(w * 0.30, 74);
    if (!live()) return;

    const stops = pickStops();
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      await walkTo(w * (0.30 + 0.22 * (i + 1)), s === 'hop' ? 90 : 62);
      if (!live()) return;
      await act('cat-' + s, DUR[s]);
      if (!live()) return;
      await wait(rnd(220, 600));            // 动作之间留一点呼吸
    }

    /* 走完剩下的路，退出画面右侧 */
    await walkTo(w + cw + 20, 96);
    if (!live()) return;
    cat.classList.remove('show');
    await wait(rnd(9000, 17000));           // 歇一阵子再出来，不持续刷屏
    if (live()) stroll();
  }

  /* 视口变了就把猫夹回可见范围（不打断当前动作） */
  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!live()) return;
      const cw = width();
      const cur = parseFloat(cat.dataset.x || '0');
      if (cur > innerWidth - cw * 0.3) setX(Math.min(cur, innerWidth - cw * 0.3));
    }, 200);
  });

  /* 等题献聚字完成后再让它出来，别在开场最忙的时候抢戏 */
  const go = () => { setTimeout(() => { if (live()) stroll(); }, 2200); };
  if (loader.classList.contains('armed')) go();
  else window.addEventListener('loader:formed', go, { once: true });
})();