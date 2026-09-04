(() => {
  const STYLE_ID = 'visual-tuner-selection-style';
  const OVERRIDES_ID = 'visual-tuner-runtime-overrides';
  const PROPS = [
    'font-size', 'line-height', 'letter-spacing', 'font-weight', 'text-align', 'white-space',
    'width', 'height', 'max-width', 'margin', 'padding', 'gap',
    'color', 'opacity', 'border-radius', 'z-index', 'object-fit', 'object-position',
    'position', 'top', 'left', 'display', 'flex-direction', 'justify-content',
    'align-items', 'grid-template-columns'
  ];
  let selected = null;
  let hovering = null;

  function ensureStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = '[data-vt-hover]{outline:1px solid #b8ff56 !important;outline-offset:2px !important;cursor:crosshair !important;}[data-vt-selected]{outline:2px solid #6ea8ff !important;outline-offset:2px !important;}';
      document.head.append(style);
    }
  }

  function setOverrides(css, enabled) {
    let style = document.getElementById(OVERRIDES_ID);
    if (!style) { style = document.createElement('style'); style.id = OVERRIDES_ID; document.head.append(style); }
    style.textContent = enabled ? css : '';
  }

  function cssEscape(value) {
    return window.CSS?.escape ? CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function unique(selector) {
    try { return document.querySelectorAll(selector).length === 1; } catch { return false; }
  }

  function part(element) {
    const tag = element.tagName.toLowerCase();
    if (element.id) return '#' + cssEscape(element.id);
    const usable = [...element.classList].filter(name => name && !name.startsWith('vt-')).slice(0, 2);
    return tag + usable.map(name => '.' + cssEscape(name)).join('');
  }

  function selectorFor(element) {
    // Elements created by Duplicate carry a unique data-vt-node marker — always
    // address them through it so style/content rules survive DOM reshuffles.
    if (element.hasAttribute('data-vt-node')) return `[data-vt-node="${cssEscape(element.getAttribute('data-vt-node'))}"]`;
    // Use the outer app id and the closest local id where they exist. Besides
    // being stable, this safely wins against common component selectors such
    // as `#app .hero__title` without needing inline styles or !important.
    const ids = [];
    let idAncestor = element;
    while (idAncestor && idAncestor !== document.documentElement) {
      if (idAncestor.id) ids.unshift('#' + cssEscape(idAncestor.id));
      idAncestor = idAncestor.parentElement;
    }
    if (ids.length) {
      const anchors = ids.length > 1 ? [ids[0], ids[ids.length - 1]] : ids;
      const localParts = [];
      let local = element;
      const nearestId = element.closest('[id]');
      while (local && local !== nearestId) { localParts.unshift(part(local)); local = local.parentElement; }
      const scoped = anchors.join(' ') + (localParts.length ? ' ' + localParts.join(' > ') : '');
      if (unique(scoped)) return scoped;
    }
    const parts = [];
    let current = element;
    while (current && current !== document.body && parts.length < 6) {
      const currentPart = part(current);
      parts.unshift(currentPart);
      const candidate = parts.join(' > ');
      if (unique(candidate)) return candidate;
      current = current.parentElement;
    }
    const ancestors = [];
    current = element;
    while (current && current !== document.documentElement && ancestors.length < 7) {
      const tag = current.tagName.toLowerCase();
      let index = 1;
      let sibling = current;
      while ((sibling = sibling.previousElementSibling)) if (sibling.tagName === current.tagName) index++;
      ancestors.unshift(`${tag}:nth-of-type(${index})`);
      const candidate = ancestors.join(' > ');
      if (unique(candidate)) return candidate;
      current = current.parentElement;
    }
    return parts.join(' > ') || element.tagName.toLowerCase();
  }

  function labelFor(element) {
    const text = (element.getAttribute('aria-label') || element.alt || element.textContent || '').trim().replace(/\s+/g, ' ');
    return `<${element.tagName.toLowerCase()}>${text ? ' ' + text.slice(0, 54) : ''}`;
  }

  // Editable = every descendant is either a <br> line break or one of these
  // inline emphasis tags (real headlines often highlight one phrase in a
  // different colour/style via <em>). Emphasis round-trips through
  // Telegram-style markers so a non-coder can keep it without touching HTML:
  // _italic accent_ and *bold*.
  const INLINE_MARK_TAGS = { EM: '_', I: '_', B: '*', STRONG: '*' };
  const INLINE_MARK_CHARS = { _: 'em', '*': 'strong' };
  function isEditable(element) {
    return [...element.children].every(child => child.tagName === 'BR' || (INLINE_MARK_TAGS[child.tagName] && isEditable(child)));
  }
  function editableText(element) {
    let out = '';
    element.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) out += node.textContent;
      else if (node.tagName === 'BR') out += '\n';
      else if (INLINE_MARK_TAGS[node.tagName]) { const mark = INLINE_MARK_TAGS[node.tagName]; out += mark + editableText(node) + mark; }
    });
    return out;
  }
  // Builds real DOM nodes from marker text (never innerHTML), so there is no
  // HTML-injection surface even though the user is typing "tags" of a sort.
  function parseEditableText(text) {
    const frag = document.createDocumentFragment();
    String(text).split('\n').forEach((line, i) => {
      if (i > 0) frag.append(document.createElement('br'));
      let lastIndex = 0;
      const re = /(_[^_\n]+_|\*[^*\n]+\*)/g;
      let match;
      while ((match = re.exec(line))) {
        if (match.index > lastIndex) frag.append(document.createTextNode(line.slice(lastIndex, match.index)));
        const token = match[0];
        const el = document.createElement(INLINE_MARK_CHARS[token[0]]);
        el.textContent = token.slice(1, -1);
        frag.append(el);
        lastIndex = match.index + token.length;
      }
      if (lastIndex < line.length) frag.append(document.createTextNode(line.slice(lastIndex)));
    });
    return frag;
  }

  function snapshot(element) {
    const styles = getComputedStyle(element);
    const computed = {};
    PROPS.forEach(prop => computed[prop] = styles.getPropertyValue(prop));
    const rect = element.getBoundingClientRect();
    const editable = isEditable(element);
    return { type:'selected', selector: selectorFor(element), label: labelFor(element), tag: element.tagName.toLowerCase(), computed, rect: { width: Math.round(rect.width), height: Math.round(rect.height) }, editable, text: editable ? editableText(element) : '' };
  }

  // Content operations (text edits, duplicate, delete) are DOM mutations, not
  // CSS, so they are re-applied from scratch every time the page (re)loads —
  // see 'apply-content' below. Applying the same op twice must stay harmless.
  function applyOneOp(op) {
    if (!op || !op.selector) return;
    if (op.op === 'text') {
      const target = document.querySelector(op.selector);
      if (target) target.replaceChildren(parseEditableText(op.text || ''));
    } else if (op.op === 'duplicate') {
      if (document.querySelector(`[data-vt-node="${cssEscape(op.newId)}"]`)) return;
      const source = document.querySelector(op.selector);
      if (!source) return;
      const dupe = source.cloneNode(true);
      dupe.removeAttribute('id');
      dupe.removeAttribute('data-vt-hover');
      dupe.removeAttribute('data-vt-selected');
      dupe.querySelectorAll('[data-vt-hover],[data-vt-selected]').forEach(node => { node.removeAttribute('data-vt-hover'); node.removeAttribute('data-vt-selected'); });
      dupe.setAttribute('data-vt-node', op.newId);
      source.after(dupe);
    } else if (op.op === 'delete') {
      document.querySelector(op.selector)?.remove();
    }
  }
  function applyContentOps(ops) { (ops || []).forEach(applyOneOp); }

  function send(payload) { window.parent.postMessage({ visualTuner: true, ...payload }, window.location.origin); }
  function isTunerNode(element) { return !element || element.closest('[data-vt-ignore]'); }

  // Alignment guides — while a size/position number is being typed, flash
  // thin lines where the selected element's edges line up with the
  // viewport, its parent, or its siblings. Visual only, never touches values.
  const GUIDE_LAYER_ID = 'visual-tuner-guides';
  const GUIDE_THRESHOLD = 4;
  let guidesActive = false;

  function guideLayer() {
    let layer = document.getElementById(GUIDE_LAYER_ID);
    if (!layer) {
      layer = document.createElement('div');
      layer.id = GUIDE_LAYER_ID;
      layer.setAttribute('data-vt-ignore', '');
      layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
      document.body.append(layer);
    }
    return layer;
  }
  function clearGuides() { document.getElementById(GUIDE_LAYER_ID)?.replaceChildren(); }

  function guideCandidates(element) {
    const xs = new Set(), ys = new Set();
    const collect = rect => {
      if (!rect || (!rect.width && !rect.height)) return;
      xs.add(Math.round(rect.left)); xs.add(Math.round(rect.right)); xs.add(Math.round((rect.left + rect.right) / 2));
      ys.add(Math.round(rect.top)); ys.add(Math.round(rect.bottom)); ys.add(Math.round((rect.top + rect.bottom) / 2));
    };
    collect({ left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight, width: window.innerWidth, height: window.innerHeight });
    if (element.parentElement) collect(element.parentElement.getBoundingClientRect());
    [...(element.parentElement?.children || [])].forEach(sibling => { if (sibling !== element && sibling.nodeType === 1) collect(sibling.getBoundingClientRect()); });
    return { xs, ys };
  }

  function drawGuides(element) {
    const layer = guideLayer();
    layer.replaceChildren();
    const rect = element.getBoundingClientRect();
    if (!rect.width && !rect.height) return;
    const { xs, ys } = guideCandidates(element);
    const mineX = [rect.left, rect.right, (rect.left + rect.right) / 2];
    const mineY = [rect.top, rect.bottom, (rect.top + rect.bottom) / 2];
    const drawnX = new Set(), drawnY = new Set();
    mineX.forEach(pos => xs.forEach(candidate => {
      if (!drawnX.has(candidate) && Math.abs(candidate - pos) <= GUIDE_THRESHOLD) {
        drawnX.add(candidate);
        const line = document.createElement('div');
        line.style.cssText = `position:fixed;left:${candidate}px;top:0;width:0;height:100vh;border-left:1px solid #ff4fd8;`;
        layer.append(line);
      }
    }));
    mineY.forEach(pos => ys.forEach(candidate => {
      if (!drawnY.has(candidate) && Math.abs(candidate - pos) <= GUIDE_THRESHOLD) {
        drawnY.add(candidate);
        const line = document.createElement('div');
        line.style.cssText = `position:fixed;top:${candidate}px;left:0;height:0;width:100vw;border-top:1px solid #ff4fd8;`;
        layer.append(line);
      }
    }));
  }

  document.addEventListener('pointermove', event => {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    if (!element || element === hovering || isTunerNode(element)) return;
    ensureStyle();
    hovering?.removeAttribute('data-vt-hover');
    hovering = element;
    hovering.setAttribute('data-vt-hover', '');
    send({ type:'hover', selector: selectorFor(element), label: labelFor(element) });
  }, true);

  document.addEventListener('pointerleave', () => { hovering?.removeAttribute('data-vt-hover'); hovering = null; }, true);

  document.addEventListener('click', event => {
    if (event.altKey) return; // Alt-click keeps normal site interactions available.
    let element = document.elementFromPoint(event.clientX, event.clientY);
    if (!element || isTunerNode(element)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.shiftKey) element = element.closest('section, article, main, header, footer, nav, aside') || element;
    ensureStyle();
    selected?.removeAttribute('data-vt-selected');
    selected = element;
    selected.setAttribute('data-vt-selected', '');
    guidesActive = false; clearGuides();
    send(snapshot(element));
  }, true);

  // Arrow keys nudge the selected element's on-screen position (1px, 10px with Shift).
  // The parent applies this as position:relative + top/left so surrounding layout is untouched.
  const NUDGE_KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  document.addEventListener('keydown', event => {
    if (!selected || isTunerNode(event.target)) return;
    const editableTarget = ['input', 'textarea', 'select'].includes((event.target.tagName || '').toLowerCase()) || event.target.isContentEditable;
    if (editableTarget) return;
    const delta = NUDGE_KEYS[event.key];
    if (!delta) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    send({ type:'nudge', dx: delta[0] * step, dy: delta[1] * step });
  }, true);

  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin || !event.data?.visualTuner) return;
    if (event.data.type === 'rescan' && selected) { send(snapshot(selected)); if (guidesActive) drawGuides(selected); }
    if (event.data.type === 'set-overrides') setOverrides(event.data.css || '', event.data.enabled !== false);
    if (event.data.type === 'show-guides') { guidesActive = true; if (selected) drawGuides(selected); }
    if (event.data.type === 'hide-guides') { guidesActive = false; clearGuides(); }
    if (event.data.type === 'apply-content') applyContentOps(event.data.ops);
    if (event.data.type === 'content-op') {
      applyOneOp(event.data.op);
      if (event.data.op?.op === 'duplicate') {
        const dupe = document.querySelector(`[data-vt-node="${cssEscape(event.data.op.newId)}"]`);
        if (dupe) { selected?.removeAttribute('data-vt-selected'); selected = dupe; selected.setAttribute('data-vt-selected', ''); send(snapshot(selected)); }
      }
    }
    if (event.data.type === 'select-parent' && selected?.parentElement) {
      selected.removeAttribute('data-vt-selected');
      selected = selected.parentElement;
      selected.setAttribute('data-vt-selected', '');
      send(snapshot(selected));
    }
    if (event.data.type === 'select') {
      try {
        const target = document.querySelector(event.data.selector);
        if (target) { selected?.removeAttribute('data-vt-selected'); selected = target; selected.setAttribute('data-vt-selected', ''); send(snapshot(selected)); }
      } catch { /* invalid selectors are handled by the parent UI */ }
    }
  });

  window.parent !== window && send({ type:'ready' });
})();
