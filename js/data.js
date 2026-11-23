/* =========================================================
   街角记忆 · 角色档案数据
   头像均为手写 SVG（素描线条 + 少量色块），非 AI 生成图像
   性格字段：tagline 性格标签 / murmur 性格微文案 / mood 卡片主题色
   ========================================================= */

// （以下两个常量仅供旧版程序化街景 street.js 使用，已不在页面中渲染）
const STAGE_W = 6400;
const STAGE_H = 780;
const GROUND_DROP = 330;

/* ---------- 素描头像 ---------- */
/* 统一规格：viewBox 0 0 120 120，透明底，线稿 + 少量色块 */

const AVATARS = {
  /* 刘姐 —— 手里端着苹果，围裙，笑得最大声 */
  liuji: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" class="ava" width="120" height="120">
  <g fill="none" stroke="#2b2622" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M38 46c0-11 9-18 20-18s20 7 20 18"/>
    <path d="M35 46c0-5 7-7 14-7h18c8 0 14 2 14 7s-6 7-14 7H49c-8 0-14-2-14-7z" fill="#c96a4a" stroke="#2b2622"/>
    <path d="M41 55c0-3 4-5 10-5h6c6 0 10 2 10 5v6c0 8-6 13-13 13s-13-5-13-13z" fill="#e8dcc6"/>
    <path d="M48 61q2.5-3.5 5 0M59 61q2.5-3.5 5 0" fill="none" stroke-width="2.8"/>
    <path d="M48 70q7 8 14 0" fill="#fff" stroke-width="2.2"/>
    <path d="M37 84h30l5 22H32z" fill="#7a9a5a" stroke="#2b2622"/>
    <path d="M44 84v22M55 84v22" stroke-width="1.5"/>
    <circle cx="47" cy="97" r="3" fill="#5f7a3e" stroke="none"/>
    <path d="M38 88l-14 4M63 88l16 2" stroke-width="2.4"/>
    <path d="M79 92c0-6 6-9 10-9s10 3 10 9-5 10-10 10-10-4-10-10z" fill="#c94a32" stroke="#2b2622"/>
    <path d="M89 83c0-3 1-5 3-6" stroke="#5f7a3e" stroke-width="2"/>
    <path d="M80 86c-3 3-4 6-3 9" stroke="#fff" stroke-width="1.4" opacity=".6"/>
    <path d="M14 26c6 3 8 8 6 12M100 34c4-2 8-1 10 2" stroke="#c96a4a" stroke-width="2" stroke-linecap="round"/>
  </g>
</svg>`,

  /* 老木 —— 沉默的倾听者，嘴闭着，刨花悬在空中 */
  carpenter: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" class="ava" width="120" height="120">
  <g fill="none" stroke="#2b2622" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M40 50c0-11 8-18 19-18s19 7 19 18"/>
    <path d="M38 50c0-4 6-6 12-6h15c7 0 13 2 13 6s-6 6-13 6H51c-6 0-13-2-13-6z" fill="#7a6a4e" stroke="#2b2622"/>
    <path d="M42 58c0-3 4-5 10-5h5c6 0 10 2 10 5v6c0 8-6 13-13 13s-12-5-12-13z" fill="#e0d2b6"/>
    <path d="M49 64h2M59 64h2" stroke-width="2.8"/>
    <path d="M53 72h6" stroke-width="2"/>
    <path d="M39 84c6-4 15-4 21 0l5 16H34z" fill="#6b5f45" stroke="#2b2622"/>
    <path d="M50 86v14M57 86v14" stroke-width="1.5"/>
    <path d="M60 88l22-10" stroke-width="2.4"/>
    <path d="M78 74l10 6-6 9-10-6z" fill="#c9a86a" stroke="#2b2622"/>
    <path d="M84 72c4-6 10-8 14-6M90 68c3-5 9-6 13-4" stroke="#b08d52" stroke-width="2.2"/>
    <path d="M88 78c5-1 10 1 12 5" stroke="#b08d52" stroke-width="2"/>
  </g>
</svg>`,

  /* 张万能 —— 神出鬼没，歪着头，车钥匙在手，人还在半路 */
  locksmith: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" class="ava" width="120" height="120">
  <g fill="none" stroke="#2b2622" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M38 50c0-12 9-19 20-19s20 7 20 19" transform="rotate(-8 58 40)"/>
    <path d="M36 50c0-5 6-7 13-7h16c8 0 14 2 14 7s-6 6-14 6H50c-7 0-14-1-14-6z" fill="#4c5b62" stroke="#2b2622" transform="rotate(-8 58 46)"/>
    <path d="M42 60c0-3 4-5 10-5h5c6 0 10 2 10 5v6c0 8-6 13-13 13s-12-5-12-13z" fill="#e0d2b6"/>
    <path d="M49 66h2M59 65h2" stroke-width="2.8"/>
    <path d="M54 75q4 2 7-1" stroke-width="2"/>
    <path d="M40 86c6-4 15-4 21 0l4 14H35z" fill="#5b6b7d" stroke="#2b2622"/>
    <path d="M61 88l18 8" stroke-width="2.4"/>
    <g transform="translate(84 92)">
      <circle cx="0" cy="0" r="6" fill="none" stroke="#c9922f" stroke-width="2.6"/>
      <path d="M5 4l8 6M5 7l-3 9M9 5l9 3" stroke="#c9922f" stroke-width="2.4"/>
    </g>
    <path d="M22 104c14-4 30-4 44 0" stroke="#8a8f7a" stroke-width="2" stroke-dasharray="3 4"/>
    <path d="M96 22c5 4 6 10 3 14M104 16c7 6 8 15 4 20" stroke="#8a8f7a" stroke-width="2"/>
  </g>
</svg>`,

  /* 李串串 —— 烈火烹油，一手竹签一手勺，围裙油渍 */
  skewer: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" class="ava" width="120" height="120">
  <g fill="none" stroke="#2b2622" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M38 46c0-11 9-18 20-18s20 7 20 18"/>
    <path d="M35 46c0-5 7-7 14-7h18c8 0 14 2 14 7s-6 7-14 7H49c-8 0-14-2-14-7z" fill="#8a3f34" stroke="#2b2622"/>
    <path d="M41 55c0-3 4-5 10-5h6c6 0 10 2 10 5v6c0 8-6 13-13 13s-13-5-13-13z" fill="#e0d2b6"/>
    <path d="M49 62h2M60 62h2" stroke-width="2.8"/>
    <path d="M50 71q6 5 12 0" fill="none" stroke-width="2.2"/>
    <path d="M38 84h28l5 22H33z" fill="#9c8f4a" stroke="#2b2622"/>
    <path d="M44 84v22M55 84v22" stroke-width="1.5"/>
    <circle cx="46" cy="98" r="3" fill="#6b5f2e" stroke="none"/>
    <path d="M40 88l-12 6M62 88l14-6" stroke-width="2.4"/>
    <g transform="translate(80 84) rotate(18)">
      <path d="M0 0v-26" stroke-width="2.2"/>
      <path d="M-3-24h6M-3-18h6M-3-12h6" stroke-width="3" stroke="#c9922f"/>
    </g>
    <path d="M92 60c4 5 3 10-2 12M99 54c5 6 4 12-3 15" stroke="#a8442f" stroke-width="2.2"/>
  </g>
</svg>`,

  /* 刘剪剪 —— 热情社交中心，一手推子一手梳子，笑得眼睛弯 */
  barber: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" class="ava" width="120" height="120">
  <g fill="none" stroke="#2b2622" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M38 52c0-13 8-20 20-20s20 7 20 20"/>
    <path d="M35 52c0-5 7-8 14-8h18c8 0 14 3 14 8s-6 7-14 7H49c-8 0-14-2-14-7z" fill="#a8442f" stroke="#2b2622"/>
    <path d="M41 60c0-3 4-5 10-5h6c6 0 10 2 10 5v6c0 8-6 13-13 13s-13-5-13-13z" fill="#e0d2b6"/>
    <path d="M48 65q2.5-3 5 0M57 65q2.5-3 5 0" fill="none" stroke-width="2.6"/>
    <path d="M49 73q5 5 11 0" fill="#fff" stroke-width="2"/>
    <path d="M39 86h24c5 0 8 3 8 8v10H31V94c0-5 3-8 8-8z" fill="#4d6b58" stroke="#2b2622"/>
    <path d="M31 97h40" stroke-width="1.6"/>
    <path d="M38 90l-10 8M66 90l12-10" stroke-width="2.4"/>
    <rect x="72" y="84" width="20" height="11" rx="2" fill="#c9922f" stroke="#2b2622"/>
    <path d="M75 88h14" stroke-width="1.4"/>
    <g transform="translate(92 62) rotate(-20)">
      <circle cx="0" cy="0" r="5" fill="none" stroke="#2b2622" stroke-width="2.2"/>
      <circle cx="0" cy="19" r="5" fill="none" stroke="#2b2622" stroke-width="2.2"/>
      <path d="M4 3l13 14M4 16L-9 3" stroke-width="2.4"/>
    </g>
  </g>
</svg>`,

  /* 老陈 —— 幽默风趣，歪嘴笑，手里捏着鞋，机油渍 */

  /* 王姨 —— 夜市掌灯人，一手灯笼一手串，围裙，笑声爽朗 */
  nightmarket: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" class="ava" width="120" height="120">
  <g fill="none" stroke="#2b2622" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M38 46c0-11 9-18 20-18s20 7 20 18"/>
    <path d="M35 46c0-5 7-7 14-7h18c8 0 14 2 14 7s-6 6-14 6H49c-8 0-14-1-14-6z" fill="#6b4a44" stroke="#2b2622"/>
    <path d="M41 55c0-3 4-5 10-5h6c6 0 10 2 10 5v6c0 8-6 13-13 13s-13-5-13-13z" fill="#e0d2b6"/>
    <path d="M49 61q2.5-3 5 0M60 61q2.5-3 5 0" fill="none" stroke-width="2.6"/>
    <path d="M49 70q6 6 12 0" fill="#fff" stroke-width="2.2"/>
    <path d="M38 84h28l5 22H33z" fill="#8a3f34" stroke="#2b2622"/>
    <path d="M45 84v22M56 84v22" stroke-width="1.5"/>
    <path d="M62 88l14 4" stroke-width="2.4"/>
    <g transform="translate(84 84)">
      <path d="M0 0v-10" stroke-width="1.8"/>
      <ellipse cx="0" cy="8" rx="12" ry="14" fill="#d4432e" stroke="#2b2622"/>
      <path d="M-6-1h12M-7 8h14M-6 17h12" stroke="#e8dcc4" stroke-width="1.4"/>
      <path d="M0 22v6" stroke="#c9922f" stroke-width="2"/>
    </g>
    <path d="M18 30c4-4 9-5 13-3" stroke="#c9922f" stroke-width="2"/>
  </g>
</svg>`
};

/* ---------- 角色档案 ---------- */
/* stat: 键 + 数值(-100 ~ 100)，负值用暗红表示
   mood: 卡片主题（数字为该角色专属的点缀色）
   murmur: 卡片底部的性格微文案（小字灰色）        */

const ROLES = [
  {
    id: 'cobbler',
    name: '老周师傅',
    tag: '海城修鞋铺',
    title: '守着一台手摇补鞋机的人',
    px: 11.66, py: 92.69, ph: 24.0, peek: 0, bub: 'r', lane: 1,
    /* 门面热区（背景图百分比 [左,上,右,下]）：点店招/店面也算「叫人出来」。
       提示条写的是"点击任意一家店铺"，热区就必须真的罩住店面。 */
    shop: [0.0, 15.9, 19.7, 59.5],
    /* 呼吸灯位置（背景图百分比，[x, y] 即灯心坐标）：
       由「呼吸灯定位器.html」拖出来后原样粘贴，是「人在哪儿」的唯一线索 */
    ping: [12.20, 88.70],
    sfx: 'planing',
    hours: '08:00 – 12:00 / 15:00 – 19:00',
    code: 'ARC-01',
    stats: [
      { k: '手艺', v: 95 },
      { k: '沉默', v: 92 },
      { k: '耐心', v: 88 }
    ],
    quote: '我读书时可好了……就是那年头，家底实在供不起。',
    story: '老周师傅最爱讲两件事，一件是十月大革命时的红小兵故事，一件是他的高中时代。那年他成绩拔尖，试卷发下来老师都说"这孩子能上"。可家里实在掏不出那笔学费，他没跟任何人提过这件事，包括他妈。他总跟人说："现在多好，你们好好学，国家帮扶你上大学。"说这话的时候他一直笑着，眼睛却会望向门外。那可能是一辈子的遗憾。他也格外招小姑娘喜欢，坐在小凳上就爱讲他妈怎么教育他，讲到动情处还要拍一下大腿："我得谢我妈。"',
    bio: '年轻人鞋子破了就扔，他还守着那台老补鞋机。修一双十块钱的鞋，和修一双名牌皮鞋，他用的是同一把锥子。有人劝他换个店面，他说不急，这条街还没走完。',
    murmur: '他讲了一辈子红小兵的故事，也讲了一辈子那个没上成的大学。',
    note: '街坊备注：他那儿永远有一壶热水，鞋垫磨薄了可以去找他。'
  },
  {
    id: 'carpenter',
    name: '老木',
    tag: '青岛木工坊',
    title: '靠门框看落日的手艺人',
    px: 27.00, py: 85.28, ph: 22.5, peek: 0, bub: 'r', lane: 3,
    shop: [17.9, 24.4, 36.5, 65.9],
    ping: [27.50, 84.60],
    sfx: 'planing',
    hours: '10:00 – 19:00（不接急活）',
    code: 'ARC-02',
    stats: [
      { k: '手艺', v: 96 },
      { k: '安静', v: 94 },
      { k: '耐心', v: 90 }
    ],
    quote: '……我说话，你们……听不清吧。凑近点。',
    story: '老木有语言障碍，说出来的话别人常听不懂，他就越来越少开口，在人前总显着点自卑。他娶的老婆早年跟人跑了，一个人把女儿拉扯大。女儿在的时候，家里总听见爷俩拌嘴的声音，邻居都笑，说那是这条街最热闹的两口人。女儿上大学后，家里忽然安静下来，他也跟着沉默寡言了。街坊们轮着来问他最近好不好，他只是摇头，不肯讲。他把所有想说的，都刨进了木花里。',
    bio: '他的店叫「青岛木工坊」，网上也做定制，接单的多是年轻人。但他从不接急活。有人催，他就低着头多刨两下，木屑从卷起的刨花里飘出来。等他抬起头，活儿已经做完了。',
    murmur: '他听不太懂别人说的，也说不清自己想的，木花替他说了。',
    note: '街坊备注：他做的木器贵一倍，但没人舍得还价。'
  },
  {
    id: 'barber',
    name: '阿Ken',
    tag: '老城理发室',
    title: '这条街的新闻联播',
    px: 36.85, py: 76.22, ph: 14.6, peek: 0, bub: 'c', lane: 2,
    shop: [33.5, 26.6, 45.5, 59.5],
    ping: [36.85, 76.22],
    sfx: 'clippers',
    hours: '09:00 – 20:00',
    code: 'ARC-03',
    stats: [
      { k: '手艺', v: 90 },
      { k: '热情', v: 96 },
      { k: '情报', v: 92 }
    ],
    quote: '带染膏来的？二十块，理发加染，一分不加。',
    story: '阿Ken这家店是全社区最便宜的理发店，手艺实在说不上多好，可架不住他实在。你就算自己带着染发膏上门，请他帮忙，他照样只收你二十块——理发加染头，中老年人全都爱来。他们的白头发总在他的手底下变回黑色，偶尔也变成时髦的酒红色。染完照镜子自己还不满意，他也不恼，笑呵呵说："下回再来，我给你修修。"',
    bio: '年轻人宁愿绕两条街去网红店，他的店还是靠老街坊撑着。门口那面旧镜子被他擦得能照见对面的招牌。剪得快，但落最后一剪前一定要退后一步看整张脸。',
    murmur: '二十块钱，理发加染头——全社区的老人都把白头发交给了他。',
    note: '街坊备注：全街的人都在他这里留下过一段"那年我剪了个什么头"的回忆。'
  },
  {
    id: 'skewer',
    name: '李串串',
    tag: '老青岛串串香',
    title: '端着一盆热气腾腾的老板娘',
    px: 68.94, py: 82.48, ph: 18.9, peek: 0, bub: 'c', lane: 0,
    shop: [58.6, 31.9, 73.6, 59.5],
    ping: [68.94, 82.48],
    sfx: 'skewershop',
    hours: '16:00 – 23:00',
    code: 'ARC-04',
    stats: [
      { k: '火候', v: 95 },
      { k: '嗓门', v: 93 },
      { k: '手速', v: 90 }
    ],
    quote: '大学生回来啦？先坐，姨给你煮锅热的。',
    story: '李串串的调料是这条街上公认最好的。大人小孩从小吃到大，哪家孩子放学早闻着味就往这儿跑。外的大学生放假回来，头一件事不是回家，是一定要来她这儿吃一口家乡的味道。店里从下午四点开始热气腾腾，锅底翻滚着红油和花椒的香，座位从早到晚都是满的。她说看着这些孩子吃，她就想起自己当年也这么馋过。',
    bio: '她的串串店在外卖平台上评分很高。锅从下午四点开始冒泡，一直冒到深夜。她能在最忙的时候同时看住三口锅、记着五桌的辣度偏好，还抽空喊一句"老张你的好了"。',
    murmur: '她的锅从下午四点冒泡到深夜，放学的娃都来这里吃一口家乡味。',
    note: '街坊备注：外卖小哥在门口等单的时候，她总会多给一盒。'
  },
  {
    id: 'tuina',
    name: '林姐',
    tag: '中医推拿拔罐',
    title: '这条街的首席社交官 / 治愈系女老板',
    px: 79.51, py: 83.80, ph: 25.0, peek: 0, bub: 'l', lane: 2,
    shop: [70.6, 24.4, 86.7, 55.3],
    ping: [80.20, 85.90],
    sfx: 'lanternnight',
    hours: '11:00 – 22:00',
    code: 'ARC-05',
    socialHub: true,
    stats: [
      { k: '手艺', v: 97 },
      { k: '号召力', v: 100 },
      { k: '魅力', v: 95 }
    ],
    quote: '来来来，坐这边，这边脸好看——腰不舒服？姐给你按按。',
    story: '林姐是这条街最热闹的人，整条街的小太阳，谁家有个忙，她二话不说就卷起袖子去搭把手。她脚有点微跛，脸上还有一道早年的疤，可她从不消沉，整天乐呵呵的，嗓门亮得像敲铜盆。只是有一样：她从不把带疤的那一面转向你，一边按着你的肩一边笑，说"这边脸好看点，坐这边"。客人偏偏都爱找她聊天，说跟林姐说说话，腰好像真不疼了。她有个正在上大学女儿，见着人就夸：我家姑娘多努力、多上进、多孝顺，一个字都不让妈操心。',
    bio: '门口挂着一只灯箱，其中一个字的偏旁有点不亮。她在这条街上的身份有点复杂：上午帮邻居按住腰，下午给人推拿，晚上挨家送水果。她的手法很准，力道大到能听见"啵"的一声；她的嘴也很甜，甜到你觉得腰好像真不疼了。',
    murmur: '谁的腰疼她给按，谁家有事她先到，这条街的小太阳是她。',
    note: '街坊备注：她一开口，这条街上的人都会停下来听她说两句。'
  },
  {
    id: 'fruit',
    name: '王姐',
    tag: '胶东水果店',
    title: '举着橙子招呼整条街的人',
    px: 87.00, py: 98.52, ph: 26.5, peek: 0, bub: 'l', lane: 3,
    shop: [83.7, 18.1, 100.0, 55.3],
    ping: [88.70, 93.10],
    /* 气泡右移量（背景图宽度的百分比）：王姐在最右，气泡与林姐的挤在一起，
       整块往右挪一点，让开林姐的立绘（见 app.js layout() 的 --bub-dx 换算） */
    bubDx: 5.2,
    sfx: 'bikebell',
    hours: '07:00 – 21:00',
    code: 'ARC-06',
    stats: [
      { k: '活力', v: 98 },
      { k: '爽朗', v: 96 },
      { k: '选果', v: 90 }
    ],
    quote: '来来来，尝尝我家这个橙子！……卖不穷，送人吃更不穷。',
    story: '王姐的店里总有卖不完的水果。堆得多了、日子快过完了，她干脆拿来往街坊手里送："来来来，尝尝。"有人问她亏不亏，她乐呵呵说：送别人吃的是送不穷的。这话让整条街的人都愿意来她这儿买东西，反正最后总要多拿两个回家。她挑果的眼光准，谁家孩子不爱吃菜，她都能给配出一盘来。',
    bio: '她的水果摊不大，但堆得高高的。旁边小区的老人都认得她的秤——她说少三两就少三两，从不短斤少两。有人来买水果，她总要多塞两个，"回家给老人尝尝"。',
    murmur: '她说送别人吃的是送不穷的，于是全街的人都愿意来她这儿。',
    note: '街坊备注：整条街的孩子都知道，去她那儿能多拿一块糖。'
  }
];

const TOTAL_ROLES = ROLES.length;
