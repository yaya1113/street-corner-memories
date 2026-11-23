/* =========================================================
   街角记忆 · 主逻辑
   横向拖拽 + 三层视差 + 点亮呼吸灯 + 结局合成
   ========================================================= */

(() => {
  const $ = sel => document.querySelector(sel);
  const storeKey = 'street-corner-memory-v1';

  /* ---------- 状态 ---------- */
  let collected = new Set();
  let finaleShown = false;

  const stageWrap = $('#stageWrap');
  const bgLayer = $('#bgLayer');
  const hitLayer = $('#hitLayer');
  const railThumb = $('#railThumb');
  const finale = $('#finale');
  const toastEl = $('#toast');

  /* ---------- 1. 铺街 ---------- */
  // 背景：真实街景照片，object-fit:cover 铺满舞台
  bgLayer.innerHTML = `<img src="assets/bg-street.jpg" alt="中山路 12 号的黄昏老街" class="bg-img">`;
  bgLayer.style.setProperty('--bg-src', 'url("assets/bg-street.jpg")');
  /* 开场引导页、结局页都用同一条街做虚化背景。
     注意 ①：写在 .css 里的 url() 会相对 CSS 文件位置解析（变成 css/assets/… 而 404），
     所以这里统一用 JS 创建 <style> 注入。只注入 background-image：
     若把整条 background 简写注进来，会把 CSS 里的 `center / cover` 一起覆盖成 size:auto
     —— 背景按原图像素绘制、不再铺满，虚化层就糊成一片看不出街道（曾经的真实故障）。
     注意 ②：只注入给 .finale .finale-bg，不给 .finale 本身：
     两者叠同一张图没有意义，还会让结局页多渲染一次全屏模糊。
     （原 .intro::before 那条已随第二幕删除；开场页的背景改由 .loader-bg / .loader-bg-top 承担，
       它们在 css/ 里用 ../assets 相对路径，不需要 JS 注入。） */
  const bgStyle = document.createElement('style');
  bgStyle.textContent = `
    .finale .finale-bg { background-image: url("assets/bg-street.jpg"); }
  `;
  document.head.appendChild(bgStyle);
  const bgImg = bgLayer.querySelector('.bg-img');

  /* ---------- 1.1 热区节点表 ----------
     ★ 这里的顺序是一个「静默失效」陷阱，务必按下面的写法保持：
       · const hotspotEls 必须【声明】在 layout() 首次被调之前，
         否则 `if (bgImg.complete) layout()` 命中缓存同步执行时抛
         `Cannot access 'hotspotEls' before initialization`（TDZ），整个 IIFE 中断。
       · 但【填充】必须放在热区 DOM 建好之后（见 1.5），
         否则 querySelector 全返回 null —— 不报错，只是 layout() 里
         `if (!el) return` 把所有定位跳过，六个人挤在 (0,0) 的 1px 盒子里点不到。
     结论：声明在这里，填充在 1.5，调用在 1.5 之后。 */
  const hotspotEls = {};

  /* ---------- 1.2 树干上的麻雀 ----------
     手绘风小麻雀（SVG，暖棕色与画面统一），锚在背景图坐标的树干上，
     沿树干来回蹦跳、啄食、理毛，位置随 cover 缩放在 layout() 里换算。 */
  /* ★ 换到 1672×941 的新背景后重标：
     新图的主树干斜穿画面中部偏右（约 x 46%~57%），枝条在 y 26%~34% 一带，
     所以锚点从旧图的 (58.8, 31) 收到树冠左下那根枝条上。 */
  const SPARROW = { x: 55.0, y: 30.0, h: 4.3 };   // 脚底锚点（背景图百分比）与身高（图高的 4.3%）
  const sparrowEl = document.createElement('div');
  sparrowEl.className = 'sparrow';
  sparrowEl.setAttribute('aria-hidden', 'true');
  sparrowEl.innerHTML = `
    <svg viewBox="0 0 100 92" class="sparrow-svg">
      <path d="M62 34 L96 21 L92 40 L64 44 Z" fill="#5d4a35"/>
      <ellipse cx="52" cy="48" rx="26" ry="20" fill="#8a6f52"/>
      <path d="M30 52 Q40 66 56 64 Q46 72 34 64 Q28 58 30 52 Z" fill="#e6d5b4"/>
      <circle cx="34" cy="34" r="15" fill="#7c6244"/>
      <path d="M21 31 Q31 15 47 27 Q37 23 27 32 Z" fill="#55432f"/>
      <path d="M20 36 L9 39 L20 42 Z" fill="#3d2f22"/>
      <circle cx="30" cy="32" r="2.6" fill="#1d1610"/>
      <path d="M42 42 Q60 33 75 46 Q64 58 46 56 Q40 51 42 42 Z" fill="#5d4a35"/>
      <path d="M47 46 Q60 41 70 48" stroke="#4a3a29" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="M46 66 L44 79 M56 66 L56 79" stroke="#3d2f22" stroke-width="2.6" stroke-linecap="round"/>
    </svg>
    <i class="sparrow-shadow"></i>`;
  bgLayer.appendChild(sparrowEl);

  /* ---------- 1.2.1 树叶挂进背景层 ----------
     视差只给 bgLayer / hitLayer 加 transform，叶子若留在 stage-wrap 上，
     鼠标一动背景飘、叶子不动，就像贴在屏幕上的一层贴纸。
     挂进 bgLayer 后自动继承视差；坐标由 layout() 按背景图百分比换算。 */
  const leafWrap = document.getElementById('leafContainer');
  if (leafWrap) bgLayer.appendChild(leafWrap);

  /* 梧桐叶参数表：u/v = 树冠上的位置（背景图百分比），h = 占图高的百分比
     （尺寸随画面等比缩放），r = 基础倾角，t = 摇曳周期。
     位置绕着树干（x≈60%）分布在树冠里。 */
  /* ★ 换到 1672×941 的新背景后，v 全体 ×0.8：
     新图的画幅更高（941/1672 vs 768/1360），同一个 cover 裁切下，
     原来"贴着画面上沿"的叶子会被裁掉，必须按比例往画面中部收。 */
  const LEAVES = [
    { u: 41.9, v:  2.4, h: 1.30, r: -20, t: 5.4 },
    { u: 48.2, v:  4.8, h: 1.10, r:  15, t: 6.2 },
    { u: 54.5, v:  3.2, h: 1.20, r:  -8, t: 5.0 },
    { u: 61.8, v:  5.6, h: 1.00, r:  30, t: 6.8 },
    { u: 69.0, v:  4.0, h: 1.20, r: -12, t: 4.6 },
    { u: 58.1, v: 10.4, h: 1.30, r:   8, t: 7.0 },
    { u: 66.3, v: 12.0, h: 1.10, r: -25, t: 5.8 },
    { u: 46.4, v:  9.6, h: 1.00, r:  40, t: 6.4 },
    { u: 72.6, v: 10.4, h: 0.90, r:  10, t: 5.6 },
    { u: 52.7, v: 15.2, h: 1.20, r:  -5, t: 6.0 },
  ];
  const leafEls = [...document.querySelectorAll('.leaf-sway')];

  /* ---------- 1.3 布局要先于一切读取它的东西存在的状态量 ----------
     ★ 这一段曾被 layout() 的早调（图片命中缓存时同步执行）踩出两个 TDZ 崩溃：
       ① hotspotEls（已上移到 1.1）
       ② maxPan / panX —— layout() 里的窄屏钳制与 applyParallax 都要读它们，
          原来声明在第 110 行附近，早调时直接抛
          `Cannot access 'maxPan' before initialization`，整个 IIFE 中断：
          加载页不消失、人点不动、StreetCorner 接口不存在。冷启动不复现。
     约定：凡是 layout() / applyParallax() 可能读到的 let，都必须声明在 layout() 首次被调之前。 */
  let panX = 0;      // 当前平移量（px，负=往左拖看右侧，正=往右拖看左侧）
  let minPan = 0;    // 平移下限（<=0：背景图右侧溢出量）
  let maxPan = 0;    // 平移上限（>=0：背景图左侧溢出量）
  let panning = false;
  let panStartX = 0, panStartBase = 0;
  let panMoved = false;          // 本次手势是否真的移动过（超过阈值才算拖动）

  /* 呼吸灯直径（占背景图高度的百分比）—— 必须早于 layout() 首次执行声明，
     否则 layout() 里读它会抛 TDZ 报错、整个 IIFE 中断（项目已踩过两次同类坑）。
     44px 是原 CSS 里灯圈的实际大小，按 941px 图高折算 ≈ 4.7%。 */
  const PING_SIZE = 4.7;

  // 热区：坐标全部由 layout() 按「背景图坐标系」换算后写入
  ROLES.forEach(role => {
    /* ---------- 门面热区（先于人物盒子建）----------
       提示条写的是「点击任意一家店铺」，那店招与店面就必须真的能点。
       人物盒子只罩住立绘（且未点亮时几乎不可见），店招在头顶很高的位置，
       两者之间是一大片点不动的背景 —— 实测点店招命中的是 img.bg-img。
       这里为每家店加一块透明门面区（含店招+店面），点击同样能唤醒店主。
       z-index 低于人物盒子：人物本体永远优先，两者重叠时归人物。 */
    if (Array.isArray(role.shop)) {
      const zone = document.createElement('button');
      zone.className = 'shop-zone';
      zone.dataset.role = role.id;
      zone.setAttribute('aria-label', `${role.tag}，点这里叫店主出来`);
      zone.style.left = '0px';
      zone.style.top = '0px';
      zone.style.width = '1px';
      zone.style.height = '1px';
      hitLayer.appendChild(zone);
    }
  });

  ROLES.forEach(role => {
    const btn = document.createElement('button');
    btn.className = 'hotspot';
    btn.dataset.role = role.id;
    btn.style.left = '0px';
    btn.style.top = '0px';
    btn.style.height = '1px';
    btn.style.width = '1px';   // 占位，layout() 里按图片真实比例精算
    // 未点亮时不剧透名字——这是"寻人"的乐趣所在
    btn.setAttribute('aria-label', '这里好像有人，点点看');
    // 初始完全不可见，只留呼吸灯；点击后才出现
    const peek = role.peek ?? 0;
    btn.style.setProperty('--hidden', `${(1 - peek) * 100}%`);
    // 气泡展开方向：靠左的角色向右展开，靠右的向左展开，避免被画面边缘裁掉
    if (role.bub) btn.classList.add(`bub-${role.bub}`);
    // 气泡分层：相邻角色的对话框放在不同高度层，互不重叠
    btn.style.setProperty('--bub-y', `${(role.lane || 0) * 80}px`);
    btn.innerHTML = `
      <span class="char-wrap">
        <span class="char-vis">
          <img class="char-img" src="assets/roles/${role.id}.png" alt="${role.name}">
        </span>
      </span>
      <span class="tip">这里好像有人…</span>
      <span class="speech-bubble"></span>`;
    btn.querySelector('.char-img').addEventListener('load', () => layout());
    hitLayer.appendChild(btn);
  });

  /* ---------- 1.3b 呼吸灯：独立热区节点 ----------
     ★ 为什么从人物盒子里搬出来：
       原来 .ping 锁在 .hotspot 内（left:50% / bottom:.5%），
       位置被人物立绘死死绑住 —— 想让灯落在「店前台阶上」「花坛边」
       「路灯下」这类不在人物正脚下的地方，就得能单独指定坐标。
       现在它是 hit-layer 的直接子节点，用 role.ping = [x, y]（背景图百分比）
       定位，与人物/门面同一套坐标系、同一套视差，点击它照样唤醒对应店主。
       role.ping 缺省时仍落在人物脚下（px/py），保证旧数据不出错。 */
  ROLES.forEach(role => {
    const ping = document.createElement('button');
    ping.className = 'ping-zone';
    ping.dataset.role = role.id;
    ping.setAttribute('aria-label', '这里好像有人，点点看');
    ping.innerHTML = '<span class="ping"></span>';
    hitLayer.appendChild(ping);
  });

  /* ---------- 1.4 视差状态与 applyParallax ----------
     ★ 同样必须早于 layout()：layout() 结尾会调 applyParallax()，
     而原来 curTX / curTY / F / BG_SCALE 声明在 layout() 之后 →
     早调时抛 `Cannot access 'curTX' before initialization`（TDZ），整个 IIFE 中断。
     视差系数：远景 0.55 / 中景 0.78 / 前景 1.0（前景跟手最快）。 */
  const F = { far: 0.55, mid: 0.78, near: 1, hit: 1 };
  const BG_SCALE = 1.02;   // 整体微放大：盖住平移露出的边缘
  const BG_MOVE = 10;      // 背景最大位移（px），越小越不易穿帮
  let mouseTX = 0, mouseTY = 0;   // 目标偏移（-1 ~ 1，相对舞台中心）
  let curTX = 0, curTY = 0;       // 当前偏移（插值后）

  function applyParallax() {
    /* 背景与人物同一变换：panX 窄屏平移也保持两层同步 */
    const dx = panX - curTX * BG_MOVE;
    const dy = -curTY * BG_MOVE * 0.6;
    const tf = `translate3d(${dx}px, ${dy}px, 0) scale(${BG_SCALE})`;
    bgLayer.style.transform = tf;
    hitLayer.style.transform = tf;
  }

  /* ---------- 1.5 节点表填充 + 首次布局 ----------
     顺序：热区 DOM 已建好 → 填充 hotspotEls → 才允许 layout() 跑。
     ★ 选择器必须带 `.hotspot` 类名：门面热区 .shop-zone 也带 data-role
       （命中逻辑要用它反查人物节点），原来的 `[data-role="x"]` 会先匹配到
       门面按钮，把门面误当人物热区 → layout() 里 .speech-bubble 为 null 直接抛错，
       整个 layout() 中断（加载页不消失、人点不动）。 */
  ROLES.forEach(r => hotspotEls[r.id] = hitLayer.querySelector(`.hotspot[data-role="${r.id}"]`));
  if (ROLES.some(r => !hotspotEls[r.id])) {
    console.warn('[街角记忆] 有角色的热区没找到，人物将无法点击：',
      ROLES.filter(r => !hotspotEls[r.id]).map(r => r.id));
  }

  /* 热区都建好、状态量都就绪之后，才做第一次布局（背景图已缓存时是同步的）。
     顺序反了会拿不到节点、或读到还没初始化的 let —— 见 1.1 / 1.3 / 1.4 的注释。 */
  if (bgImg.complete && bgImg.naturalWidth) layout();
  else bgImg.addEventListener('load', () => layout());

  /* ---------- 2. 尺寸与视差 ---------- */
  /* 窄屏横向浏览的平移状态已上移到 1.3（layout() 首次调用之前），这里不再声明。 */
  /* ★★★ 坐标系约定（重要）★★★
     角色的 px / py / ph 一律是「背景图 assets/bg-street.jpg 自身的百分比」，
     也就是 px=10 表示「离背景图左边缘 10% 的位置」，与舞台/视口无关。

     为什么要这样：背景图用的是 object-fit: cover —— 舞台宽高比变化时，
     背景图会等比缩放并居中裁切，图像内容在舞台里的位置会跟着变。
     如果人物按「舞台百分比」定位，缩放一变化，人物就和店铺脱节了。
     所以必须把坐标锚在背景图自己的比例上，再按 cover 的实际映射换算成舞台像素。
  */
  function layout() {
    const w = stageWrap.clientWidth;
    const h = stageWrap.clientHeight;

    // 背景层铺满舞台
    bgLayer.style.width = `${w}px`;
    bgLayer.style.height = `${h}px`;
    hitLayer.style.width = `${w}px`;
    hitLayer.style.height = `${h}px`;

    const iw = bgImg.naturalWidth || 1672;
    const ih = bgImg.naturalHeight || 941;

    /* ---- 统一使用 cover（铺满画面）----
       窄屏竖版时 cover 会裁掉街道两侧，人物随之移出画面 ——
       这是物理必然（画面就那么窄）。此时不做任何位置补偿，
       让人物严格锚在背景图坐标上：只要用户能看到的那部分街道，
       人物就一定站在正确的店铺前。 */
    const fitAll = false;
    stageWrap.classList.toggle('fit-all', fitAll);

    // object-fit: cover → scale 取 max，铺满并居中裁切
    const fitScale = Math.max(w / iw, h / ih);
    const dispW = iw * fitScale;
    const dispH = ih * fitScale;
    const cropX = (w - dispW) / 2;
    const cropY = (h - dispH) / 2;
    const bx = u => cropX + (u / 100) * dispW;
    const by = v => cropY + (v / 100) * dispH;
    const unitH = dispH / 100;

    ROLES.forEach(role => {
      const el = hotspotEls[role.id];
      if (!el) return;
      const img = el.querySelector('.char-img');
      const hPx = role.ph * unitH;              // 高度也按背景图比例 → 缩放时等比
      const cxPx = bx(role.px);
      const footY = by(role.py);
      el.style.height = `${hPx}px`;
      el.style.left = `${cxPx}px`;
      /* ★ 立绘底部到鞋底有 7px 透明留白换算的余量（hPx*0.0092），
         用户的站位校准是在带此补偿的渲染下调出的，必须一起带上，否则鞋底悬空 */
      el.style.top = `${footY - hPx + hPx * 0.0092}px`;
      if (img && img.naturalWidth) {
        el.style.width = `${(img.naturalWidth / img.naturalHeight) * hPx}px`;
      }
      /* ---- 门面热区：同样按背景图百分比铺，与人物层同步视差 ---- */
      const zone = hitLayer.querySelector(`.shop-zone[data-role="${role.id}"]`);
      if (zone && Array.isArray(role.shop)) {
        const [zx0, zy0, zx1, zy1] = role.shop;
        zone.style.left = `${bx(zx0)}px`;
        zone.style.width = `${((zx1 - zx0) / 100) * dispW}px`;
        zone.style.top = `${by(zy0)}px`;
        zone.style.height = `${((zy1 - zy0) / 100) * dispH}px`;
      }
      /* ---- 呼吸灯：role.ping = [x, y]（背景图百分比），缺省落在人物脚下 ----
         y 取的是「灯心」的坐标，尺寸由 CSS 决定，定位时向上提半个灯高，
         这样拖出来的数就是灯正中心落在画面哪里，不用再手算偏移。 */
      const ping = hitLayer.querySelector(`.ping-zone[data-role="${role.id}"]`);
      if (ping) {
        const pxy = Array.isArray(role.ping) ? role.ping : [role.px, role.py];
        const size = PING_SIZE / 100 * dispH;      // 灯直径按背景图高等比
        ping.style.left = `${bx(pxy[0])}px`;
        ping.style.top = `${by(pxy[1])}px`;
        ping.style.width = `${size}px`;
        ping.style.height = `${size}px`;
      }
      /* ---- 气泡水平偏移：role.bubDx（背景图宽度的百分比）----
         王姐站在最右，气泡默认与林姐的横挤在一起、正好压住林姐的立绘，
         整块往右挪一点让开。写进 CSS 变量，.speech-bubble 的 left 就成了
         calc(50% + var(--bub-dx))，下面避让算法按同一个偏移量算水平区间。 */
      el.style.setProperty('--bub-dx', `${((role.bubDx || 0) / 100) * dispW}px`);
    });

    /* ---- 麻雀定位：与人物同一套背景图坐标换算，永远站在树干上 ---- */
    if (sparrowEl) {
      const spH = (SPARROW.h / 100) * dispH;
      sparrowEl.style.left = `${bx(SPARROW.x)}px`;
      sparrowEl.style.top = `${by(SPARROW.y)}px`;
      sparrowEl.style.fontSize = `${spH}px`;   // 蹦跳动画全部用 em，随画面等比缩放
    }

    /* ---- 树叶定位：与麻雀同一套换算，永远长在树冠上 ---- */
    leafEls.forEach((el, i) => {
      const L = LEAVES[i];
      if (!L) return;
      const size = (L.h / 100) * dispH;            // 按背景图高度等比 → 和人物同一套缩放
      el.style.left = `${bx(L.u) - size / 2}px`;   // 表里的坐标是叶心，居中对齐
      el.style.top = `${by(L.v) - size / 2}px`;
      el.style.setProperty('--size', `${size.toFixed(1)}px`);
      el.style.rotate = `${L.r}deg`;
      el.style.setProperty('--t', `${L.t}s`);
      el.style.setProperty('--d', `-${(i * 0.61).toFixed(2)}s`);   // 相位错开，不同时起摆
    });

    /* ---- 气泡防出界 ----
       气泡统一以人物水平中心对齐（CSS 保证：left:50% + translate(-50%)）。
       把「人物身体」和「气泡」里更宽的那个作为需要留在画面内的余量，
       再对人物中心做一次钳制；两者都放不下（极窄屏）时不强钳，保持坐标真实。

       ★★ 2026-10 接地版改动：老版本在这里还有一条「热区永不重叠」的
       左→右推挤规则（每放一个记右边界，下一个必须留 GAP_X）。
       它的唯一目的是防止点击抢人 —— 但新方案里老木/阿Ken 本来就是
       前后重叠站位（同一屋檐下），这条规则会把阿Ken 往右硬推 129px，
       直接拆散设计好的构图。现在点击改用【像素级命中】（见 4. 节
       pickHotspot：按立绘 alpha 逐层判定），盒子重叠不再抢人，
       推挤规则只保留给「被画面钳制拉进来的角色」——只有它们才会
       在极窄屏上挤成一坨，需要拉开间距保证各自可点。 */
    const GAP_X = 6;
    /* 气泡半宽按【设计上限】恒定取值（max-width 238 的半宽 + 余量），不实测：
       未点亮时气泡是空的、宽度为 0，实测会让点亮前后的 need 变化 →
       人物在点亮瞬间整体跳位。恒定值保证布局稳定（点亮只改类名，不改位置）。 */
    const BUB_HALF = 121;
    let edgeL = -Infinity;   // 已放置角色里最靠右的右缘
    let edgeW = 0;           // 该角色的全宽（判断「帽回」会不会把人吞掉）
    [...ROLES].sort((a, b) => a.px - b.px).forEach(role => {
      const el = hotspotEls[role.id];
      if (!el || !el.offsetWidth) return;
      const halfW = el.offsetWidth / 2;
      const cxPx = parseFloat(el.style.left);
      /* 人物与气泡一起保持在画面内：
         ★ 曾经这里按「bodyL/bodyR 优先」只把【人物身体】夹进画面，完全没算气泡 ——
         于是 1440 宽屏下 cobbler 的气泡左边被切 28px（1280 下切 38px），
         fruit 右边同理。现在改用统一余量 need = max(身体半宽, 气泡半宽) + 边距：
         靠边的角色会为了露出气泡而略微移出画面，但"看得见台词"比"半个身子"重要。 */
      const need = Math.max(halfW + 2, BUB_HALF + 6);
      let nx = cxPx;
      if (need * 2 <= w) nx = Math.min(Math.max(cxPx, need), w - need);
      const wasClamped = Math.abs(nx - cxPx) > 0.5;
      /* 只对「被钳制拉离原位」的角色做间距推挤：
         按方案前后重叠站位的（未被钳制）保持原样，交给像素级命中。 */
      if (wasClamped && nx - halfW < edgeL + GAP_X) {
        const pushed = edgeL + GAP_X + halfW;
        /* ★ 推挤 vs 画面边界 的仲裁：
           - 帽回画面内（气泡可见）优先 —— 1440 下 fruit 被邻居推到 1380，
             气泡右边出画，帽回后与 tuina 重叠 64px（63%），可接受；
           - 但帽回不能把已放好的邻居【整个吞掉】—— 414 下无脑帽回会让
             fruit 完全盖住 barber（最上层不透明像素全归 fruit，点不到）。
             规则：吞掉 ≤ 邻居身宽 60% → 帽回；否则放在「恰好吞 60%」的位置
             （宁可气泡探出画面十几像素，也要保住邻居可点）。 */
        const capped = Math.min(pushed, w - need);
        const swallow = edgeL - (capped - halfW);   // 帽回后与右缘邻居的重叠量
        nx = swallow <= edgeW * 0.6
          ? capped
          : Math.max(capped, edgeL - edgeW * 0.6 + halfW);
      }
      if (nx + halfW > edgeL) { edgeL = nx + halfW; edgeW = el.offsetWidth; }
      if (nx !== cxPx) el.style.left = `${nx}px`;
    });

    /* ---- 气泡自动避让（根治手工调 lane 的连环冲突）----
       相邻角色 x 间距常常小于气泡宽度（238px），靠固定错落层无法保证所有视口都不重叠。
       这里在布局时实测每个气泡的真实矩形，与已放置的气泡相交就自动上移，
       直到不再相交或到达画面顶部。
       注意：气泡文案在点亮时才写入，未点亮时高度为 0 —— 所以只在有内容时避让。 */
    const GAP = 10;
    const placed = [];
    // 按人物脚底从低到高处理：位置低（靠画面下方）的先放，靠上的往后排
    const withBub = [];
    ROLES.forEach(role => {
      const el = hotspotEls[role.id];
      if (!el) return;
      const bub = el.querySelector('.speech-bubble');
      const hasText = bub && bub.textContent.trim().length > 0;
      withBub.push({
        role, el, bub, hasText,
        top: parseFloat(el.style.top),
        h: el.offsetHeight,
        dx: ((role.bubDx || 0) / 100) * dispW      // 该角色气泡的水平偏移（见上）
      });
    });
    withBub.sort((a, b) => (a.top + a.h) - (b.top + b.h));   // 脚底 y 小 = 靠画面上方 = 先放

    for (const item of withBub) {
      const { el, bub, hasText, top, dx } = item;
      if (!hasText) {
        bub.style.top = '-9999px';   // 未点亮：气泡不可见
        continue;
      }
      const bubH = bub.offsetHeight || 65;
      const bubW = bub.offsetWidth || 238;   // 实测宽度，不写死
      /* 气泡水平中心 = 人物中心 + bubDx 偏移（与 CSS 的 left:calc(50% + dx) 同源）。
         原来这里写的是「left + 半宽 - 半宽」，等于直接用人物中心、没算偏移。 */
      const cx = parseFloat(el.style.left) + (dx || 0);
      const x0 = cx - bubW / 2;
      const x1 = cx + bubW / 2;

      /* 气泡 top 是【相对热区顶边】的（.hotspot 带 transform，成为包含块）。
         基准位置：气泡顶边贴在人物头顶上方 8px → 相对值 -8 - bubH。
         若与已放置气泡水平相交且垂直重叠，就整块上移一个气泡高度，
         反复直到不相交为止（最多 30 次）。 */
      let relTop = -8 - bubH;
      for (let guard = 0; guard < 40; guard++) {
        const myTop = top + relTop;          // 换算到舞台坐标比较
        const myBot = myTop + bubH;
        // 找出所有水平相交的已放置气泡，取「最高」的那个作为避让目标
        let target = null;
        for (const p of placed) {
          const ox = Math.min(x1, p.x1) - Math.max(x0, p.x0);
          if (ox <= 2) continue;
          const oy = Math.min(myBot, p.y1) - Math.max(myTop, p.y0);
          if (oy > 2 && (!target || p.y0 < target.y0)) target = p;
        }
        if (!target) break;
        // 优先上移到目标气泡正上方；顶到画面上沿则改为下移
        const up = target.y0 - bubH - GAP;
        if (up >= 4) relTop = up - top;
        else relTop = (target.y1 + GAP) - top;
        // 上下都已越界（极端窄屏）：放弃避让，保持基准位置
        if (top + relTop + bubH > h - 4 && top + relTop < 4) {
          relTop = -8 - bubH;
          break;
        }
      }
      // 上下边界钳制（舞台坐标）
      const stageTop = Math.max(4, Math.min(h - bubH - 6, top + relTop));
      bub.style.top = `${stageTop - top}px`;
      placed.push({ x0, x1, y0: stageTop, y1: stageTop + bubH });
    }

    // 平移范围（窄屏浏览整条街用）
    if (typeof updatePanRange === 'function') updatePanRange();

    applyParallax();
  }
  /* ---------- 鼠标视差（镜头推移）----------
     人物与背景使用【完全相同】的位移与缩放：人物始终贴在店铺前，
     不会像悬浮在空气里；整体镜头随鼠标轻微游移产生景深。
     两层同时微放大 2% 防止平移露边，同源缩放保证人物和店铺不错位。
     用 requestAnimationFrame 做阻尼插值（Lerp），移动带惯性、极其丝滑。
     （F / BG_SCALE / BG_MOVE / mouseTX / curTX / applyParallax 已上移到 1.4） */
  stageWrap.addEventListener('mousemove', e => {
    const r = stageWrap.getBoundingClientRect();
    mouseTX = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - .5) * 2));
    mouseTY = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - .5) * 2));
  });
  stageWrap.addEventListener('mouseleave', () => { mouseTX = 0; mouseTY = 0; });

  (function parallaxLoop() {
    /* ★ 阻尼系数 0.06 → 0.16：原来从 0 收敛到目标要 ~0.7s（63% 需 17 帧 ≈ 0.28s），
       鼠标移向人物的这段时间里整条街还在缓慢位移，用户的落指与目标错开几像素，
       表现为"明明点在他身上却没反应"。
       0.16 收敛到 95% 只需 ~0.18s，手感依然是带惯性的跟随，但不再拖泥带水。 */
    curTX += (mouseTX - curTX) * 0.16;
    curTY += (mouseTY - curTY) * 0.16;
    applyParallax();
    requestAnimationFrame(parallaxLoop);
  })();


  /* ---------- 4. 热区交互 ----------
     hotspotEls 的声明已上移到「1.1」（layout() 首次调用之前），这里不再重复声明，
     否则会重复绑定并再次引入 TDZ 风险。 */

  /* ---------- 4.1 窄屏横向浏览 ----------
     手机竖屏时 cover 会把街道两侧裁掉，两端的人物随之落在画面之外。
     这里允许横向拖动/滑动浏览整条街：背景层与人物层同步平移，
     相对位置始终不变（人物不会和店铺脱节）。
     视口够宽时（能看全街）自动关闭，不影响桌面体验。 */
  function updatePanRange() {
    const w = stageWrap.clientWidth;
    const iw = bgImg.naturalWidth || 1672;
    const ih = bgImg.naturalHeight || 941;
    /* cover 是【居中】裁切：图比舞台宽时，左右各溢出一半（cropX < 0）。
       旧算法 maxPan = dispW - w 假设图片左对齐，只允许往左拖 ——
       于是左侧溢出（最左边的店铺）在任何视口都永远拖不回来。
       正确范围：minPan = w - cropX - dispW（看到图右缘），maxPan = -cropX（看到图左缘）。 */
    const fitScale = Math.max(w / iw, stageWrap.clientHeight / ih);
    const dispW = iw * fitScale;
    const cropX = (w - dispW) / 2;
    maxPan = Math.max(0, Math.round(-cropX));
    minPan = Math.min(0, Math.round(w - cropX - dispW));
    panX = Math.max(minPan, Math.min(maxPan, panX));
  }

  stageWrap.addEventListener('pointerdown', e => {
    if (maxPan <= 0) return;
    panning = true;
    panMoved = false;
    panStartX = e.clientX;
    panStartBase = panX;
    stageWrap.classList.add('dragging');
  });
  stageWrap.addEventListener('pointermove', e => {
    if (!panning) return;
    const dx = e.clientX - panStartX;
    // 超过 6px 才算「拖动」，否则只是手指轻触，不该吞掉点击
    if (Math.abs(dx) > 6) panMoved = true;
    if (!panMoved) return;
    hitLayer.dataset.panAt = String(Date.now());
    panX = Math.max(minPan, Math.min(maxPan, panStartBase + dx));
    applyParallax();
  });
  const endPan = e => {
    if (!panning) return;
    panning = false;
    stageWrap.classList.remove('dragging');
    // 拖动结束后再等一小会儿，避免手势末尾误触发点击
    if (panMoved) hitLayer.dataset.panAt = String(Date.now());
  };
  stageWrap.addEventListener('pointerup', endPan);
  stageWrap.addEventListener('pointercancel', endPan);
  stageWrap.addEventListener('pointerleave', endPan);

  /* ---------- 3.6 命中：只认呼吸灯 ----------
     ★★ 2026-10 定案（应要求）：整条街初始只露出每家门口那圈暖光，
       **点灯才有人出来**，其余任何位置都不响应 —— 人物立绘、店铺门面、
       街景空白一律点不出人。理由：
         ① 语义唯一：画面里唯一可见的线索就是灯，「点灯＝唤醒」不会误导；
         ② 视差下最稳：灯的命中区小而实（44px 圆），不像立绘大盒子那样
            容易与邻居重叠、抢走本该落在别人身上的点击。
       命中区从最上层往下找（DOM 靠后者画在上层），重叠时归最上面那盏灯。
       早期那套「按立绘 alpha 逐像素判定 + 盒子回退」的命中已经不再需要，
       一并删除，避免留下两条互相矛盾的判定路径。 */
  function pickHotspot(x, y) {
    const pings = [...hitLayer.querySelectorAll('.ping-zone')].filter(z => {
      if (z.classList.contains('gone')) return false;
      const r = z.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    });
    if (pings.length) return hotspotEls[pings[pings.length - 1].dataset.role];
    return null;
  }

  /* 触摸端点击：拖动后不要误触发「叫人出来」 */
  hitLayer.addEventListener('click', e => {
    // 刚刚发生过拖动 → 视为滚动，不算点击
    if (Date.now() - (hitLayer.dataset.panAt || 0) < 320) return;
    // 键盘触发的 click（回车/空格）没有坐标，按事件目标走（灯或人物盒子都行）
    const h = e.detail === 0
      ? e.target.closest('.ping-zone, .hotspot')
      : pickHotspot(e.clientX, e.clientY);
    if (!h) return;
    openCard(h.dataset.role);
  });
  // 触摸端
  hitLayer.addEventListener('touchend', e => {
    if (Date.now() - (hitLayer.dataset.panAt || 0) < 320) return;
    const t = e.changedTouches[0];
    const h = t ? pickHotspot(t.clientX, t.clientY) : e.target.closest('.ping-zone, .hotspot');
    if (!h) return;
    e.preventDefault();
    openCard(h.dataset.role);
  });

  /* ---------- 5. 角色卡 ---------- */
  function openCard(id) {
    const role = ROLES.find(r => r.id === id);
    if (!role) return;

    // 人物从店里走出来，并开口说话（气泡常驻，不自动消失）
    const hs = hotspotEls[id];
    if (hs) {
      const bubble = hs.querySelector('.speech-bubble');
      if (bubble) bubble.textContent = `「${role.quote}」`;
      hs.classList.add('out', 'speaking', 'revealing');
      setTimeout(() => hs.classList.remove('revealing'), 700);
      const tip = hs.querySelector('.tip');
      if (tip) tip.textContent = `${role.tag} · ${role.name}`;
      // 气泡文案刚写入，重新布局一次让自动避让算法生效
      requestAnimationFrame(() => layout());
    }

    // 直接归档并更新进度（不再弹档案卡）
    archive(id);
  }







  /* ---------- 5.5 招牌线索 ---------- */
  /* 背景是真实街景图，不再有 SVG 广告热区；热区本身即为入口 */

  /* ---------- 6. 收集与点亮 ---------- */
  function archive(id) {
    if (collected.has(id)) return;
    collected.add(id);

    const role = ROLES.find(r => r.id === id);
    // 热区点亮（这时才剧透名字），并保持走出来的状态
    const hs = hotspotEls[id];
    if (hs) {
      hs.classList.add('lit', 'out');
      /* ★ 标签只写人名，不再写「店名 · 人名」：
         新背景的招牌就挂在人物头顶，再复述一遍店名是重复信息，
         而且两段文字一长，标签就会压到脚下的人行道和花箱上。 */
      hs.querySelector('.tip').textContent = role.name;
    }
    // 呼吸灯：人被唤醒后灯就该灭（灯是"还没出来"的唯一线索）
    hitLayer.querySelector(`.ping-zone[data-role="${id}"]`)?.classList.add('gone');
    // 灯笼点亮
    document.getElementById(`lantern-${id}`)?.classList.add('lit');
    // 卡片标记

    save();
    updateProgress();
    showToast(`已点亮 ${role.name}　${collected.size}/${TOTAL_ROLES}`);

    /* ★ 轻触唤醒：把「谁被唤醒了 + 进度」写到提示条上（逐家探索，不必一次全开） */
    if (collected.size === TOTAL_ROLES) {
      showStageHint('六位街坊都出来了 · 这条街的记忆齐了');
    } else {
      showStageHint(`「<b>${role.name}</b>」被你唤醒了　${collected.size}/${TOTAL_ROLES}`);
    }

    /* ★ 关系网：点亮社交枢纽后，整条街的痕迹都会亮起来。
       台词「这条街上的人，我都熟！」已于 2026-10 晚按要求删除 ——
       痕迹联动（has-liu）保留，只是不再弹那句话。
       showRelation() 与 #relationNote 节点一并留着备用：
       以后若要别的说法，改这一处调用即可，不必重建机制。 */
    if (role.socialHub) {
      stageWrap.classList.add('has-liu');
    }

    if (collected.size === TOTAL_ROLES) {
      setTimeout(triggerFinale, 900);
    }
  }

  /* 关系网提示条（停留几秒后自动消失） */
  let relTimer;
  function showRelation(text) {
    const el = $('#relationNote');
    el.innerHTML = `<span style="color:var(--gold);font-size:15px">🍎</span> ${text}`;
    el.classList.add('show');
    clearTimeout(relTimer);
    relTimer = setTimeout(() => el.classList.remove('show'), 6000);
  }

  function updateProgress() {
    const pct = (collected.size / TOTAL_ROLES) * 100;
    $('#progressFill').style.width = `${pct}%`;
    $('#progressCount').textContent = `${collected.size}/${TOTAL_ROLES}`;
  }

  /* ---------- 7. 存档 ---------- */
  function save() {
    try {
      localStorage.setItem(storeKey, JSON.stringify({
        collected: [...collected],
        at: Date.now()
      }));
    } catch (e) { /* 隐私模式下可能失败，忽略 */ }
  }
  function load() {
    /* ★ 进入街道页永远呈现「初始状态」：背景图 + 呼吸灯，不自动恢复点亮。
       上次通关后的「全部点亮」街道，只在总结页点「回看街道」时呈现。
       点亮进度不再开机自动应用（存档仍会写入，供「重走」判断与进度显示）。 */
    return false;
  }

  /* ---------- 8. 结局 ---------- */
  function triggerFinale() {
    if (finaleShown) return;
    finaleShown = true;

    // 夜幕 + 全街点灯
    stageWrap.classList.add('act-night');
    ROLES.forEach(r => document.getElementById(`lantern-${r.id}`)?.classList.add('lit'));

    // 环形轨道：6 位街坊均匀分布（位置由 updateCarousel 计算）
    const wheel = $('#turntable');
    wheel.innerHTML = ROLES.map(r => `
      <div class="character" data-story="${r.id}"
           role="button" tabindex="0" aria-label="查看${r.name}的故事">
        <div class="avatar-wrap">
          <div class="ring"><img src="assets/roles/${r.id}.png" alt="${r.name}"></div>
          <div class="name-tag"><b>${r.name}</b><i>点击观看故事</i></div>
        </div>
      </div>`).join('');
    /* 立绘宽高比在这里量一次并缓存（自动量，不手抄数字）。
       量不到（图片还没 decode）时先用 0.7 占位，
       每张图 load 完再触发一次 updateCarousel 自我修正。
       直接写 ttAspects（带 tt 前缀），不要起 `aspects` 这种通用别名 ——
       同作用域里另有一处 CT_RING 相关的 aspects 同名概念，容易串。 */
    ROLES.forEach(r => ttAspects.set(r.id, 0.7));
    [...wheel.children].forEach(el => {
      const img = el.querySelector('img');
      const measure = () => {
        if (img.naturalWidth && img.naturalHeight) {
          ttAspects.set(el.dataset.story, img.naturalWidth / img.naturalHeight);
          updateCarousel();
        }
      };
      if (img.complete) measure();
      else img.addEventListener('load', measure, { once: true });
    });

    // 先全部隐藏，下一帧再滑入，做出入场淡入
    [...wheel.children].forEach(el => { el.style.setProperty('--o', '0'); });
    /* .ring 已改成固定高度，六个人不依赖立绘宽高比，无需等图片加载完再标定。
       但仍留一帧 rAF —— 让 CSS 先把 opacity 从 0 铺好，再由 updateCarousel 接管。 */
    requestAnimationFrame(() => requestAnimationFrame(updateCarousel));

    finale.classList.add('show');
    /* 根节点状态类：结局页在场时右下角「关于」回落到 16px 与「回看街道」上下排列；
       街道阶段（无此类）「关于」抬高到 60px —— 1280 宽度下右下角正好压着王姐的呼吸灯，
       灯会被按钮吃掉点击（CSS 侧见 .about-btn 的 :not(.finale-on) 规则）。 */
    document.documentElement.classList.add('finale-on');
  }

  const ttAspects = new Map();

  /* ---------- 8.05 2.5D 椭圆轨道转盘 ----------
     人物永远正面朝屏幕，绝不旋转（不会压成纸片）；
     左右箭头 / ← → 键每次精准转 1/6 圈，CSS transition 自带阻尼感。

     ★★ 这里为什么不用 sin/cos 排布 ★★
       原实现是 x = sin(a)*rx、a = (rel/N)*2π。用 6 个人时：
         rel=1 → sin60° = 0.866      rel=2 → sin120° = 0.866
       **两个不同的人被算到同一个 x 上**，必然交叠；
       再叠上「宽扁立绘被 .ring 方框压矮」，就出现了「两边大、中间小」。
       圆上取 x 投影本来就会两两重合（sinθ = sin(180°-θ)），
       所以这里彻底放弃三角排布，改成【显式分档表】：
         SLOT_X  横向占位（乘 rx）   —— 最后一档回 0，即「正后方那位」
         RANK_S  缩放                —— 只按档位，不乘任何 per-character 系数
         RANK_O  透明度 / RANK_LIFT 后排上抬（做出后退的观感）

     ★ 为什么不需要「宽高比归一化系数」★
       病根确实是立绘宽高比差 2.1 倍（barber 287×760=0.378 ~ fruit 613×760=0.807），
       但根因是 .ring 原本是 172×172 方框 + object-fit:contain：
       宽扁的立绘被「高」限制、细长的被「宽」限制，同一 scale 下渲染高度差 2.3 倍。
       现在 .ring 高度由 --ring-h 统一指定、宽度自适应，宽高比不再影响渲染高度，
       实测六张立绘的人物高度占比都在 97.5%~98.0%（画布留白仅 2%）。
       ★ 因此这里【刻意不乘任何 per-character 系数】：
         试过 fix = min(aspect)/aspect 归一化，结果反而更糟 ——
         fix 的变化幅度（2.1 倍）与 depth 的幅度（2.1 倍）同量级，
         相乘后排序被立绘宽高比主导，深度彻底失效：
         实测 barber 在中层（depth .25）拿到 scale 0.61，
         反而超过正前方的 cobbler（depth 1.0 → 0.47）——正是它要修的反面。
         同理 max/aspect 的写法更错：会把最细长的 barber 乘上最大系数。 */

  /* 分档表：档位 0 = 正前方，1 = 中前，2 = 中层，3 = 正后方 */
  const RANK_S    = [1.00, 0.76, 0.60, 0.50];
  /* ★ RANK_O 同时是「默认有多透明」：人物在鼠标靠近前是半透明的，
     靠近（悬停）时由 CSS 的 .character:hover 提到 1 并点亮。
     这几个值写进 CSS 变量 --o，不再直接写内联 opacity ——
     内联样式会盖掉 :hover，导致"怎么悬停都不亮"。 */
  const RANK_O    = [0.82, 0.58, 0.42, 0.28];
  const RANK_LIFT = [0, 10, 18, 24];
  const SLOT_X    = [0, 0.50, 0.92, 0];   // 档 3 横向回 0 = 躲在正前方身后
  const SLOT_PAD  = 22;                    // 相邻两人之间至少留的缝隙（px）
                     /* 取 22 而不是 16：约束算出来的间距是"刚好等于下限"，
                        浏览器的小数像素取整会吃掉零点几像素，
                        16 太紧时会实测出 -1~2px 的交叠（假阴性）。 */
  /* key 是角色 id 字符串，所以 ttAspects 必须用 Map（声明在上方）——
     WeakMap 只接受对象做 key，传字符串会直接抛
     "Invalid value used as weak map key"，整个 updateCarousel 挂掉、
     六个人全停在初始状态。别用 WeakMap 存字符串 id。 */
  const ttState = { idx: 0 };   // 当前站在正前方的角色索引

  function updateCarousel() {
    const wheel = $('#turntable');
    const box = $('#turntableContainer');
    if (!wheel || !box) return;
    const chars = wheel.children;
    const N = chars.length;
    if (!N) return;

    const prev = $('#prevBtn'), next = $('#nextBtn');
    const boxRect = box.getBoundingClientRect();
    /* 窄屏（≤640）只留「中前 + 正前 + 中前」三位 —— 方案 B。
       原因很硬：414px 宽的屏上，六个 100px 宽的人加上左右箭头必然互相压住，
       收窄后排也救不回来（收窄会把后排压到中心，三个人叠成一坨）。
       宽屏则六位全留（方案 A：后排按 SLOT_X 收窄 + 按档位缩小）。
       ★ 方案 B 顺带解决的另一个问题：三位时人物只占中间一小块，
         左右两侧被箭头让出的空档全是浪费。把箭头挪到容器外面去，
         整条可视宽度就都归人物用了。 */
    const narrow = boxRect.width <= 640;
    box.classList.toggle('narrow', narrow);
    const maxRank = narrow ? 1 : 3;
    const visible = [];
    for (let i = 0; i < N; i++) {
      const off = ((i - ttState.idx) % N + N) % N;    // 0 = 正前方
      const rel = off > N / 2 ? off - N : off;        // 映射到 -N/2..N/2
      const rank = Math.min(Math.abs(rel), 3);
      visible.push({ el: chars[i], id: chars[i].dataset.story, rel, rank });
    }

    /* ---- 立绘统一高度（--ring-h）与 rx 全部由实测反解，不手抄数字 ----
       要同时满足两个约束：
         (A) 相邻两人不重叠：  |fx_i - fx_j| * rx ≥ halfW_i + halfW_j + PAD
         (B) 不压到左右箭头：  |fx_i| * rx + halfW_i ≤ arrowRoom
       halfW = H * aspect * RANK_S / 2，对 H 线性。
       所以「给定 H 能否排下」是个单调判定：H 越大越排不下。
       于是直接二分找【能排下的最大 H】，天然满足「在约束内把人物放到最大」，
       比手写比例缩放公式可靠（之前那版把 fx 和半宽混算，直接把 H 压到了下限）。 */
    const probe = chars[0].querySelector('img');
    if (!probe) return;
    /* H_MAX 从 178 提到 340 —— 原来那个 178 是【随手定的经验值】，不是解算结果。
       实测（scan-H.js 自动量）：真正的天花板在两处，取小者
         · 横向：1920 下所需 rx 与 rx 上限在 H≈380 处相遇（arrowRoom=500）
         · 纵向：锚点在容器中心（top 453/420），人物自锚点向上延伸 H，
                 到 H≈340 时顶端仍在容器上沿之内
       所以 340 是安全上限，仍由下面的二分 + 约束判定兜底，
       窄屏会因 arrowRoom 只有 171 自动被压回 147 附近，不会溢出。 */
    const H_MAX = 340, H_MIN = 64;

    /* 箭头内侧到【容器中心】的真实留空（自动量，跟着布局走）。
       ★ 口径坑：这里必须从中心量，不能从容器左边缘量 ——
         箭头是 .turntable-container 的子元素，position 相对容器，
         1920 下容器 max-width 只有 1200 且居中，箭头距容器左边缘仅 38px；
         若拿「箭头右缘 - 容器左缘」当可用空间，会得出 92px 的假上限，
         把立绘一路压到 64px 下限（这正是之前 H 卡在下限的原因）。
         人物锚点在容器中心，所以可用半径 = 中心到箭头内缘的距离。 */
    const cxBox = (boxRect.left + boxRect.right) / 2;
    const leftRoom  = cxBox - prev.getBoundingClientRect().right;
    const rightRoom = next.getBoundingClientRect().left - cxBox;
    // 窄屏时箭头已被移出容器（.narrow），此时可用半径就是容器半宽
    const arrowRoom = narrow
      ? Math.max(40, boxRect.width / 2 - 12)
      : Math.max(28, Math.min(leftRoom, rightRoom) - 8);

    const halfAt = (H, it) =>
      H * (ttAspects.get(it.id) || 0.7) * RANK_S[it.rank] / 2;

    // 可见的人按横向占位 fx 排序（同 fx 的靠 z/y 分离，不参与相邻判定）
    const items = visible.filter(it => it.rank <= maxRank)
      .map(it => ({ ...it, fx: Math.sign(it.rel) * SLOT_X[it.rank] }))
      .sort((a, b) => a.fx - b.fx);

    /* 给定 H，返回 { ok, rx }：rx 取「刚好排下」的值。
       若 B 约束先撞线（说明箭头太近），返回 ok=false 让上层降 H。 */
    function solve(H) {
      // (A) 相邻不重叠 → rx 下限
      let rx = 0;
      for (let i = 1; i < items.length; i++) {
        const dx = items[i].fx - items[i - 1].fx;
        if (dx <= 0.001) continue;
        const need = (halfAt(H, items[i]) + halfAt(H, items[i - 1]) + SLOT_PAD) / dx;
        if (need > rx) rx = need;
      }
      if (!rx) rx = 0;                       // 只有一人在正前方，不需要横向间距
      // (B) 不压箭头 → rx 上限（对每个非零 fx 各自给一个上限，取最小）
      let rxCap = Infinity;
      for (const it of items) {
        const f = Math.abs(it.fx);
        // fx=0（正前 / 正后那位）不占横向，但仍要保证它自己没碰到箭头：
        // 它就在中心，箭头在两侧，只有 H 过大时才可能碰上，用半宽直接判。
        if (f < 0.001) {
          if (halfAt(H, it) > arrowRoom - 40) return { ok: false, rx, cap: 0 };
          continue;
        }
        rxCap = Math.min(rxCap, (arrowRoom - halfAt(H, it)) / f);
      }
      if (rxCap < 40) return { ok: false, rx, cap: rxCap };   // 箭头太近，H 再小也塞不下
      return { ok: rx <= rxCap, rx: Math.min(rx, rxCap), cap: rxCap };
    }

    // 二分：找能排下的最大 H
    let lo = H_MIN, hi = H_MAX, best = H_MIN, rx = 0;
    if (solve(H_MIN).ok) {
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        const r = solve(mid);
        if (r.ok) { best = mid; rx = r.rx; lo = mid; } else { hi = mid; }
      }
      if (!rx) rx = solve(best).rx;
    } else {
      best = H_MIN; rx = solve(H_MIN).rx;
    }
    /* rx 取「刚好排下」的最小值会把六个人挤在中间一小块、左右留大片空白
       （实测 rx=296 而可用半径有 500）。这里在不动 H 的前提下把 rx 吃满到
       rxCap —— 即最外侧那位的边缘正好抵住箭头内缘（arrowRoom 已含 8px 余量）。
       能吃满的前提是 solve 已判定 ok，即 rxCap ≥ 不重叠所需的下限；
       一旦吃满，相邻间距只会更宽松，不会反过来造成交叠。 */
    const cap = solve(best);
    /* 硬上限 470 提到 560：它原来只是"别把人甩到天边"的经验值，
       而真约束（cap = 箭头内缘到中心的距离）已经算好了 ——
       1920 下 cap 有 508，写死 470 等于凭空砍掉 38px。
       交给 cap 兜底即可，硬上限只保留一个防呆值。 */
    if (cap.ok) rx = Math.max(rx, Math.min(cap.cap, 560));
    box.style.setProperty('--ring-h', Math.round(best) + 'px');
    // 调试钩子：验证脚本读它来核对解算结果（排查"约束算对了但实际仍重叠"）
    box.dataset.ttRx = rx.toFixed(1);
    box.dataset.ttRoom = arrowRoom.toFixed(0);
    box.dataset.ttW = boxRect.width.toFixed(0);

    /* 抬升缩放系数提到循环外（每帧算一次就够了，别在六人循环里重复除） */
    const liftK = best / 178;

    for (const it of visible) {
      const { el } = it;
      if (it.rank > maxRank) {            // 窄屏下退场的那几位
        el.style.display = 'none';
        continue;
      }
      el.style.display = '';
      const x = Math.sign(it.rel) * SLOT_X[it.rank] * rx;
      /* 越靠后越往上抬（贴地俯视轨道：远的人站在"更高"的地面上）。
         ★ RANK_LIFT 必须随 H 等比放大：抬升量表达的是"同一块地面上，
         站得远的人视平线更高"—— 这是【相对量】。
         H 从 178 提到 340 后若仍抬 10/18/24px，
         后排四人的视平线会挤在正前方脚下，看着像同一排站在平地上，
         2.5D 的纵深感直接塌掉。按 H/178 等比缩放。 */
      const ty = -RANK_LIFT[it.rank] * liftK;
      el.style.transform =
        `translate(${x.toFixed(1)}px, ${ty}px) scale(${RANK_S[it.rank].toFixed(3)})`;
      /* 默认透明度写进变量（CSS: .character{opacity:var(--o)}），
         这样 :hover 的「点亮到 1」才有机会生效 —— 直接写内联 opacity 会压掉悬停态。 */
      el.style.setProperty('--o', RANK_O[it.rank].toFixed(2));
      el.style.zIndex = String(40 - it.rank * 10);
      el.classList.toggle('front', it.rank === 0);
      /* 把档位写进 dataset：验证脚本要按「同一档」找左右对称的两人来比对高度。
         之前脚本靠「中心距接近」猜对称对，在新排布下会误把不同档配成一对。 */
      el.dataset.rank = String(it.rank);
    }
  }

  $('#prevBtn').addEventListener('click', () => {
    ttState.idx = (ttState.idx - 1 + ROLES.length) % ROLES.length;
    updateCarousel();
  });
  $('#nextBtn').addEventListener('click', () => {
    ttState.idx = (ttState.idx + 1) % ROLES.length;
    updateCarousel();
  });
  // 键盘方向键：答辩时可完全脱手操作
  document.addEventListener('keydown', e => {
    /* 故事卡开着时，← → 翻的是一个个人物；否则才是转盘转圈。
       顺序不能反：故事卡本身是从转盘点开的，finale 一定也在 show 状态。 */
    if ($('#storyPanel').classList.contains('show')) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); storyStep(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); storyStep(1); }
      return;
    }
    if (!finale.classList.contains('show')) return;
    if (e.key === 'ArrowLeft') $('#prevBtn').click();
    else if (e.key === 'ArrowRight') $('#nextBtn').click();
  });
  window.addEventListener('resize', updateCarousel);

  /* ---------- 8.1 头像点击 → 展开人物故事（右立绘 + 左文字） ---------- */
  let storyId = null;      // 当前故事卡里是谁（左右箭头据此翻页）
  function openStory(id) {
    const role = ROLES.find(r => r.id === id);
    if (!role) return;
    storyId = role.id;
    $('#storyTitle').textContent = role.name;
    $('#storySub').textContent = `${role.tag} · ${role.title}`;
    /* 右侧大立绘：全彩、站在卡面上（取代早先那张压淡的「背景水印」） */
    const fig = $('#storyFigure');
    if (fig) fig.innerHTML = `<img src="assets/roles/${role.id}.png" alt="">`;
    /* 引言框只保留台词，正文接故事，最后一行是性格微文案。
       ★ 尾句前的 🍎 已按要求去掉（只在 CSS 里，见 .story-murmur::before）。 */
    $('#storyBody').innerHTML =
      `<div class="story-lead"><p>「${role.quote}」</p></div>`
      + `<p>${role.story || role.bio}</p>`
      + `<p class="story-murmur">${role.murmur}</p>`;
    $('#storyPanel').classList.add('show');
  }
  function closeStory() {
    $('#storyPanel').classList.remove('show');
  }
  /* 左右箭头：在故事卡里直接翻到下一位街坊（循环），不必退回全景页再点人 */
  function storyStep(dir) {
    if (!storyId) return;
    const i = ROLES.findIndex(r => r.id === storyId);
    if (i < 0) return;
    openStory(ROLES[(i + dir + ROLES.length) % ROLES.length].id);
  }
  $('#storyPrev').addEventListener('click', () => storyStep(-1));
  $('#storyNext').addEventListener('click', () => storyStep(1));

  $('#turntable').addEventListener('click', e => {
    const cell = e.target.closest('.character');
    if (cell) openStory(cell.dataset.story);
  });
  $('#turntable').addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const cell = e.target.closest('.character');
    if (cell) { e.preventDefault(); openStory(cell.dataset.story); }
  });
  $('#storyPanel').addEventListener('click', e => {
    if (e.target === e.currentTarget || e.target.classList.contains('story-close')) closeStory();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('#storyPanel').classList.contains('show')) closeStory();
  });

  $('#againBtn').addEventListener('click', () => {
    finale.classList.remove('show');
    document.documentElement.classList.remove('finale-on');
    // 从总结页返回街道：保持人物全部点亮的状态，恢复正常光线方便重新看看这条街
    stageWrap.classList.remove('act-night');
  });

  /* ---------- 9.5 确认对话框（替代浏览器原生 confirm）---------- */
  /* 原生 confirm 是系统灰色小窗，和牛皮纸复古风完全不搭。
     这里用同一套设计语言重写：牛皮纸卡片 + 招牌红 + 楷体。 */
  const dlgMask = $('#dlgMask');
  let dlgResolve = null;

  function askConfirm(text, opts = {}) {
    const {
      title = '确定要这么做吗',
      okText = '确定',
      cancelText = '再想想',
      danger = false
    } = opts;
    $('#dlgTitle').textContent = title;
    $('#dlgText').textContent = text;
    const okBtn = $('#dlgOk');
    okBtn.textContent = okText;
    okBtn.classList.toggle('primary', danger);
    $('#dlgCancel').textContent = cancelText;
    dlgMask.classList.add('show');
    return new Promise(resolve => { dlgResolve = resolve; });
  }
  function closeDlg(result) {
    dlgMask.classList.remove('show');
    const fn = dlgResolve;
    dlgResolve = null;
    if (fn) fn(result);
  }
  $('#dlgOk').addEventListener('click', () => closeDlg(true));
  $('#dlgCancel').addEventListener('click', () => closeDlg(false));
  // 点遮罩空白处 = 取消
  dlgMask.addEventListener('click', e => {
    if (e.target === dlgMask) closeDlg(false);
  });
  document.addEventListener('keydown', e => {
    if (!dlgMask.classList.contains('show')) return;
    if (e.key === 'Escape') closeDlg(false);
    else if (e.key === 'Enter') closeDlg(true);
  });

  /* ---------- 10. 工具条 ----------
     「导出记忆」功能整条已移除（HUD 与结局页两处按钮、绑定与绘图函数一并删净），
     左上角现在只剩「音乐 / 重走」两个符号钮。 */
  $('#resetBtn').addEventListener('click', async () => {
    const ok = await askConfirm(
      collected.size
        ? `已经点亮了 ${collected.size} 位街坊。确定要清空他们的记忆，重新走一遍吗？`
        : '这条街还没开始走，确定要重新开始吗？',
      { title: '重走这条街', okText: '清空重来', danger: true }
    );
    if (!ok) return;
    collected.clear();
    localStorage.removeItem(storeKey);
    document.querySelectorAll('.hotspot.lit').forEach(e => e.classList.remove('lit', 'out', 'speaking', 'revealing'));
    /* ★ 呼吸灯也要复活：唤醒人物时灯被加了 .gone（display:none），
       重来时若不清掉，灯就永久消失、人物再也点不出来（已踩坑）。 */
    document.querySelectorAll('.ping-zone.gone').forEach(e => e.classList.remove('gone'));
    document.querySelectorAll('.lantern.lit').forEach(e => e.classList.remove('lit'));
    stageWrap.classList.remove('act-night');
    finaleShown = false;
    updateProgress();
    showToast('已清空，重新走一遍吧');
  });

  /* ---------- 11. 第一屏：一屏三拍，全部发生在 #loader 里 ----------
     星尘聚字 → 字定格 → 文案与按钮浮现，都是同一屏（见 js/loader-fx.js 与 css 的第一屏段）。
     原第二幕 .intro 卡片已删除，所以这里没有"跳到下一屏"这一步：
     粒子演完就停在那一屏，等用户点击「开始走这条街」再进街道页。 */
  load();
  /* 开场期间隐藏街道页的控件（音乐/重走/进度）：
     它们的语义都是"已经开始走这条街之后"的，第一屏露出来只会抢注意力。
     见 .app.booting 规则。 */
  const appEl = document.querySelector('.app');
  /* ★ 第一屏是 fixed 全屏、铺满整个窗口，街道页本来就被它盖住了，
     所以 .booting 不需要等用户点击才摘 —— 立刻摘掉，
     否则一旦 enterStreet 的淡出被中断（脚本异常/提前 remove），
     顶栏 HUD 会永久停在 opacity:0，看起来就是"顶栏消失了"。 */
  if (appEl) appEl.classList.remove('booting');
  const loaderEl = $('#loader');
  let entered = false, armed = false;

  /* 只有这一条路进街道页：按钮点击、整屏点击、Enter/Esc 都走它，
     避免多处重复写淡出与 remove。
     ★ 顺序很关键：先加 .entering 让背景「亮起来」对焦 0.55s，
       再淡出 1.4s 进街道页 —— 一气呵成，不给"点了却没反应"的空窗。 */
  function enterStreet() {
    if (entered || !loaderEl || !loaderEl.isConnected) return;
    entered = true;
    /* entered 必须最后再置位（或用 try/finally 保护）：
       它一旦为真就永久锁死后续所有进入尝试，
       所以不能放在任何可能抛错的调用之前 —— 否则中间抛一次，
       按钮就变成「点了没反应」且再也救不回来。 */
    try {
      if (window.__loaderFinish) window.__loaderFinish();   // 停掉 rAF，别让后台还画
    } catch (err) {
      console.warn('[loader] __loaderFinish 调用失败，不影响进入', err);
    }
    loaderEl.classList.add('entering');
      /* ★ 背景音乐在这里起播 —— 这一次点击是全站第一个用户手势，
         浏览器只认它。没有这一步，play() 会被策略拒绝（无声）。 */
      if (window.__bgmUnlock) { try { window.__bgmUnlock(); } catch (e) { /* 忽略 */ } }
    setTimeout(function () {
      loaderEl.style.transition = 'opacity 1.4s ease';
      loaderEl.style.opacity = '0';
      loaderEl.style.pointerEvents = 'none';
      if (appEl) appEl.classList.remove('booting');
      setTimeout(() => loaderEl.remove(), 1500);
      /* 方案一：街道载入完成后弹出「点击店铺」引导条；
         8 秒没点，换一句更具体的提示（保留探索感，不一次说全） */
      setTimeout(() => {
        showStageHint();
        setTimeout(() => {
          if (collected.size === 0)
            showStageHint('找找地上那些<b>微微发光</b>的地方，点一下');
        }, 8000);
      }, 1500);
    }, 550);
  }

  /* 「可进入」的闸门：必须等 loader-fx.js 播报成形。
     粒子还在飞的时候点一下就穿过去，会看到字突然被切断。 */
  function arm() {
    if (armed || !loaderEl || !loaderEl.isConnected) return;
    armed = true;
    loaderEl.classList.add('armed');
    /* 焦点交给按钮：键盘用户回车即可，Tab 也不会落在被盖住的街道页控件上 */
    const btn = $('#loaderEnter');
    if (btn) { try { btn.focus({ preventScroll: true }); } catch (_) { btn.focus(); } }
  }
  window.addEventListener('loader:formed', arm);

  /* ★★ 事件竞态（真bug，曾让手机端完全进不去）★★
     窄屏（innerWidth < 820）或prefers-reduced-motion 下，
     loader-fx.js 走 as-text 静态降级分支，在它自己的 IIFE 里【同步】派发
     loader:formed。而本文件的监听器是在 DOMContentLoaded 之后才注册的，
     那一刻事件早已派发完毕 —— 监听器永远等不到。
     症状极具迷惑性：
       · loader 上确实有 .armed 类（那是 loader-fx 自己加的，看着一切正常）
       · 按钮可见、可点、命中测试也对
       · 但 armed 这个局部变量仍是 false，处理器 if (armed) 直接空转
       · 表现为「点了没反应」，窄屏下宽度再小也永远卡在第一屏
     修法：闸门不再信任局部变量，改问 DOM ——「loader 上有没有 .armed 类」。
     事件仍作为主路径，DOM 查询兜住丢失的情况，两者幂等。 */
  function isArmed() {
    return armed || !!(loaderEl && loaderEl.isConnected && loaderEl.classList.contains('armed'));
  }
  // 补一次：若事件在监听器注册前就派发过了，这里立刻把闸门对齐
  if (loaderEl && loaderEl.classList.contains('armed')) arm();

  const enterBtn = $('#loaderEnter');
  if (enterBtn) {
    enterBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (isArmed()) enterStreet();
    });
    /* 按钮上按下时也别在脚下冒光点（click 已被 stopPropagation，
       但 pointerdown 阶段还没拦住，这里补一层） */
    enterBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  }
  /* 首屏点击：只泛起暖色光点（复用街道页的 #tapGlow，首屏用 .soft 小号柔光版），
     不再进入下一页。进入街道的唯一入口是「走进这条街」按钮。
     ★ 用 pointerdown 而不是 click：粒子画布会吃掉部分 click，
       实测"点了没反应"的失灵基本都出在这里。 */
  if (loaderEl) loaderEl.addEventListener('pointerdown', function (e) {
    if (e.button) return;                                  // 只响应左键 / 触屏
    if (e.target.closest('#loaderEnter')) return;           // 按钮自己的光点不要
    const glow = $('#tapGlow');
    if (!glow) return;
    /* loader z-index 900 高于光斑默认的 400：临时提到最上层，
       播完动画立刻还回去，免得影响街道页的层级关系 */
    glow.style.zIndex = '950';
    glow.style.setProperty('--gx', e.clientX + 'px');
    glow.style.setProperty('--gy', e.clientY + 'px');
    glow.classList.add('soft');
    glow.classList.remove('go');
    void glow.offsetWidth;             // 强制重排：连点也能重新触发动画
    glow.classList.add('go');
  });
  /* 光斑播完统一还原：摘掉首屏专用的 .soft 与临时 z-index */
  const tapGlowEl = $('#tapGlow');
  if (tapGlowEl) tapGlowEl.addEventListener('animationend', function (e) {
    /* 伪元素涟漪的 animationend 也会落在宿主节点上，必须按名字过滤，
       否则外圈还在荡、z-index 就被提前还原，涟漪会闪断 */
    if (e.animationName !== 'softCore' && e.animationName !== 'tapRipple') return;
    tapGlowEl.classList.remove('soft');
    tapGlowEl.style.zIndex = '';
  });
  /* ★ 兜底只"解锁"，绝不自动进入 ——
     之前那个 12s 的 arm()+enterStreet() 就是"自己就进来了"的元凶：
     用户可能正在读题献，画面却突然把人推进街道页。
     这里仅在 loader-fx.js 异常没派发 loader:formed 时把闸门打开，
     进不进永远由用户决定。 */
  setTimeout(function () {
    if (loaderEl && loaderEl.isConnected) arm();
  }, 12000);

  /* ---------- 11.6 关于作品 ----------
     右下角小按钮 → 弹出作品简介（背景为当前页面的模糊状态） */
  const aboutPanel = $('#aboutPanel');
  $('#aboutBtn').addEventListener('click', () => aboutPanel.classList.add('show'));
  function closeAbout() { aboutPanel.classList.remove('show'); }
  aboutPanel.addEventListener('click', e => {
    if (e.target === aboutPanel || e.target.classList.contains('about-close')) closeAbout();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && aboutPanel.classList.contains('show')) closeAbout();
  });

  /* 对外接口：便于调试、自动化测试，以及"跳到第N个角色"这类功能 */
  window.StreetCorner = {
    openRole(id) { openCard(id); },
    /* openStory 一起暴露：故事弹层只能从结局页转盘点人物进入，
       而结局页一旦打开就关不回来（finaleShown 单向锁），
       自动化测试没法在"街道还没点亮完"的状态下测它 —— 挂出来才能单测。 */
    openStory(id) { openStory(id); },
    get collected() { return [...collected]; },
    get total() { return TOTAL_ROLES; }
  };

  window.addEventListener('resize', layout);
  layout();
  updateProgress();

  /* ---------- 提示条 ---------- */
  let toastTimer;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
  }

  /* ---------- 方案一「轻触唤醒」· 舞台提示条 ----------
     两段式节奏：loader 淡出后弹出「点击店铺」引导；
     每点亮一人，换成「「××」被你唤醒了 n/6」。 */
  const stageHintEl = $('#stageHint');
  const stageHintTextEl = $('#stageHintText');
  function showStageHint(text) {
    if (!stageHintEl) return;
    if (text && stageHintTextEl) stageHintTextEl.innerHTML = text;
    stageHintEl.classList.remove('gone');
    stageHintEl.classList.add('on');
  }
  function hideStageHint() {
    if (stageHintEl) { stageHintEl.classList.remove('on'); stageHintEl.classList.add('gone'); }
  }

  /* ---------- 11.8 背景音乐 ----------
     一条老街该有的底噪：木琴 + 远处车流，循环无限播放。
     ★ 音量默认 12% —— 与作者试听时播放器上的音量一致（不是"响一点"，
       背景音乐的职责是垫底，让人说话的声音始终在最前面）。
       用户之后拖动/调节过的值存进 localStorage，下次访问沿用；
       用「曾经调过」这个标志位区分"用户选的 12%"和"默认的 12%"，
       避免把默认值又写回去。 */
  const BGM = (() => {
    const audio = $('#bgm');
    const btn = $('#musicBtn');
    if (!audio) return null;
    const DEF = 0.12;                      // 默认 12%
    const KEY_V = 'jiejiao_bgm_vol';
    const KEY_P = 'jiejiao_bgm_on';

    /* volumechange 只在【用户真的调过】时才写存储。
       ★ 不能只靠"动画期间关闸"来挡：volumechange 是【异步派发】的，
         浏览器在什么时候把它交给监听器并不严格可控 ——
         实测淡出结束、开闸之后仍会补一次事件，把 0 写进存储，
         导致下次访问永远没声音。
         所以再加一道更硬的判断：淡入淡出过程中我们只认【目标音量】这一个值，
         凡是等于目标（或处于淡出途中的中间值）的事件一律不落盘，
         只有【与目标不同的值】才视为用户手动调过。 */
    let volGate = false;
    const openGate = () => { volGate = false; };
    const closeGate = () => { volGate = true; };
    audio.addEventListener('volumechange', () => {
      if (volGate) return;
      /* 淡出途中/刚结束：当前值是 0（或接近 0 的中间值），不是用户的选择 */
      if (audio.volume <= 0.001) return;
      try { localStorage.setItem(KEY_V, String(audio.volume)); } catch (_) {}
    });

    /* 恢复上次音量；没有记录才用默认值，并且不写回存储 */
    let vol = DEF;
    try {
      const saved = localStorage.getItem(KEY_V);
      if (saved !== null && !Number.isNaN(+saved)) vol = Math.max(0, Math.min(1, +saved));
    } catch (_) { /* 隐私模式：忽略，用默认值 */ }
    audio.volume = vol;

    const paint = () => {
      if (!btn) return;
      const on = !audio.paused;
      btn.classList.toggle('playing', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? '关闭背景音乐' : '播放背景音乐');
    };

    /* 音量淡入淡出。
       ★ 用 setTimeout 阶梯而不是 requestAnimationFrame 插值：
         音频时钟与 rAF 不同步（无头环境/后台标签页里 rAF 会被节流甚至停摆），
         会出现"在播但 volume 一直是 0"的哑声。定时器跟着 setInterval 走，
         在任何环境下都能把音量推到目标值。 */
    const RAMP_STEP = 40, RAMP_IN = 1200, RAMP_OUT = 600;
    function rampTo(from, to, ms, done) {
      const steps = Math.max(1, Math.round(ms / RAMP_STEP));
      let i = 0;
      const id = setInterval(() => {
        i++;
        const k = Math.min(1, i / steps);
        audio.volume = from + (to - from) * (k * k * (3 - 2 * k));   // smoothstep
        if (k >= 1) {
          clearInterval(id);
          audio.volume = to;
          done && done();
        }
      }, RAMP_STEP);
      return id;
    }
    function fadeIn(target) {
      closeGate();
      const p = audio.play();
      /* 被浏览器策略拦下时只是"没播成"，但斜坡照样跑完再开闸，
         不能在这里提前开 —— 否则之后的中间值会落盘。 */
      if (p && p.then) p.catch(() => { /* 保持暂停，闸门交给斜坡收尾 */ });
      rampTo(0, target, RAMP_IN, () => { openGate(); paint(); });
      paint();
    }
    function fadeOut() {
      closeGate();
      const from = audio.volume;
      rampTo(from, 0, RAMP_OUT, () => {
        audio.pause();
        /* ★ 顺序很要紧：先开闸，再把音量钉到 0。
             volumechange 是【异步派发】的 —— 在 openGate() 之前写 audio.volume=0，
             那次事件会落到开闸之后，把"用户音量 0"写进 localStorage，
             下次访问就永远没声音了。
             反过来（开闸 → 赋值）时，volumechange 还在闸门关闭期间派发，被挡掉。
             归零本身不能省：淡出到 0 之后若留着 0.12，
             恢复播放会突然变响。 */
        openGate();
        audio.volume = 0;
        paint();
      });
    }

    function play() {
      /* 目标音量 = 用户设定值（存过就用存的，没存用默认 12%）。
         ★ 必须从存储重新读，不能用 audio.volume 当"当前音量"：
           淡出结束时已把它归 0，直接拿来当目标会一路推到 0（哑声）。 */
      let target = DEF;
      try {
        const s = localStorage.getItem(KEY_V);
        if (s !== null && !Number.isNaN(+s)) target = Math.max(0, Math.min(1, +s));
      } catch (_) {}
      fadeIn(target);
      try { localStorage.setItem(KEY_P, '1'); } catch (_) {}
    }
    function pause() {
      fadeOut();
      try { localStorage.setItem(KEY_P, '0'); } catch (_) {}
    }
    function toggle() { audio.paused ? play() : pause(); }
    audio.addEventListener('play', paint);
    audio.addEventListener('pause', paint);
    audio.addEventListener('ended', () => { audio.currentTime = 0; audio.play().catch(() => {}); });
    if (btn) btn.addEventListener('click', toggle);

    /* 页面切到后台：暂停（不打断别的标签页），回来时按之前的开关状态恢复。
       ★ 回前台必须走 play() 而不是裸 audio.play()：
         后台暂停时音量已被淡出归 0，裸 play() 会"播放但听不见"。 */
    let wasPlayingBeforeHide = false;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        wasPlayingBeforeHide = !audio.paused;
        if (wasPlayingBeforeHide) audio.pause();
      } else if (wasPlayingBeforeHide) {
        wasPlayingBeforeHide = false;
        play();
      }
      paint();
    });

    paint();
    /* ★ 只有开场那一下点击才算用户手势：点完之后才真正出声，
       之前 preload="auto" 只负责把音频预载进内存。 */
    window.__bgmUnlock = () => {
      let want = true;
      try { want = localStorage.getItem(KEY_P) !== '0'; } catch (_) {}
      if (want) play();
    };
    return { play, pause, toggle, paint, audio };
  })();

  /* ---------- 10.5 点击空处：泛起一点微光 ----------
     语义是"你碰了一下这条街，它亮了一下"，不是"这里有人"——
     所以刻意不做成呼吸灯（那会误导玩家在空处反复点着找人）。
     排除清单（每一条都对应一种误触）：
       · 点人物热区/.tip/气泡 → 不闪，交给点亮逻辑
       · 拖动浏览（panMoved 或位移超阈值）→ 不闪，否则每拖一次闪一下
       · 故事弹层/结局页/对话框/关于面板打开 → 不闪
       · 非左键 → 不闪
       · 舞台矩形之外（HUD、底部提示条等）→ 不闪
     ★ 全程复用同一个 #tapGlow 节点，连点也不会堆出一堆 DOM。

     ★★ 监听必须挂在 stageWrap，不能挂 hitLayer ★★
       方案原文说「挂 hitLayer 语义更准」，但实测收不到事件：
       `.hit-layer` 整层是 `pointer-events: none`，只有 `.hotspot` 恢复 auto，
       所以「舞台空白处」命中的元素是它下层的 `img.bg-img`，事件压根不经过 hitLayer。
       挂在 stageWrap 上（事件的必经之路），再用 closest 排除热区，
       才能真正覆盖到背景图上的空白处。 */
  /* 街道是否已被上层全屏界面盖住（故事弹层 / 结局页 / 对话框 / 关于面板）。
     ★ 这几层都是 position:fixed; inset:0，【不会改变 stageWrap 的布局盒】，
       所以 stageWrap.getBoundingClientRect() 在它们打开后依然返回原来的矩形。
       后果（实测踩过）：光标逻辑里的 inStage 判定继续成立 →
       结局页已经盖住整屏了，放大镜还开着、箭头还藏着。
       光斑也会在结局页底下继续闪（那一下"点空白"的反馈已经完全无处可感）。
       所以两处都必须问这个函数，不能只靠几何判定。 */
  const COVER_SELECTOR = '.story-panel.show, .finale.show, .dlg-mask.show, .about-panel.show';
  function stageIsCovered() {
    return !!document.querySelector(COVER_SELECTOR);
  }

  const tapGlow = $('#tapGlow');
  if (tapGlow) {
    stageWrap.addEventListener('pointerdown', e => {
      if (e.button) return;                                   // 只响应左键
      if (!e.isPrimary) return;                               // 多指的第二指不闪
      if (e.target.closest('.hotspot, .shop-zone, .tip, .speech-bubble')) return;
      if (stageIsCovered()) return;
      const r = stageWrap.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right ||
          e.clientY < r.top  || e.clientY > r.bottom) return;

      /* 拖动浏览时不要闪：延到 pointerup 再确认。
         ★ 这里刻意【不用】现成的 panMoved 标志，只看本次手势的位移：
           panMoved 只在 stageWrap 的 pointerdown 里被重置成 false，
           而那个 handler 在 maxPan <= 0（背景图不需滚动）时会提前 return，
           于是上一次拖动留下的 true 会一直残留、让光斑从此再也不闪。
           位移阈值自己算（>6px，与 panMoved 同一套口径），无跨手势状态。 */
      const sx = e.clientX, sy = e.clientY;
      /* ★ 监听挂 window 而不是 stageWrap：松手时指针可能已经不在舞台里
         （移到 HUD / 关于按钮上、拖出边缘、被系统判定取消），
         stageWrap 收不到 pointerup，涟漪就"偶尔失灵"——
         而且残留的 once 还会吞掉下一次手势的判定。window 永远收得到。 */
      const once = up => {
        window.removeEventListener('pointerup', once);
        window.removeEventListener('pointercancel', once);
        clearTimeout(guard);
        if (up.type === 'pointerup' && !up.isPrimary) return;  // 多指的第二指松开不算
        if (Math.hypot(up.clientX - sx, up.clientY - sy) > 6) return;
        if (stageIsCovered()) return;
        flashGlow(sx, sy);
      };
      /* 兜底：万一 up 事件彻底收不到（如按住时切走窗口），1.5s 后静默清理，
         绝不残留监听去污染下一次点击 */
      const guard = setTimeout(() => {
        window.removeEventListener('pointerup', once);
        window.removeEventListener('pointercancel', once);
      }, 1500);
      window.addEventListener('pointerup', once, { passive: true });
      window.addEventListener('pointercancel', once, { passive: true });
    }, { passive: true });

    function flashGlow(cx, cy) {
      tapGlow.classList.remove('soft');       // 街道页用大号光斑，别沾首屏的柔光样式
      tapGlow.style.zIndex = '';
      tapGlow.style.setProperty('--gx', cx + 'px');
      tapGlow.style.setProperty('--gy', cy + 'px');
      tapGlow.classList.remove('go');
      void tapGlow.offsetWidth;          // 强制重排：让动画能在连续点击下重新触发
      tapGlow.classList.add('go');
    }
  }
})();