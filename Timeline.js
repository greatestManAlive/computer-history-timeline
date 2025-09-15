(() => {
  const VISIBLE = 7;
  const TOTAL = 14;
  const track = document.getElementById('track');
  const viewport = document.getElementById('viewport');

  const sourceCards = Array.from(document.querySelectorAll('.timeline-track .timeline-card'));
  const originals = [];

  // Build slots from your HTML cards (copy data-url if present)
  if (sourceCards.length === TOTAL) {
    sourceCards.forEach((card, i) => {
      const el = document.createElement('div');
      el.className = 'slot';
      el.dataset.index = i + 1;

      const title = card.getAttribute('data-title');
      if (title) {
        el.setAttribute('data-title', title);
      }

      const img = card.querySelector('img');
      if (img) {
        const clonedImg = img.cloneNode(true);
        clonedImg.draggable = false;
        el.appendChild(clonedImg);
      }

      const titleText = (card.querySelector('h3')?.textContent || '').trim();
      const yearText = (card.querySelector('p.year')?.textContent || '').trim();

      if (titleText || yearText) {
        const label = document.createElement('div');
        label.className = 'label';

        const lt = document.createElement('div');
        lt.className = 'label-title';
        lt.textContent = titleText || '';

        const ly = document.createElement('div');
        ly.className = 'label-year';
        ly.textContent = yearText || '';

        label.appendChild(lt);
        if (yearText) label.appendChild(ly);
        el.appendChild(label);
      }

      originals.push(el);
    });

    const originalContainer = document.querySelector('.timeline-container');
    if (originalContainer) originalContainer.remove();
  } else {
    for (let i = 1; i <= TOTAL; i++) {
      const el = document.createElement('div');
      el.className = 'slot';
      el.dataset.index = i;
      el.innerHTML = `<div style="font-size:2rem;padding:20px;color:#fff">Timeline ${i}</div>`;
      originals.push(el);
    }
  }

  const leftClones = originals.map(n => n.cloneNode(true));
  leftClones.forEach(n => track.appendChild(n));
  originals.forEach(n => track.appendChild(n));
  const rightClones = originals.map(n => n.cloneNode(true));
  rightClones.forEach(n => track.appendChild(n));

  let slots = Array.from(track.children);
  let slotWidth = 0, gapPx = 0, stepPx = 0;

  function layoutSlots() {
    const g = getComputedStyle(track).gap;
    gapPx = parseFloat(g) || 0;
    const available = Math.max(200, viewport.clientWidth);
    slotWidth = Math.floor((available - (VISIBLE - 1) * gapPx) / VISIBLE);
    slots.forEach(s => {
      s.style.flex = `0 0 ${slotWidth}px`;
      s.style.width = `${slotWidth}px`;
      s.style.height = `${Math.round(slotWidth * 1.35)}px`;
    });
    const measured = slots[0] ? Math.round(slots[0].getBoundingClientRect().width) : slotWidth;
    stepPx = measured + gapPx;
  }

  function centerSlotInstant(el) {
    const wrapperCenter = viewport.clientWidth / 2;
    const elCenterRelativeToTrack = el.offsetLeft + el.offsetWidth / 2;
    const target = elCenterRelativeToTrack - wrapperCenter;
    viewport.scrollLeft = Math.round(target);
  }

  function findRealSlotForIndex(n) {
    const leftCount = originals.length;
    const middleStart = leftCount;
    for (let i = middleStart; i < middleStart + originals.length; i++) {
      const el = track.children[i];
      if (el && el.dataset && Number(el.dataset.index) === n) return el;
    }
    return null;
  }

  function updateVisuals() {
    const vpRect = viewport.getBoundingClientRect();
    const centerX = vpRect.left + vpRect.width / 2;
    const denom = (stepPx && stepPx > 0) ? stepPx : 1;

    slots.forEach(slot => {
      const r = slot.getBoundingClientRect();
      const cardCenter = r.left + r.width / 2;
      const dist = Math.abs(centerX - cardCenter);
      const dSlots = dist / denom;

      const t = Math.min(dSlots / 2, 1);
      const scale = 2.0 + (0.65 - 2.0) * t;
      const opacity = 1 + (0.35 - 1) * t;
      const side = (cardCenter < centerX) ? 1 : -1;
      const rotate = side * 16 * Math.min(dSlots / 1.5, 1);
      const translateY = -18 * Math.max(0, 1 - (dSlots / 2));

      slot.style.transform = `perspective(1200px) translateY(${translateY}px) rotateY(${rotate}deg) scale(${scale})`;
      slot.style.opacity = opacity;
      slot.classList.toggle('active', dSlots < 0.45);
    });
  }

  function handleLoopResetIfNeeded() {
    const idx = Math.round(viewport.scrollLeft / stepPx);
    const leftCount = originals.length;
    const firstReal = leftCount;
    const lastReal = leftCount + originals.length - 1;
    if (idx < firstReal) {
      viewport.scrollLeft += originals.length * stepPx;
    } else if (idx > lastReal) {
      viewport.scrollLeft -= originals.length * stepPx;
    }
  }

  function snapToNearest() {
    const idx = Math.round(viewport.scrollLeft / stepPx);
    const target = idx * stepPx;
    viewport.scrollTo({ left: target, behavior: 'smooth' });
    setTimeout(() => {
      handleLoopResetIfNeeded();
      updateVisuals();
    }, 400);
  }

  function initLayoutAndCenter() {
    layoutSlots();
    slots = Array.from(track.children);

    const savedScrollLeft = sessionStorage.getItem('timelineScrollPosition');

    // Use a small delay to ensure the layout is fully rendered before scrolling.
    setTimeout(() => {
      if (savedScrollLeft !== null) {
        // If a saved position exists, restore it.
        viewport.scrollLeft = parseFloat(savedScrollLeft);
        // Clear the storage so it doesn't happen on new visits.
        sessionStorage.removeItem('timelineScrollPosition');
      } else {
        // Otherwise, center on the first card.
        const real1 = findRealSlotForIndex(1);
        if (real1) {
          centerSlotInstant(real1);
        } else {
          viewport.scrollLeft = Math.round(track.scrollWidth / 3);
        }
      }
      updateVisuals();
    }, 50); // 50ms is enough to let the browser compute the layout.
  }

  // Pointer dragging and click logic combined for reliability
  let isPointerDown = false;
  let wasDragged = false;
  let startX = 0;
  let scrollStart = 0;

  viewport.addEventListener('pointerdown', (e) => {
    isPointerDown = true;
    wasDragged = false;
    startX = e.clientX;
    scrollStart = viewport.scrollLeft;
    viewport.setPointerCapture && viewport.setPointerCapture(e.pointerId);
    viewport.style.scrollBehavior = 'auto';
  });

  viewport.addEventListener('pointermove', (e) => {
    if (!isPointerDown) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 5) { // Threshold to determine a drag
      wasDragged = true;
    }
    viewport.scrollLeft = scrollStart - dx;
    if (!rafPending) requestAnimationFrame(updateVisualsWrapped);
  });

  const handlePointerUp = (e) => {
    if (!isPointerDown) return;
    isPointerDown = false;
    viewport.releasePointerCapture && viewport.releasePointerCapture(e?.pointerId);
    
    if (wasDragged) {
      viewport.style.scrollBehavior = 'smooth';
      clearTimeout(snapTimer);
      snapTimer = setTimeout(() => snapToNearest(), 120);
    } else {
      const topEl = document.elementFromPoint(e.clientX, e.clientY);
      const slot = topEl ? topEl.closest('.slot') : null;
      if (!slot) return;

      const slotRect = slot.getBoundingClientRect();
      const vpRect = viewport.getBoundingClientRect();
      const slotCenterX = slotRect.left + slotRect.width / 2;
      const vpCenterX = vpRect.left + vpRect.width / 2;
      const deltaAbs = Math.abs(slotCenterX - vpCenterX);

      const threshold = slotRect.width * 0.45;

      if (deltaAbs <= threshold) {
        const title = slot.getAttribute('data-title');
        if (title) {
          // Save the current scroll position before navigating
          sessionStorage.setItem('timelineScrollPosition', viewport.scrollLeft);
          const filename = title.toLowerCase().replace(/ /g, '-').replace(/’/g, '').replace(/–/g, '-').replace(/[^\w-]/g, '') + '.html';
          const url = `contents/${filename}`;
          window.location.href = url;
        }
      } else {
        const delta = slotCenterX - vpCenterX;
        const target = Math.round(viewport.scrollLeft + delta);
        viewport.scrollTo({ left: target, behavior: 'smooth' });
        clearTimeout(snapTimer);
        snapTimer = setTimeout(() => {
          snapToNearest();
          updateVisuals();
        }, 420);
      }
    }
  };
  viewport.addEventListener('pointerup', handlePointerUp);
  viewport.addEventListener('pointercancel', handlePointerUp);
  viewport.addEventListener('pointerleave', handlePointerUp);

  let snapTimer = null;
  viewport.addEventListener('scroll', () => {
    if (!rafPending) requestAnimationFrame(updateVisualsWrapped);
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => snapToNearest(), 200);
  }, { passive: true });

  let rafPending = false;
  function updateVisualsWrapped() {
    rafPending = false;
    updateVisuals();
  }

  window.addEventListener('resize', () => {
    layoutSlots();
    setTimeout(() => {
      snapToNearest();
      updateVisuals();
    }, 40);
  });

  // NEW: This saves the scroll position whenever the user leaves the page
  window.addEventListener('beforeunload', () => {
    if (viewport) {
      sessionStorage.setItem('timelineScrollPosition', viewport.scrollLeft);
    }
  });

  requestAnimationFrame(() => {
    initLayoutAndCenter();
    slots = Array.from(track.children);
  });

  // wheel scroll support
  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const speedFactor = 5;
    viewport.scrollLeft -= e.deltaY * speedFactor;
    if (!rafPending) requestAnimationFrame(updateVisualsWrapped);
  }, { passive: false });
})();