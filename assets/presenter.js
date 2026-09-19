/* Frontend Slides Presenter v2.0.0 — MIT. Zero runtime dependencies.
 * Keep the deck's controller: mount({slides, getIndex, goTo, stage}). */
(() => {
  'use strict';
  if (window.FrontendSlidesPresenter) return;
  const VERSION = '2.0.0';
  const hash = value => {
    let n = 2166136261;
    for (const c of value) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
    return (n >>> 0).toString(36);
  };
  const editable = target => target instanceof Element &&
    !!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');
  const read = (storage, key) => { try { return JSON.parse(window[storage].getItem(key)); } catch { return null; } };
  const write = (storage, key, value) => { try { window[storage].setItem(key, JSON.stringify(value)); return true; } catch { return false; } };

  // Shared renderer/input surface, serialized into the popup with the client.
  // Coordinates are normalized to the authored stage, never the window or letterbox.
  function annotationSurface(doc, getRect, send, name) {
    const win = doc.defaultView, ns = 'http://www.w3.org/2000/svg';
    const svg = doc.createElementNS(ns, 'svg');
    svg.setAttribute('data-fsp-ui', 'annotations');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:fixed;z-index:2147483645;overflow:hidden;touch-action:none;user-select:none;pointer-events:none;';
    const paths = doc.createElementNS(ns,'g'), dot = doc.createElementNS(ns,'g');
    dot.style.filter = 'drop-shadow(0 0 8px #168cff)'; dot.style.display='none';
    [[29,'#188fff',.16],[17,'#168cff',.4],[8,'#2ba6ff',1],[3,'#e4f7ff',1]].forEach(([r,fill,opacity]) => {
      const circle=doc.createElementNS(ns,'circle');
      circle.setAttribute('r',r);circle.setAttribute('fill',fill);circle.setAttribute('opacity',opacity);dot.append(circle);
    });
    svg.append(paths,dot);doc.body.append(svg);
    let model = {mode:'off', index:0, strokes:[], laser:null, blank:false, width:1920,height:1080}, pointer = null, page = 0, signature = '';
    function layout() {
      const r=getRect();
      svg.style.left=r.left+'px';svg.style.top=r.top+'px';svg.style.width=r.width+'px';svg.style.height=r.height+'px';
    }
    function release() {
      if(pointer!==null){try{svg.releasePointerCapture(pointer);}catch{}pointer=null;}
    }
    function render(next) {
      if(next.index!==model.index || next.mode!==model.mode || next.blank) release();
      model=next;
      svg.setAttribute('viewBox',`0 0 ${model.width} ${model.height}`);
      svg.style.pointerEvents=model.mode==='off'||model.blank?'none':'auto';
      svg.style.cursor=model.mode==='laser'?'none':'crosshair';
      svg.style.visibility=model.blank?'hidden':'visible';
      const key=model.index+':'+model.inkRevision;
      if(key!==signature){
        paths.replaceChildren(...model.strokes.map(points=>{
          const path=doc.createElementNS(ns,'path');
          // A tiny segment makes a single pen tap a visible round dot.
          const pairs=points.map(p=>`${p[0]*model.width},${p[1]*model.height}`);
          path.setAttribute('d','M'+pairs.join(' L')+(points.length===1?' l0.01,0':''));
          path.setAttribute('fill','none');path.setAttribute('stroke','#168fff');
          path.setAttribute('stroke-width','7');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');
          return path;
        }));
        signature=key;
      }
      dot.style.display=model.mode==='laser'&&model.laser?'':'none';
      if(model.laser)dot.setAttribute('transform',`translate(${model.laser[0]*model.width},${model.laser[1]*model.height})`);
      layout();
    }
    function point(e, clamp=false){
      const r=getRect(), x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
      if(!r.width||!r.height||(!clamp&&(x<0||x>1||y<0||y>1)))return null;
      return [Math.max(0,Math.min(1,x)),Math.max(0,Math.min(1,y))];
    }
    function emit(type,p=null){send({type,point:p,index:page,source:name});}
    function stop(e){e.preventDefault();e.stopPropagation();}
    svg.addEventListener('pointerdown',e=>{
      if(e.button!==0||pointer!==null)return;
      const p=point(e);if(!p)return;
      stop(e);page=model.index;
      if(model.mode==='laser'){emit('laser',p);return;}
      if(model.mode==='pen'){pointer=e.pointerId;svg.setPointerCapture(pointer);emit('start',p);}
    });
    svg.addEventListener('pointermove',e=>{
      if(model.mode==='laser'){stop(e);page=model.index;emit('laser',point(e));}
      else if(pointer===e.pointerId){stop(e);emit('move',point(e,true));}
    });
    const end=e=>{if(e.pointerId===pointer){stop(e);emit('end');release();}};
    svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);
    svg.addEventListener('lostpointercapture',()=>{if(pointer!==null){emit('end');pointer=null;}});
    svg.addEventListener('pointerleave',()=>{if(model.mode==='laser'){page=model.index;emit('laser');}});
    svg.addEventListener('wheel',stop,{passive:false});
    // Prevent older touch navigation handlers from treating a pen stroke as a swipe.
    ['touchstart','touchmove','touchend','click','dblclick','contextmenu'].forEach(type=>svg.addEventListener(type,stop,{passive:false}));
    win.addEventListener('blur',()=>{if(pointer!==null){emit('end');release();}if(model.mode==='laser'){page=model.index;emit('laser');}});
    win.addEventListener('resize',layout);
    return {render,layout,element:svg};
  }

  function mount(adapter) {
    if (window.FrontendSlidesPresenter.session) return window.FrontendSlidesPresenter.session;
    if (!adapter || typeof adapter.getIndex !== 'function' || typeof adapter.goTo !== 'function')
      throw new Error('Presenter requires getIndex() and goTo(index) from the deck controller.');
    const slides = () => Array.from(typeof adapter.slides === 'function' ? adapter.slides() : adapter.slides || document.querySelectorAll('.slide'));
    const stage = typeof adapter.stage === 'string' ? document.querySelector(adapter.stage) : adapter.stage || document.querySelector('.deck-stage');
    if (!slides().length || !stage) throw new Error('Presenter requires slides and a fixed stage.');
    document.querySelectorAll('[data-fsp-ui]').forEach(el => el.remove());
    document.documentElement.removeAttribute('data-fsp-presenting');
    const initialSlides = slides();
    const keys = initialSlides.map((slide, i) => slide.id || `slide-${i + 1}`);
    if (new Set(keys).size !== keys.length) throw new Error('Presenter slide IDs must be unique.');
    const deckId = adapter.id || location.pathname + ':' + document.title;
    const storageKey = 'fsp:v1:' + deckId;
    const sessionKey = storageKey + ':session';
    const cached = read('localStorage', storageKey) || {};
    const restored = read('sessionStorage', sessionKey) || {};
    const id = restored.id || 'fsp-' + hash(deckId) + '-' + Math.random().toString(36).slice(2);
    let revision = 0, visualRevision = 0, popup = null, blank = !!restored.blank, saved = true;
    let running = !!restored.running, elapsed = Number(restored.elapsed) || 0;
    let started = Number(restored.started) || Date.now();
    let lastIndex = -1, observerTimer;
    const notes = initialSlides.map((slide, i) => {
      const template = slide.querySelector('template[data-presenter-notes]');
      const source = template ? template.content.textContent.trim() : '';
      const previous = cached[keys[i]];
      return {id: keys[i], source, text: previous && previous.source === source && typeof previous.text === 'string' ? previous.text : source};
    });
    const index = () => Math.max(0, Math.min(slides().length - 1, Number(adapter.getIndex()) || 0));
    const time = () => elapsed + (running ? Math.max(0, Date.now() - started) : 0);
    const persist = () => write('sessionStorage', sessionKey, {id, index: index(), blank, running, elapsed, started});
    const titles = () => slides().map((s, i) => s.dataset.presenterTitle || s.querySelector('h1,h2,h3')?.textContent.trim() || `Slide ${i + 1}`);

    // Isolated chrome never participates in the authored slide layout.
    const host = document.createElement('div');
    host.dataset.fspUi = 'toolbar';
    const shadow = host.attachShadow({mode: 'open'});
    shadow.innerHTML = `<style>
      :host{position:fixed;right:20px;bottom:20px;z-index:2147483647;font:14px system-ui;color:#fff}
      :host([data-presenting]){opacity:0;pointer-events:none}
      button{font:inherit;border:1px solid #64748b;border-radius:9px;padding:10px 15px;background:#17202f;color:#fff;cursor:pointer}
      button:focus-visible{outline:3px solid #a7f3d0;outline-offset:3px}
      #status{max-width:340px;padding:10px;background:#17202f;border-radius:8px;margin-bottom:8px}
      #status:empty{display:none}
      @media print{:host{display:none!important}}
    </style><div id="status" role="status"></div><button type="button" title="Open Presenter Mode (P)">Presenter · P</button>`;
    document.body.append(host);
    const blackout = document.createElement('div');
    blackout.dataset.fspUi = 'blackout';
    blackout.setAttribute('aria-hidden', 'true');
    blackout.style.cssText = 'position:fixed;inset:0;background:#000;z-index:2147483646;pointer-events:none;display:none';
    document.body.append(blackout);
    const printStyle = document.createElement('style');
    printStyle.dataset.fspUi = 'style';
    printStyle.textContent = ':fullscreen [data-fsp-ui="toolbar"],[data-fsp-presenting] .deck-controls,[data-fsp-presenting] .edit-hotzone,[data-fsp-presenting] .edit-toggle{display:none!important}@media print{[data-fsp-ui]{display:none!important}}';
    document.head.append(printStyle);
    // Native Save Page may serialize live chrome *after* this inline script.
    // Prune again once the parser has reached those trailing nodes.
    let boardElement = null;
    const pruneSavedChrome = () => document.querySelectorAll('[data-fsp-ui]').forEach(el => {
      if (el !== host && el !== blackout && el !== printStyle && el !== boardElement) el.remove();
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pruneSavedChrome, {once:true});
    else pruneSavedChrome();
    const status = message => { shadow.getElementById('status').textContent = message; };
    const setBlank = value => { blank = !!value; blackout.style.display = blank ? 'block' : 'none'; stroke=null; laser=null; publishInk(); persist(); };

    // In-session annotations are separate from notes and exported slide content.
    const inkPages = new Map(), inkListeners = new Map();
    let inkMode='off', laser=null, stroke=null, inkIndex=index(), inkRevision=0;
    const inkState = () => ({mode:inkMode,index:inkIndex,inkRevision,laser,blank,
      strokes:inkPages.get(keys[inkIndex])||[],width:adapter.width||stage.offsetWidth||1920,height:adapter.height||stage.offsetHeight||1080});
    const board = annotationSurface(document,()=>stage.getBoundingClientRect(),event=>inkInput(event),'audience');
    function publishInk(){
      const value=inkState();board.render(value);
      for(const [child,fn] of inkListeners){
        try{if(child.closed)inkListeners.delete(child);else fn(value);}catch{inkListeners.delete(child);}
      }
    }
    function syncInkIndex(){
      const next=index();
      if(next!==inkIndex){inkIndex=next;stroke=null;laser=null;inkRevision++;publishInk();}
    }
    function inkInput(event){
      syncInkIndex();
      if(blank||event.index!==inkIndex)return;
      const p=event.point;
      if(p&&(!Array.isArray(p)||p.length!==2||!p.every(n=>Number.isFinite(n)&&n>=0&&n<=1)))return;
      if(inkMode==='laser'&&event.type==='laser'){laser=p;publishInk();return;}
      if(inkMode!=='pen')return;
      if(event.type==='start'&&p&&!stroke){
        const points=[p];let lines=inkPages.get(keys[inkIndex]);
        if(!lines){lines=[];inkPages.set(keys[inkIndex],lines);}lines.push(points);
        stroke={points,source:event.source};
      }else if(stroke?.source===event.source){
        if(event.type==='move'&&p)stroke.points.push(p);
        else if(event.type==='end')stroke=null;
      }else return;
      inkRevision++;publishInk();
    }
    function setTool(mode){
      if(!['off','laser','pen'].includes(mode))return;
      syncInkIndex();inkMode=mode;stroke=null;laser=null;publishInk();
    }
    function clearInk(){syncInkIndex();inkPages.delete(keys[inkIndex]);stroke=null;laser=null;inkRevision++;publishInk();}
    publishInk();

    boardElement=board.element;
    setBlank(blank);

    function openPresenter() {
      if (popup && !popup.closed) { popup.focus(); return popup; }
      // Synchronous window.open preserves user activation, including file://.
      popup = window.open('', id, 'popup=yes,width=1440,height=940');
      if (!popup) { status('弹窗被阻止：请允许此页面打开弹窗，然后再次按 P。'); return null; }
      popup.document.open();
      popup.document.write(presenterHTML());
      popup.document.close();
      host.dataset.presenting = ''; document.documentElement.dataset.fspPresenting = '';
      status('');
      popup.focus();
      return popup;
    }

    function updateTemplate(i) {
      const slide = initialSlides[i];
      let template = slide.querySelector('template[data-presenter-notes]');
      if (!template) { template = document.createElement('template'); template.setAttribute('data-presenter-notes',''); slide.append(template); }
      template.content.textContent = notes[i].text;
    }
    notes.forEach((_, i) => updateTemplate(i));
    function saveNotes(i, text) {
      if (!Number.isInteger(i) || !notes[i] || typeof text !== 'string') return false;
      notes[i].text = text;
      updateTemplate(i);
      const data = Object.fromEntries(notes.map(n => [n.id, {source:n.source, text:n.text}]));
      saved = write('localStorage', storageKey, data);
      revision++;
      return saved;
    }
    function download(content, type, filename) {
      const url = URL.createObjectURL(new Blob([content], {type}));
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
    function exportNotes() {
      download(JSON.stringify({version:1, deckId, slides:notes.map((n, i) => ({id:n.id, title:titles()[i], notes:n.text}))}, null, 2), 'application/json', 'presenter-notes.json');
    }
    function exportHTML() {
      const root = document.documentElement.cloneNode(true);
      root.removeAttribute('data-fsp-presenting');
      root.querySelectorAll('[data-fsp-ui]').forEach(e => e.remove());
      const copies = root.querySelectorAll('[data-fsp-slide]');
      copies.forEach((slide, i) => {
        slide.removeAttribute('data-fsp-slide');
        slide.querySelectorAll('template[data-presenter-notes]').forEach(e => e.remove());
        const template = document.createElement('template');
        template.setAttribute('data-presenter-notes', '');
        template.content.append(document.createTextNode(notes[i]?.text || ''));
        slide.append(template);
      });
      download('<!DOCTYPE html>\n' + root.outerHTML, 'text/html', (document.title.replace(/[^\p{L}\p{N}_-]+/gu, '-') || 'slides') + '-presenter.html');
    }

    // Static, script-free snapshots: preserve CSS/body context, remove all notes and UI.
    // Sandboxed frames prevent event handlers, links and embedded scripts from executing.
    function snapshot(i) {
      const source = slides()[i];
      if (!source) return null;
      const width = adapter.width || stage.offsetWidth || 1920;
      const height = adapter.height || stage.offsetHeight || 1080;
      const root = document.documentElement.cloneNode(true);
      root.querySelectorAll('script,template,[data-fsp-ui],iframe,object,embed,.deck-controls,.edit-hotzone,.edit-toggle').forEach(el => el.remove());
      const copyStage = root.querySelector('[data-fsp-stage]');
      // Keep ancestry (theme classes / CSS variables), omit unrelated chrome.
      let ancestor = copyStage;
      while (ancestor && ancestor.parentElement && ancestor.parentElement.tagName !== 'HTML') {
        Array.from(ancestor.parentElement.children).forEach(el => { if (el !== ancestor) el.remove(); });
        ancestor = ancestor.parentElement;
      }
      root.querySelectorAll('[data-fsp-slide]').forEach((slide, n) => {
        slide.classList.toggle('active', n === i);
        slide.classList.toggle('visible', n === i);
        slide.style.setProperty('visibility', n === i ? 'visible' : 'hidden', 'important');
        slide.style.setProperty('opacity', n === i ? '1' : '0', 'important');
        slide.style.setProperty('z-index', n === i ? '1' : '0', 'important');
      });
      root.querySelectorAll('video,audio').forEach(el => { el.removeAttribute('autoplay'); el.removeAttribute('controls'); });
      root.querySelectorAll('meta[http-equiv]').forEach(el => { if (el.httpEquiv.toLowerCase() === 'refresh') el.remove(); });
      root.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
      // Canvas pixels do not survive DOM cloning. Capture where origin rules permit it.
      const canvases = root.querySelectorAll('canvas');
      stage.querySelectorAll('canvas').forEach((canvas, n) => {
        try { const img = document.createElement('img'); img.src = canvas.toDataURL(); img.style.cssText = canvas.style.cssText; img.className = canvas.className; canvases[n]?.replaceWith(img); } catch { /* Tainted canvas remains a static placeholder. */ }
      });
      const head = root.querySelector('head');
      // Remove comments too: legacy decks can contain speaker-note comments.
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
      const comments = []; while (walker.nextNode()) comments.push(walker.currentNode);
      comments.forEach(comment => comment.remove());
      root.querySelectorAll('base').forEach(el => el.remove());
      const base = document.createElement('base'); base.href = document.baseURI; head.prepend(base);
      const style = document.createElement('style');
      style.textContent = `html,body{width:100%!important;height:100%!important;overflow:hidden!important;margin:0!important}
        [data-fsp-stage]{position:absolute!important;left:0!important;top:0!important;width:${width}px!important;height:${height}px!important;transform-origin:0 0!important}
        *,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}
        .visible .reveal{opacity:1!important;transform:none!important}
        a,button,input,video{pointer-events:none!important}`;
      head.append(style);
      return {html:'<!DOCTYPE html>\n' + root.outerHTML, width, height};
    }

    initialSlides.forEach(s => s.setAttribute('data-fsp-slide', ''));
    stage.setAttribute('data-fsp-stage', '');
    // Observe DOM changes without wrapping or replacing any upstream method.
    const observer = new MutationObserver(records => {
      syncInkIndex(); board.layout();
      if (records.every(r => r.target === stage && r.type === 'attributes' && r.attributeName === 'style')) return;
      clearTimeout(observerTimer);
      observerTimer = setTimeout(() => { revision++; visualRevision++; }, 60);
    });
    observer.observe(stage, {subtree:true, attributes:true, childList:true, characterData:true});
    const session = {
      id, version:VERSION,
      inkState, inkInput, setTool, clearInk,
      subscribeInk(child, fn) { if(child.opener!==window)return; inkListeners.set(child,fn);fn(inkState()); },
      unsubscribeInk(child) { inkListeners.delete(child); },
      connect(child) { if (child.opener !== window) return false; popup = child; host.dataset.presenting = ''; document.documentElement.dataset.fspPresenting = ''; return true; },
      state() {
        const current = index(); syncInkIndex();
        if (current !== lastIndex) { lastIndex = current; revision++; visualRevision++; persist(); }
        return {id, revision, visualRevision, index:current, count:notes.length, titles:titles(), notes:notes.map(n => n.text), blank, running, elapsed:time(), saved};
      },
      goTo(i) { if (!Number.isFinite(i)) return; adapter.goTo(Math.max(0, Math.min(slides().length - 1, Math.trunc(i)))); syncInkIndex(); revision++; persist(); },
      saveNotes, snapshot, exportNotes, exportHTML, open:openPresenter,
      blank(value = !blank) { setBlank(value); },
      timer(action) {
        if (action === 'reset') { elapsed = 0; started = Date.now(); }
        else { elapsed = time(); started = Date.now(); running = !running; }
        persist();
      },
      async fullscreen(screen) {
        if (!document.documentElement.requestFullscreen) throw new Error('当前浏览器不支持网页全屏，请使用浏览器全屏菜单。');
        if (document.fullscreenElement && !screen) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen(screen ? {screen} : undefined);
      }
    };
    window.FrontendSlidesPresenter.session = session;
    if (Number.isInteger(restored.index)) session.goTo(restored.index);
    shadow.querySelector('button').addEventListener('click', openPresenter);
    window.addEventListener('pagehide', persist);
    window.addEventListener('keydown', event => {
      if (event.isComposing || editable(event.composedPath()[0]) || event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (!['p','b','f','l','d'].includes(key) && !(key==='escape'&&inkMode!=='off')) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.repeat) return;
      if (key === 'l') setTool(inkMode==='laser'?'off':'laser');
      if (key === 'd') setTool(inkMode==='pen'?'off':'pen');
      if (key === 'escape') setTool('off');
      if (key === 'p') openPresenter();
      if (key === 'b') session.blank();
      if (key === 'f') session.fullscreen().catch(() => status('请使用浏览器全屏菜单，或在观众窗口按 F 重试。'));
    }, true);
    setInterval(() => { if (popup?.closed) { popup = null; delete host.dataset.presenting; delete document.documentElement.dataset.fspPresenting; } }, 500);
    return session;
  }

  function presenterHTML() {
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Presenter — Frontend Slides</title><style>${presenterCSS()}</style></head><body>
      <header><div class="brand"><span class="mark">◧</span><strong>Presenter</strong><span id="connection" role="status">连接中</span></div><div class="clock-group"><span id="clock"></span><strong id="timer">00:00</strong><button id="timerToggle">开始计时</button><button id="timerReset" title="重置计时">↺</button></div></header>
      <main><section class="slides-panel"><div class="label"><span>当前页面 · CURRENT</span><span id="counter"></span></div><div class="preview current"><iframe id="current" title="当前幻灯片预览" sandbox="allow-same-origin" tabindex="-1"></iframe><span class="badge" id="blackBadge" hidden>观众屏幕已黑屏</span></div>
      <div class="annotation-tools" role="group" aria-label="屏幕批注"><button id="toolOff" aria-pressed="true">鼠标</button><button id="toolLaser" aria-pressed="false">◉ 蓝色激光笔 · L</button><button id="toolPen" aria-pressed="false">✎ 画笔 · D</button><button id="clearInk">清除本页批注</button></div><div class="next-row"><div class="next-preview"><div class="label">下一页 · NEXT</div><div class="preview"><iframe id="next" title="下一张幻灯片预览" sandbox="allow-same-origin" tabindex="-1"></iframe><span id="end" hidden>已到最后一页</span></div></div><div class="navigation"><label for="jump">跳转到页面</label><select id="jump"></select><div class="nav-buttons"><button id="previous" title="上一页 (←)">← 上一页</button><button id="forward" title="下一页 (→ / Space)">下一页 →</button></div><button id="blank">黑屏 · B</button><p>← → 翻页 · Home / End 首尾页<br>讲稿编辑时，快捷键暂停</p></div></div></section>
      <section class="notes-panel"><div class="label"><label for="notes">演讲者讲稿 · NOTES</label><div><button id="smaller" title="缩小讲稿字号">A−</button><button id="larger" title="放大讲稿字号">A+</button></div></div><h1 id="slideTitle"></h1><textarea id="notes" spellcheck="false" placeholder="为这一页添加讲稿…"></textarea><div class="notes-footer"><span id="saveStatus" role="status">讲稿仅在此窗口显示</span><button id="exportNotes">导出讲稿</button><button id="exportHTML">保存 HTML</button></div></section></main>
      <footer><div class="display-controls"><button id="screens">选择显示器</button><select id="screenList" aria-label="观众显示器" hidden></select><button id="fullscreen">观众全屏 · F</button><button id="helpToggle" aria-expanded="false">双屏设置</button></div><span id="message" role="status">本窗口留在电脑；将原 slides 窗口拖到扩展屏。</span></footer>
      <aside id="help" hidden><strong>让观众只看到 slides</strong><ol><li>在系统显示设置中选择“扩展桌面”，关闭镜像。</li><li>将本 Presenter 窗口留在电脑；将原 slides 窗口拖到大屏。</li><li>点击大屏上的 slides，再按 F 进入全屏；回来用本窗口翻页。</li></ol><p>屏幕共享时只共享 slides 窗口。讲稿不会显示或打印在幻灯片中；带讲稿 HTML 的源码仍含讲稿。浏览器可能限制自动选屏或远程全屏。</p><p>预览是静态画面，动画、视频和交互继续在观众窗口运行。开启激光笔或画笔后，在当前页预览或观众画面操作；Esc 恢复鼠标。批注按页保留于本次演示，刷新观众窗口后清空，不写入讲稿或导出的 HTML。</p></aside>
      <script>(${presenterClient.toString()})(${annotationSurface.toString()});<\/script></body></html>`;
  }

  function presenterCSS() {
    return `:root{color-scheme:dark;font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#e6e9ee;background:#101317}*{box-sizing:border-box}body{margin:0;height:100vh;display:flex;flex-direction:column}button,select,textarea{font:inherit;color:inherit}button,select{background:#232830;border:1px solid #3c434e;border-radius:7px;padding:9px 12px;cursor:pointer}button:hover{background:#303743}button:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid #99e4c7;outline-offset:3px}button:disabled{opacity:.35;cursor:default}[hidden]{display:none!important}header{display:flex;justify-content:space-between;align-items:center;padding:17px 26px;border-bottom:1px solid #30343c;gap:12px}.brand,.clock-group{display:flex;align-items:center;gap:14px}.brand strong{font-size:19px;letter-spacing:-.5px}.mark{color:#99e4c7;font-size:26px}#connection{font-size:12px;color:#99e4c7}#connection.offline{color:#ffbd90}#clock{color:#a2abb8;font-variant-numeric:tabular-nums}#timer{font-size:26px;font-variant-numeric:tabular-nums;margin:0 6px}main{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(320px,1fr);gap:28px;padding:24px 26px}.slides-panel{min-width:0;min-height:0;display:flex;flex-direction:column}.label{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:11px;font-weight:600;letter-spacing:1.5px;color:#a7afbb;margin-bottom:12px}.preview{position:relative;aspect-ratio:16/9;background:#050607;border:1px solid #39414c;border-radius:8px;overflow:hidden}.preview iframe{display:block;width:100%;height:100%;border:0;pointer-events:none}.current{flex:1;min-height:0;aspect-ratio:auto;box-shadow:0 8px 28px #0004}.badge,#end{position:absolute;inset:0;display:grid;place-items:center;background:#000b;color:#fff;font-size:18px}.annotation-tools{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.annotation-tools button{font-size:12px;padding:8px}.annotation-tools [aria-pressed="true"]{background:#113d64;border-color:#39a9ff;color:#c6e9ff}.next-row{flex:none;display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:23px}.navigation{padding-top:3px;display:flex;flex-direction:column;gap:12px;min-width:0}.navigation label{color:#a7afbb;font-size:12px}.navigation select{width:100%;text-overflow:ellipsis}.nav-buttons{display:flex;gap:8px}.nav-buttons button{flex:1;white-space:nowrap}#forward{background:#9ce7c7;color:#11231b;border-color:#9ce7c7}#blank[aria-pressed="true"]{border-color:#f9bd7e;color:#f9bd7e}.navigation p{margin:0;color:#8993a2;font-size:12px;line-height:1.9}.notes-panel{display:flex;flex-direction:column;min-width:0;min-height:0;background:#191e25;border:1px solid #303943;border-radius:12px;padding:20px 22px}.notes-panel .label button{padding:5px 8px;margin-left:4px}.notes-panel h1{font-size:20px;font-weight:500;margin:5px 0 18px;line-height:1.5;overflow-wrap:anywhere}textarea{flex:1;min-height:140px;width:100%;resize:none;border:0;background:transparent;font-size:24px;line-height:1.8;padding:4px 3px;outline:none;white-space:pre-wrap}textarea::placeholder{color:#697583}.notes-footer{display:flex;align-items:center;gap:10px;padding-top:15px;border-top:1px solid #343c47}.notes-footer span{flex:1;font-size:11px;color:#9ca9b8}.notes-footer button{font-size:12px;padding:8px}footer{display:flex;gap:16px;align-items:center;padding:14px 26px;border-top:1px solid #30343c;color:#99a4b3;font-size:12px}.display-controls{display:flex;gap:8px;flex-wrap:wrap;min-width:0}.display-controls select{max-width:240px}footer button,footer select{font-size:12px}#message{line-height:1.6}#help{position:fixed;bottom:78px;left:26px;width:min(510px,calc(100vw - 52px));background:#252d37;border:1px solid #546270;border-radius:12px;padding:24px;box-shadow:0 15px 60px #0009;line-height:1.9;font-size:14px}#help p{color:#b3bfcd;font-size:12px}#help li{margin:6px 0}@media(max-width:900px){body{height:auto;min-height:100vh}main{grid-template-columns:1fr;overflow:visible}.current{flex:none;aspect-ratio:16/9}.notes-panel{min-height:450px}footer{flex-wrap:wrap}header{flex-wrap:wrap}}@media(max-height:750px) and (min-width:901px){header{padding:10px 20px}main{padding:15px 20px;gap:20px}.next-row{margin-top:14px;gap:15px}.navigation{gap:7px}.navigation p{display:none}.notes-panel{padding:15px}footer{padding:10px 20px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}`;
  }

  // Runs in the popup's own realm, so it can reconnect after the audience reloads.
  // Same-origin opener RPC needs no server, broadcast channels, or storage events.
  function presenterClient(annotationSurface) {
    'use strict';
    const $ = id => document.getElementById(id);
    let api = null, state = null, stamp = '', currentIndex = -1, screens = [], fontSize = 24;
    let connectedAPI = null, visualStamp = '';
    let inkModel=null;
    const inkBoard=annotationSurface(document,()=>{
      const frame=$('current'),r=frame.getBoundingClientRect(),size=frame._size||{width:1920,height:1080};
      const scale=Math.min(r.width/size.width,r.height/size.height);
      return {left:r.left+(r.width-size.width*scale)/2,top:r.top+(r.height-size.height*scale)/2,width:size.width*scale,height:size.height*scale};
    },event=>{if(api)api.inkInput(event);},'presenter');
    function renderInk(value){
      inkModel=value;inkBoard.render(value);
      for(const [id,mode] of [['toolOff','off'],['toolLaser','laser'],['toolPen','pen']])$(id).setAttribute('aria-pressed',String(value.mode===mode));
    }
    window.addEventListener('scroll',()=>inkBoard.layout(),true);
    window.addEventListener('pagehide',()=>{try{api?.unsubscribeInk(window);}catch{}});
    const message = text => { $('message').textContent = text; };
    const editable = target => !!target.closest('textarea,input,select,[contenteditable]');
    const formatTime = ms => {
      const seconds = Math.floor(ms / 1000);
      return (seconds >= 3600 ? String(Math.floor(seconds / 3600)).padStart(2,'0') + ':' : '') + String(Math.floor(seconds / 60) % 60).padStart(2,'0') + ':' + String(seconds % 60).padStart(2,'0');
    };
    const action = fn => {
      try { if (!api) throw new Error('观众窗口未连接。'); fn(api); refresh(); }
      catch (error) { message(error.message); }
    };
    function fit(frame) {
      const size = frame._size;
      const stage = frame.contentDocument?.querySelector('[data-fsp-stage]');
      if (!size || !stage) return;
      const scale = Math.min(frame.clientWidth / size.width, frame.clientHeight / size.height);
      stage.style.setProperty('transform', `translate(${(frame.clientWidth-size.width*scale)/2}px,${(frame.clientHeight-size.height*scale)/2}px) scale(${scale})`, 'important');
      inkBoard.layout();
    }
    ['current','next'].forEach(id => {
      const frame = $(id);
      frame.addEventListener('load', () => fit(frame));
      new ResizeObserver(() => fit(frame)).observe(frame);
    });
    function preview(frame, snapshot) {
      frame._size = snapshot;
      if (!snapshot) { frame.srcdoc = ''; return; }
      frame.srcdoc = snapshot.html;
    }
    function refresh() {
      try {
        if (!window.opener || window.opener.closed) throw new Error('closed');
        api = window.opener.FrontendSlidesPresenter?.session;
        if (!api) throw new Error('loading');
        if (connectedAPI !== api) { api.connect(window); api.subscribeInk(window,renderInk); connectedAPI = api; stamp = ''; visualStamp = ''; }
        state = api.state();
        $('connection').textContent = '● 已连接'; $('connection').className = ''; $('connection').title='';
        document.querySelectorAll('[data-needs-connection]').forEach(el => { el.disabled = false; });
        $('timer').textContent = formatTime(state.elapsed);
        $('timerToggle').textContent = state.running ? '暂停计时' : '开始计时';
        $('blackBadge').hidden = !state.blank;
        $('blank').setAttribute('aria-pressed', String(state.blank));
        $('blank').textContent = state.blank ? '恢复画面 · B' : '黑屏 · B';
        $('previous').disabled = state.index === 0;
        $('forward').disabled = state.index === state.count - 1;
        const nextStamp = state.id + ':' + state.revision;
        if (nextStamp !== stamp) {
          // Input saves synchronously. Never replace a focused editor's selection on its own save.
          if (currentIndex !== state.index || document.activeElement !== $('notes')) {
            if ($('notes').value !== state.notes[state.index]) $('notes').value = state.notes[state.index] || '';
            if (currentIndex !== state.index) $('notes').scrollTop = 0;
          }
          currentIndex = state.index;
          $('counter').textContent = `${state.index + 1} / ${state.count}`;
          $('slideTitle').textContent = state.titles[state.index];
          const labels = JSON.stringify(state.titles);
          if ($('jump').dataset.labels !== labels) {
            $('jump').replaceChildren(...state.titles.map((title, i) => new Option(`${i + 1} · ${title}`, i)));
            $('jump').dataset.labels = labels;
          }
          $('jump').value = state.index;
          const nextVisualStamp = state.id + ':' + state.visualRevision;
          if (nextVisualStamp !== visualStamp) {
            preview($('current'), api.snapshot(state.index));
            preview($('next'), api.snapshot(state.index + 1));
            visualStamp = nextVisualStamp;
          }
          $('end').hidden = state.index + 1 < state.count;
          $('saveStatus').textContent = state.saved ? '讲稿自动保存于本浏览器' : '浏览器存储不可用，请保存 HTML 或导出讲稿';
          stamp = nextStamp;
        }
      } catch (error) {
        $('connection').title=error.message;
        api = null; connectedAPI=null;
        inkBoard.render({mode:'off',index:-1,inkRevision:0,strokes:[],laser:null,blank:true,width:1920,height:1080});
        $('connection').textContent = '● 观众窗口已断开'; $('connection').className = 'offline';
        document.querySelectorAll('[data-needs-connection]').forEach(el => { el.disabled = true; });
      }
      $('clock').textContent = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    }
    ['previous','forward','jump','notes','blank','timerToggle','timerReset','exportNotes','exportHTML','fullscreen','toolOff','toolLaser','toolPen','clearInk'].forEach(id => $(id).setAttribute('data-needs-connection',''));
    $('toolOff').onclick=()=>action(a=>a.setTool('off'));
    $('toolLaser').onclick=()=>action(a=>a.setTool(inkModel?.mode==='laser'?'off':'laser'));
    $('toolPen').onclick=()=>action(a=>a.setTool(inkModel?.mode==='pen'?'off':'pen'));
    $('clearInk').onclick=()=>action(a=>a.clearInk());
    $('previous').onclick = () => action(a => a.goTo(state.index - 1));
    $('forward').onclick = () => action(a => a.goTo(state.index + 1));
    $('jump').onchange = () => action(a => a.goTo(Number($('jump').value)));
    $('blank').onclick = () => action(a => a.blank());
    $('timerToggle').onclick = () => action(a => a.timer('toggle'));
    $('timerReset').onclick = () => action(a => a.timer('reset'));
    $('notes').addEventListener('input', () => {
      if (api && currentIndex >= 0) api.saveNotes(currentIndex, $('notes').value);
    });
    $('smaller').onclick = () => { fontSize = Math.max(16, fontSize - 2); $('notes').style.fontSize = fontSize + 'px'; };
    $('larger').onclick = () => { fontSize = Math.min(48, fontSize + 2); $('notes').style.fontSize = fontSize + 'px'; };
    $('exportNotes').onclick = () => action(a => a.exportNotes());
    $('exportHTML').onclick = () => action(a => a.exportHTML());
    $('helpToggle').onclick = () => { $('help').hidden = !$('help').hidden; $('helpToggle').setAttribute('aria-expanded', String(!$('help').hidden)); };
    $('screens').onclick = async () => {
      if (!window.getScreenDetails) { message('此浏览器不支持自动选屏。请将原 slides 窗口拖到扩展屏，再在其中按 F。'); return; }
      try {
        const details = await window.getScreenDetails();
        screens = Array.from(details.screens);
        $('screenList').replaceChildren(...screens.map((screen, i) => new Option(screen.label || `显示器 ${i + 1} · ${screen.width}×${screen.height}`, i)));
        $('screenList').hidden = false;
        message('选择观众显示器后点“观众全屏”；本窗口留在电脑。');
      } catch { message('未获得显示器权限。请手动拖动原 slides 窗口到扩展屏，在其中按 F。'); }
    };
    async function fullscreen() {
      if (!api) return;
      try { await api.fullscreen(screens[Number($('screenList').value)]); }
      catch { message('浏览器限制远程全屏：请点击大屏上的 slides，再按 F；也可使用浏览器全屏菜单。'); }
    }
    $('fullscreen').onclick = fullscreen;
    window.addEventListener('keydown', event => {
      if (event.isComposing || editable(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (!['arrowright','arrowdown','pagedown',' ','arrowleft','arrowup','pageup','home','end','b','f','l','d','escape'].includes(key)) return;
      event.preventDefault();
      if (event.repeat && ['b','f','l','d'].includes(key)) return;
      if (key === 'f') { fullscreen(); return; }
      action(a => {
        if (['arrowright','arrowdown','pagedown',' '].includes(key)) a.goTo(state.index + 1);
        else if (['arrowleft','arrowup','pageup'].includes(key)) a.goTo(state.index - 1);
        else if (key === 'home') a.goTo(0);
        else if (key === 'end') a.goTo(state.count - 1);
        else if (key === 'b') a.blank();
        else if (key === 'l') a.setTool(inkModel?.mode==='laser'?'off':'laser');
        else if (key === 'd') a.setTool(inkModel?.mode==='pen'?'off':'pen');
        else if (key === 'escape') a.setTool('off');
      });
    });
    refresh();
    setInterval(refresh, 200);
  }
  window.FrontendSlidesPresenter = {version:VERSION, mount};
})();
