// mergetwist.com: язык, появление блоков, снег, кадры с картой глубины (как в игре), трейлеры историй.
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ru = () => document.documentElement.lang === 'ru';

  // Язык: кнопка в шапке, выбор помнится в браузере.
  $$('.lang').forEach(b => b.addEventListener('click', () => {
    document.documentElement.lang = ru() ? 'en' : 'ru';
    try { localStorage.setItem('lang', document.documentElement.lang) } catch (e) {}
    caption && caption();
  }));

  const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))), { rootMargin: '0px 0px -10% 0px' });
  $$('.reveal').forEach(el => io.observe(el));

  // Кадр с параллаксом по карте глубины: WebGL, без него — обычная картинка.
  const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0,1);}';
  const FS = 'precision mediump float;uniform sampler2D img,dep;uniform vec2 off,fit;varying vec2 v;' +
    'void main(){vec2 u=(v-.5)*fit/1.08+.5;float d=texture2D(dep,u).r;gl_FragColor=texture2D(img,u+off*(d-.45)*.05);}';
  const pointer = { x: 0, y: 0 };
  addEventListener('pointermove', e => { pointer.x = e.clientX / innerWidth * 2 - 1; pointer.y = e.clientY / innerHeight * 2 - 1 }, { passive: true });
  const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src });

  class Layer {
    constructor(box) {
      this.c = document.createElement('canvas'); this.c.style.opacity = 0; box.appendChild(this.c);
      const gl = this.gl = this.c.getContext('webgl', { premultipliedAlpha: false });
      if (!gl) return;
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o };
      const pr = this.pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const a = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
      this.tex = [0, 1].map(k => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, t);
        [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(w => gl.texParameteri(gl.TEXTURE_2D, w, gl.CLAMP_TO_EDGE));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); return t });
      gl.uniform1i(gl.getUniformLocation(pr, 'img'), 0); gl.uniform1i(gl.getUniformLocation(pr, 'dep'), 1);
      this.uOff = gl.getUniformLocation(pr, 'off'); this.uFit = gl.getUniformLocation(pr, 'fit');
    }
    set(img, dep) {
      const gl = this.gl;
      if (!gl) { this.c.replaceWith(Object.assign(img, { style: 'opacity:0' })); this.c = img; return }
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      [img, dep].forEach((im, k) => { gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, this.tex[k]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im) });
      this.ready = true;
    }
    draw(ox, oy) {
      const gl = this.gl; if (!gl || !this.ready) return;
      const r = devicePixelRatio > 1 ? 1.6 : 1, w = this.c.clientWidth * r | 0, h = this.c.clientHeight * r | 0;
      if (this.c.width !== w || this.c.height !== h) { this.c.width = w; this.c.height = h }
      gl.viewport(0, 0, w, h);
      const k = (w / h) / (9 / 16);  // обрезка как object-fit: cover
      gl.uniform2f(this.uFit, k > 1 ? 1 : k, k > 1 ? 1 / k : 1); gl.uniform2f(this.uOff, ox, oy);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  // Два слоя на коробку — смена кадра наплывом.
  class Depth {
    constructor(box) { this.box = box; this.layers = [new Layer(box), new Layer(box)]; this.front = 0; this.seq = 0; Depth.all.push(this) }
    async show(name) {
      const seq = ++this.seq;
      const [img, dep] = await Promise.all([load(`assets/f/${name}.webp`), load(`assets/d/${name}.jpg`)]).catch(() => []);
      if (!img || seq !== this.seq) return;
      const back = this.layers[1 - this.front]; back.set(img, dep);
      back.c.classList.toggle('first', !this.shown); this.shown = true;  // первый кадр — сразу, без наплыва из чёрного
      // Новый кадр проявляется поверх старого, старый гаснет потом: без провала в чёрный посередине.
      const old = this.layers[this.front].c;
      back.c.style.zIndex = 1; old.style.zIndex = 0; back.c.style.opacity = 1; this.front = 1 - this.front;
      clearTimeout(this.t); this.t = setTimeout(() => { old.style.transition = 'none'; old.style.opacity = 0; requestAnimationFrame(() => old.style.transition = '') }, 1200);
    }
  }
  Depth.all = [];
  let t0 = performance.now(), ox = 0, oy = 0;
  (function tick(t) {
    const s = (t - t0) / 1000, drift = still ? 0 : 1;
    ox += ((pointer.x * .9 + Math.sin(s * .37) * .5) * drift - ox) * .05;
    oy += ((pointer.y * .5 + Math.cos(s * .29) * .35) * drift - oy) * .05;
    Depth.all.forEach(d => d.box.offsetParent && d.layers.forEach(l => l.draw(ox, -oy)));
    requestAnimationFrame(tick);
  })(t0);

  const S = window.STORIES || [];
  let caption = null;

  // Первый экран: мини-доска merge. Собрал цепочку — открылась сцена истории и её выбор («история запомнит»).
  const R = window.ROUNDS || [], demo = $('.demo');
  if (demo && R.length) {
    const L = () => ru() ? 'ru' : 'en', board = $('.board', demo), bar = $('.chainbar', demo), scene = $('.scene', demo), bg = $('.hero-bg');
    const sceneDepth = new Depth($('[data-scene]', demo));
    const cells = Array.from({ length: 16 }, (_, k) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'cell'; b.addEventListener('click', () => tap(k)); board.appendChild(b); return b });
    let r = 0, grid, sel = null;
    const icon = (lv) => `assets/i/${R[r].chain[lv]}.webp`;
    const draw = (pop) => {
      grid.forEach((lv, k) => {
        const c = cells[k]; c.classList.toggle('sel', sel === k); c.classList.toggle('pop', pop === k);
        c.innerHTML = lv < 0 ? '' : `<img src="${icon(lv)}" alt="">`;
        c.setAttribute('aria-label', lv < 0 ? (ru() ? 'Пусто' : 'Empty') : R[r].names[L()][lv]);
      });
      const best = Math.max(...grid);
      $$('img', bar).forEach((im, lv) => im.classList.toggle('got', lv <= best));
      // Подсказка: первая пара одинаковых предметов покачивается, пока ничего не выбрано.
      const seen = {};
      const pair = sel === null ? grid.map((lv, k) => [lv, k]).find(([lv, k]) => lv >= 0 && lv < 3 && (seen[lv] === undefined ? (seen[lv] = k, false) : true)) : null;
      cells.forEach((c, k) => c.classList.toggle('hint', !!pair && (k === pair[1] || k === seen[pair[0]])));
    };
    const labels = () => {
      const q = R[r];
      $('.demo-goal', demo).textContent = q.goal[L()]; $('.demo-story', demo).textContent = q.story[L()];
      $('.demo-goal-img', demo).src = icon(3);
      bar.innerHTML = q.chain.map((_, lv) => `<img src="${icon(lv)}" alt="${q.names[L()][lv]}" title="${q.names[L()][lv]}">`).join('');
    };
    const start = () => {
      // Ровно на одну цепочку: уровни 2, 1, 0 и 0 — три слияния до цели; «+» добавляет ещё.
      grid = Array(16).fill(-1); [[2, 5], [1, 10], [0, 0], [0, 15]].forEach(([lv, k]) => grid[k] = lv);
      sel = null; scene.hidden = true; scene.classList.remove('chosen');
      bg.style.backgroundImage = `url(assets/f/${R[r].img}.webp)`; labels(); draw();
    };
    const win = () => {
      const q = R[r], l = L();
      sceneDepth.show(q.img);
      $('.scene-line', demo).textContent = q.line[l]; $('.scene-ask', demo).textContent = q.ask[l]; $('.scene-memo', demo).textContent = '';
      const opts = $('.scene-opts', demo); opts.innerHTML = '';
      q.options.forEach(o => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = o[l].text;
        b.addEventListener('click', () => { $('.scene-memo', demo).textContent = (ru() ? 'История запомнит: ' : 'The story remembers: ') + (o[l].memo || o[l].text); scene.classList.add('chosen') });
        opts.appendChild(b);
      });
      scene.hidden = false;
    };
    function tap(k) {
      const lv = grid[k];
      if (sel === null) { if (lv >= 0) sel = k; return draw() }
      if (sel === k) { sel = null; return draw() }
      if (lv < 0) { grid[k] = grid[sel]; grid[sel] = -1; sel = null; return draw(k) }  // перенос на пустую клетку
      if (lv === grid[sel] && lv < 3) {
        grid[k] = lv + 1; grid[sel] = -1; sel = null; draw(k);
        if (lv + 1 === 3) setTimeout(win, 650);
        return;
      }
      sel = k; draw();
    }
    $('.spawn', demo).addEventListener('click', () => {
      const free = grid.map((lv, k) => lv < 0 ? k : -1).filter(k => k >= 0);
      if (!free.length) return;
      const k = free[Math.random() * free.length | 0]; grid[k] = 0; draw(k);
    });
    $('.scene-next', demo).addEventListener('click', () => { r = (r + 1) % R.length; start() });
    caption = () => { labels(); draw() };
    start();
  }

  // Пылинки в свете на первом экране.
  const snow = $('.snow');
  if (snow && !still) {
    const g = snow.getContext('2d'), flakes = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.5 + .3, v: Math.random() * .25 + .08, w: Math.random() * 6.28 }));
    (function fall() {
      const w = snow.width = snow.clientWidth, h = snow.height = snow.clientHeight;
      g.fillStyle = '#f3d9a880';
      flakes.forEach(f => { f.y -= f.v / h * 2.2; f.w += .01; if (f.y < 0) { f.y = 1; f.x = Math.random() }
        g.beginPath(); g.arc((f.x + Math.sin(f.w) * .01) * w, f.y * h, f.r, 0, 6.28); g.fill() });
      requestAnimationFrame(fall);
    })();
  }

  // Трейлер: кадры истории с репликами, касание — дальше, слева — назад.
  const viewer = $('.viewer');
  if (viewer) {
    const box = $('[data-viewer]', viewer), depth = new Depth(box), bars = $('.bars', viewer), who = $('.who', viewer), line = $('.line', viewer);
    let story, k, timer, start, dur;
    const words = t => t.split(' ').map((w, n) => `<span style="transition-delay:${n * 70}ms">${w}</span>`).join(' ');
    const step = n => {
      clearTimeout(timer); k = n; viewer.classList.toggle('done', k >= story.trailer.length);
      $$('i b', bars).forEach((b, j) => { b.style.transition = 'none'; b.style.width = j < k ? '100%' : '0' });
      if (k >= story.trailer.length) return;
      const f = story.trailer[k], text = ru() ? f.ru : f.en;
      depth.show(f.img);
      who.textContent = ru() ? f.whoRu : f.whoEn; line.innerHTML = words(text);
      requestAnimationFrame(() => requestAnimationFrame(() => $$('span', line).forEach(s => s.classList.add('on'))));
      dur = Math.max(3800, text.split(' ').length * 330 + 1800);
      const b = $$('i b', bars)[k]; requestAnimationFrame(() => { b.style.transition = `width ${dur}ms linear`; b.style.width = '100%' });
      timer = setTimeout(() => step(k + 1), dur);
    };
    const open = id => {
      story = S.find(s => s.id === id); if (!story) return;
      bars.innerHTML = story.trailer.map(() => '<i><b></b></i>').join('');
      $('.end h3', viewer).textContent = ru() ? story.titleRu : story.titleEn;
      $('.end .ask', viewer).textContent = ru() ? story.askRu : story.askEn;
      viewer.hidden = false; document.body.style.overflow = 'hidden'; step(0); $('.close', viewer).focus();
    };
    const close = () => { clearTimeout(timer); viewer.hidden = true; document.body.style.overflow = '' };
    $$('[data-story]').forEach(b => b.addEventListener('click', () => open(b.dataset.story)));
    $('.next', viewer).addEventListener('click', () => step(k + 1));
    $('.prev', viewer).addEventListener('click', () => step(Math.max(0, k - 1)));
    $('.close', viewer).addEventListener('click', close);
    addEventListener('keydown', e => { if (viewer.hidden) return; if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') step(k + 1); if (e.key === 'ArrowLeft') step(Math.max(0, k - 1)) });
  }
})();
