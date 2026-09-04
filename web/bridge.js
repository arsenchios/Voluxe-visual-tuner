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

  // Editable = has no child elements other than <br> line breaks, so plain
  // text (with manual line breaks) can be swapped without touching structure.
  function isEditable(element) {
    return [...element.children].every(child => child.tagName === 'BR');
  }
  function editableText(element) {
    const copy = element.cloneNode(true);
    copy.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    return copy.textContent;
  }

  function snapshot(element) {
    const styles = getComputedStyle(element);
    const computed = {};
    PROPS.forEach(prop => computed[prop] = styles.getPropertyValue(prop));
    const rect = element.getBoundingClientRect();
    const editable = isEditable(element);
    return { type:'selected', selector: selectorFor(element), label: labelFor(element), tag: element.tagName.toLowerCase(), computed, rect: { width: Math.round(rect.width), height: Math.round(rect.height) }, editable, text: editable ? editableText(element) : '' };
  }

  function escapeHtml(text) {
    const box = document.createElement('div');
    box.textContent = text;
    return box.innerHTML;
  }

  // Content operations (text edits, duplicate, delete) are DOM mutations, not
  // CSS, so they are re-applied from scratch every time the page (re)loads —
  // see 'apply-content' below. Applying the same op twice must stay harmless.
  function applyOneOp(op) {
    if (!op || !op.selector) return;
    if (op.op === 'text') {
      const target = document.querySelector(op.selector);
      if (target) target.innerHTML = escapeHtml(op.text || '').replace(/\n/g, '<br>');
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
    send(snapshot(element));
  }, true);

  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin || !event.data?.visualTuner) return;
    if (event.data.type === 'rescan' && selected) send(snapshot(selected));
    if (event.data.type === 'set-overrides') setOverrides(event.data.css || '', event.data.enabled !== false);
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
