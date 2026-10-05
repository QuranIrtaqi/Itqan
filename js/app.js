/**
 * Application Main Controller
 * UI Renderers, View Switchers, Event Listeners, Modals, PWA Lifecycle
 */

// ==========================================
// PWA & SERVICE WORKER SETUP
// ==========================================
let deferredPrompt = null;

(function setupPWA() {
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn("SW registration note:", err);
    });
  }
})();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const installBtn = document.getElementById('btnInstallApp');
  if (installBtn) installBtn.classList.add('animate-pulse');
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  showToast("تم تثبيت التطبيق بنجاح على شاشتك الرئيسية!");
});

// ==========================================
// UI RENDERERS: SURAHS, PAGES, JUZ
// ==========================================
function renderSurahs() {
  const container = document.getElementById('surahGridContainer');
  if (!container) return;
  const query = normAr(state.searchQuery);
  const filter = state.currentFilter;

  let list = SURAHS.filter(s => {
    const matchesQuery = !query || normAr(s.name).includes(query) ||
      s.id.toString() === query ||
      normAr(`جزء ${s.juz}`).includes(query) ||
      normAr(`صفحة ${s.startPage}`).includes(query);
    const isDone = !!state.memorizedSurahs[s.id];
    let matchesFilter = true;
    if (filter === 'memorized') matchesFilter = isDone;
    if (filter === 'unmemorized') matchesFilter = !isDone;
    return matchesQuery && matchesFilter;
  });

  const elCount = document.getElementById('filteredSurahCount');
  if (elCount) elCount.textContent = formatStdNum(list.length);

  if (list.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-10 text-center text-slate-400 font-sans">
        <i data-lucide="book-x" class="w-10 h-10 mx-auto mb-2 opacity-40"></i>
        <p class="text-xs sm:text-sm font-semibold">لم نجد نتائج تطابق بحثك أو عامل التصفية المحدد</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = list.map(s => {
    const isDone = !!state.memorizedSurahs[s.id];
    const totalPages = (s.endPage - s.startPage + 1);

    let pct = 0;
    let progressLabel = '';

    if (totalPages === 1) {
      if (isDone) {
        pct = 100;
        progressLabel = `100% (${formatStdNum(1)}/${formatStdNum(1)} ص)`;
      } else {
        pct = 0;
        progressLabel = `0% (${formatStdNum(0)}/${formatStdNum(1)} ص)`;
      }
    } else {
      if (isDone) {
        pct = 100;
        progressLabel = `100% (${formatStdNum(totalPages)}/${formatStdNum(totalPages)} ص)`;
      } else {
        let pagesCount = 0;
        for (let p = s.startPage; p <= s.endPage; p++) {
          if (state.memorizedPages[p]) pagesCount++;
        }
        pct = Math.round((pagesCount / totalPages) * 100);
        progressLabel = `${pct}% (${formatStdNum(pagesCount)}/${formatStdNum(totalPages)} ص)`;
      }
    }

    return `
      <div onclick="toggleSurah(${s.id})" class="cursor-pointer group relative p-3.5 rounded-2xl border transition-all duration-200 select-none active:scale-[0.99] touch-manipulation ${isDone
        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-400/80 dark:border-emerald-700 shadow-sm shadow-emerald-700/10'
        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800 shadow-sm'
      }">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs font-sans ${isDone
        ? 'bg-emerald-700 text-white shadow-md shadow-emerald-700/30'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-950 group-hover:text-emerald-800 transition'
      }">
              ${formatStdNum(s.id)}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h4 class="font-bold text-slate-900 dark:text-white text-base group-hover:text-emerald-700 dark:group-hover:text-emerald-300 font-quran transition">
                  سُورَةُ ${s.name}
                </h4>
                <span class="text-[10px] px-2 py-0.5 rounded-full ${s.type === 'مكية' ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'} font-semibold font-sans">
                  ${s.type}
                </span>
              </div>
              <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-sans">
                ${formatStdNum(s.ayahs)} آية • ص ${formatStdNum(s.startPage)} إلى ${formatStdNum(s.endPage)} • الجزء ${formatStdNum(s.juz)}
              </p>
            </div>
          </div>

          <div class="w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isDone
        ? 'bg-emerald-700 text-white shadow-sm shadow-emerald-900/20'
        : 'border border-slate-300 dark:border-slate-700 text-transparent'
      }">
            <i data-lucide="check" class="w-3.5 h-3.5 stroke-[3]"></i>
          </div>
        </div>

        <div class="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between font-sans">
          <div class="flex items-center gap-2 flex-1 ml-2">
            <div class="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full bg-emerald-600 rounded-full transition-all duration-300" style="width: ${pct}%"></div>
            </div>
            <span class="text-[10px] text-slate-500 font-medium whitespace-nowrap">${progressLabel}</span>
          </div>
        </div>
        ${isDone ? '' : `
        <div onclick="event.stopPropagation()" class="mt-2 flex items-center gap-2 text-[11px] text-slate-500 font-sans">
          <span>آيات محفوظة بدقة:</span>
          <input type="number" min="0" max="${s.ayahs}" inputmode="numeric" value="${state.ayahs[s.id] || ''}" placeholder="0" onchange="setAyahs(${s.id}, this.value)" class="w-14 px-1.5 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-bold text-slate-800 dark:text-white">
          <span>/ ${formatStdNum(s.ayahs)}</span>
        </div>
        `}
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

function renderPages() {
  const container = document.getElementById('pageGridContainer');
  if (!container) return;
  const query = normAr(state.searchQuery);
  const filter = state.currentFilter;

  let html = '';
  for (let p = 1; p <= 604; p++) {
    const isDone = !!state.memorizedPages[p];
    const surahNames = getSurahsForPage(p);
    const juz = getJuzForPage(p);

    let matches = true;
    if (query) {
      const matchNum = p.toString() === query;
      const matchSurah = normAr(surahNames).includes(query);
      const matchJuz = normAr(`جزء ${juz}`).includes(query) || juz.toString() === query;
      matches = matchNum || matchSurah || matchJuz;
    }
    if (filter === 'memorized' && !isDone) matches = false;
    if (filter === 'unmemorized' && isDone) matches = false;

    const opacityClass = matches ? 'opacity-100' : 'opacity-20 pointer-events-none';

    html += `
      <div 
        id="page-cell-${p}"
        onclick="togglePage(${p})" 
        title="صفحة ${formatStdNum(p)} | جزء ${formatStdNum(juz)} | سورة ${surahNames}"
        class="page-box cursor-pointer relative group h-11 sm:h-12 rounded-xl text-xs font-bold flex flex-col items-center justify-center transition-all shadow-sm active:scale-95 touch-manipulation select-none ${opacityClass} ${isDone
        ? 'bg-emerald-700 text-white shadow-emerald-800/30'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-100 hover:text-emerald-900 dark:hover:bg-emerald-950 dark:hover:text-emerald-200 border border-slate-200/90 dark:border-slate-700'
      }">
        <button type="button" onclick="event.stopPropagation(); openPagePreview(${p})" title="معاينة الصفحة في المصحف" class="absolute -top-0.5 -left-0.5 w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:text-emerald-700 dark:hover:text-gold-300 opacity-75 sm:opacity-0 group-hover:opacity-100 transition active:scale-90">
          <i data-lucide="eye" class="w-3.5 h-3.5"></i>
        </button>
        <span>${formatStdNum(p)}</span>
        <span class="text-[8px] font-normal opacity-70">ج${formatStdNum(juz)}</span>
      </div>
    `;
  }
  container.innerHTML = html;
  lucide.createIcons();
}

function renderJuz() {
  const container = document.getElementById('juzCardsContainer');
  if (!container) return;

  container.innerHTML = AJZA.map(j => {
    const totalPages = (j.end - j.start + 1);
    let donePages = 0;
    for (let p = j.start; p <= j.end; p++) {
      if (state.memorizedPages[p]) donePages++;
    }
    const pct = Math.round((donePages / totalPages) * 100);
    const isComplete = donePages === totalPages;

    return `
      <div class="bg-white dark:bg-slate-900 border ${isComplete ? 'border-emerald-500 dark:border-emerald-600 bg-emerald-50/20' : 'border-slate-200 dark:border-slate-800'
      } rounded-2xl p-4 shadow-sm space-y-3 font-sans">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span class="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${isComplete ? 'bg-emerald-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
      }">
              ${formatStdNum(j.juz)}
            </span>
            <div>
              <h4 class="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">الجزء ${formatStdNum(j.juz)}</h4>
              <p class="text-[11px] text-slate-500 font-quran">${j.name}</p>
            </div>
          </div>
          <div class="text-left font-sans">
            <span class="text-sm font-black ${isComplete ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}">${pct}%</span>
            <span class="text-[10px] text-slate-400 block">${formatStdNum(donePages)}/${formatStdNum(totalPages)} صفحة</span>
          </div>
        </div>

        <div class="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-l from-emerald-600 to-teal-400 rounded-full transition-all duration-300" style="width: ${pct}%"></div>
        </div>

        <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <span class="text-slate-400 text-[10px] font-sans">الصفحات: ${formatStdNum(j.start)} - ${formatStdNum(j.end)}</span>
          <div class="flex items-center gap-1.5">
            <button onclick="markWholeJuz(${j.juz}, true)" class="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 font-bold transition text-xs">
              حفظ الكل
            </button>
            <button onclick="markWholeJuz(${j.juz}, false)" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-rose-600 font-bold transition text-xs">
              إلغاء
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

function renderJuzJumpers() {
  const container = document.getElementById('juzJumpersContainer');
  if (!container) return;
  container.innerHTML = AJZA.map(j => `
    <button onclick="jumpToPage(${j.start})" class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-700 hover:text-white text-slate-700 dark:text-slate-300 transition text-xs whitespace-nowrap font-bold font-sans">
      ج${formatStdNum(j.juz)}
    </button>
  `).join('');
}

function jumpToPage(page) {
  const el = document.getElementById(`page-cell-${page}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-4', 'ring-gold-400');
    setTimeout(() => el.classList.remove('ring-4', 'ring-gold-400'), 1500);
  }
}

function markWholeJuz(juzNumber, isMemorized) {
  const jObj = AJZA.find(j => j.juz === juzNumber);
  if (!jObj) return;

  for (let p = jObj.start; p <= jObj.end; p++) {
    if (isMemorized) state.memorizedPages[p] = true;
    else delete state.memorizedPages[p];
  }

  if (state.autoSync) {
    SURAHS.forEach(s => {
      if (s.startPage <= jObj.end && s.endPage >= jObj.start) {
        let allDone = true;
        for (let p = s.startPage; p <= s.endPage; p++) {
          if (!state.memorizedPages[p]) { allDone = false; break; }
        }
        if (allDone) {
          if (!state.memorizedSurahs[s.id]) state.reviews[s.id] = todayStr();
          state.memorizedSurahs[s.id] = true;
        } else {
          delete state.memorizedSurahs[s.id];
        }
      }
    });
  }

  saveState();
  renderAll();
  if (isMemorized) launchConfetti();
  showToast(`تم ${isMemorized ? 'تحديد' : 'إلغاء'} الجزء ${formatStdNum(juzNumber)} بنجاح!`);
}

function applyPageRange(isMemorized) {
  const startInput = document.getElementById('rangeStartPage');
  const endInput = document.getElementById('rangeEndPage');
  if (!startInput || !endInput) return;
  const start = parseInt(startInput.value);
  const end = parseInt(endInput.value);

  if (isNaN(start) || isNaN(end) || start < 1 || end > 604 || start > end) {
    showToast("يرجى إدخال نطاق صفحات صحيح بين 1 و 604");
    return;
  }

  let changedCount = 0;
  for (let p = start; p <= end; p++) {
    if (isMemorized) {
      if (!state.memorizedPages[p]) changedCount++;
      state.memorizedPages[p] = true;
    } else {
      if (state.memorizedPages[p]) changedCount++;
      delete state.memorizedPages[p];
    }
  }

  if (state.autoSync) {
    SURAHS.forEach(s => {
      if (s.startPage <= end && s.endPage >= start) {
        let allPagesDone = true;
        for (let p = s.startPage; p <= s.endPage; p++) {
          if (!state.memorizedPages[p]) {
            allPagesDone = false;
            break;
          }
        }
        if (allPagesDone) {
          if (!state.memorizedSurahs[s.id]) state.reviews[s.id] = todayStr();
          state.memorizedSurahs[s.id] = true;
        } else {
          delete state.memorizedSurahs[s.id];
        }
      }
    });
  }

  saveState();
  renderAll();
  if (isMemorized && changedCount > 0) launchConfetti();
  showToast(`تم ${isMemorized ? 'تحديد' : 'إلغاء'} الصفحات (من ${formatStdNum(start)} إلى ${formatStdNum(end)}) بنجاح!`);
}

// ==========================================
// PAGE PREVIEW MODAL & SWIPE GESTURES
// ==========================================
let currentPreviewPage = 1;

function openPagePreview(pageNum) {
  currentPreviewPage = Math.min(604, Math.max(1, parseInt(pageNum) || 1));
  const modal = document.getElementById('pagePreviewModal');
  if (!modal) return;
  updatePagePreviewUI();
  modal.classList.remove('hidden');
}

function closePagePreview() {
  const modal = document.getElementById('pagePreviewModal');
  if (modal) modal.classList.add('hidden');
}

function navigatePreviewPage(delta) {
  const newPage = currentPreviewPage + delta;
  if (newPage >= 1 && newPage <= 604) {
    currentPreviewPage = newPage;
    updatePagePreviewUI();
  }
}

function togglePreviewPageStatus() {
  togglePage(currentPreviewPage);
  updatePagePreviewStatusButton();
}

function updatePagePreviewStatusButton() {
  const btn = document.getElementById('btnPreviewToggleStatus');
  const text = document.getElementById('previewStatusText');
  if (!btn || !text) return;
  const isDone = !!state.memorizedPages[currentPreviewPage];
  if (isDone) {
    btn.className = "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm bg-emerald-700 text-white hover:bg-emerald-800 active:scale-95";
    text.textContent = "تم الحفظ (انقر للإلغاء)";
  } else {
    btn.className = "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-100 hover:text-emerald-800 dark:hover:bg-emerald-950 active:scale-95 border border-slate-300 dark:border-slate-700";
    text.textContent = "تحديد كمحفوظ";
  }
}

function updatePagePreviewUI() {
  const p = currentPreviewPage;
  const surahs = getSurahsForPage(p);
  const juz = getJuzForPage(p);

  const elTitle = document.getElementById('previewPageTitle');
  if (elTitle) elTitle.textContent = `صفحة ${formatStdNum(p)}`;
  const elSubtitle = document.getElementById('previewPageSubtitle');
  if (elSubtitle) elSubtitle.textContent = `سورة ${surahs} • الجزء ${formatStdNum(juz)}`;
  const elCurNum = document.getElementById('previewCurPageNum');
  if (elCurNum) elCurNum.textContent = formatStdNum(p);

  const prevNumEl = document.getElementById('previewPrevPageNum');
  const nextNumEl = document.getElementById('previewNextPageNum');
  const btnPrev = document.getElementById('btnPrevPageNav');
  const btnNext = document.getElementById('btnNextPageNav');

  if (btnPrev && prevNumEl) {
    if (p > 1) {
      prevNumEl.textContent = formatStdNum(p - 1);
      btnPrev.disabled = false;
      btnPrev.classList.remove('opacity-40', 'cursor-not-allowed');
    } else {
      btnPrev.disabled = true;
      btnPrev.classList.add('opacity-40', 'cursor-not-allowed');
    }
  }

  if (btnNext && nextNumEl) {
    if (p < 604) {
      nextNumEl.textContent = formatStdNum(p + 1);
      btnNext.disabled = false;
      btnNext.classList.remove('opacity-40', 'cursor-not-allowed');
    } else {
      btnNext.disabled = true;
      btnNext.classList.add('opacity-40', 'cursor-not-allowed');
    }
  }

  updatePagePreviewStatusButton();

  const spinner = document.getElementById('previewLoadingSpinner');
  const img = document.getElementById('previewPageImage');
  const fallback = document.getElementById('previewOfflineFallback');

  if (spinner) spinner.classList.remove('hidden');
  if (fallback) fallback.classList.add('hidden');
  if (img) {
    img.classList.remove('hidden');
    const paddedPage = String(p).padStart(3, '0');
    img.dataset.page = paddedPage;
    img.dataset.tryBackup = "false";
    img.src = `https://cdn.jsdelivr.net/gh/GovarJabbar/Quran-PNG@master/${paddedPage}.png`;
  }
}

function handlePreviewImageError(img) {
  if (img.dataset.tryBackup === "false" && img.dataset.page) {
    img.dataset.tryBackup = "true";
    img.src = `https://raw.githubusercontent.com/GovarJabbar/Quran-PNG/master/${img.dataset.page}.png`;
    return;
  }
  const spinner = document.getElementById('previewLoadingSpinner');
  if (spinner) spinner.classList.add('hidden');
  img.classList.add('hidden');
  const fallback = document.getElementById('previewOfflineFallback');
  if (fallback) fallback.classList.remove('hidden');
}

function changePlannerWeek(dir) {
  if (dir === 0) {
    state.weekOffset = 0;
  } else {
    state.weekOffset = Math.min(0, (state.weekOffset || 0) + dir);
  }
  renderPlanner();
}

function attachWeeklySwipe() {
  const card = document.getElementById('weeklyProgressCard');
  if (!card) return;

  let startX = 0;
  let startY = 0;

  card.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }
  }, { passive: true });

  card.addEventListener('touchend', (e) => {
    if (e.changedTouches.length === 1) {
      const diffX = e.changedTouches[0].clientX - startX;
      const diffY = e.changedTouches[0].clientY - startY;
      if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY) * 1.3) {
        if (diffX > 0) {
          changePlannerWeek(-1);
        } else {
          changePlannerWeek(1);
        }
      }
    }
  }, { passive: true });

  let lastWheel = 0;
  card.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) > 20 && Date.now() - lastWheel > 350) {
      lastWheel = Date.now();
      if (e.deltaX > 0) {
        changePlannerWeek(-1);
      } else {
        changePlannerWeek(1);
      }
    }
  }, { passive: true });
}

function attachPreviewSwipe() {
  const modal = document.getElementById('pagePreviewModal');
  if (!modal) return;

  let startX = 0;
  let startY = 0;

  modal.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }
  }, { passive: true });

  modal.addEventListener('touchend', (e) => {
    if (e.changedTouches.length === 1) {
      const diffX = e.changedTouches[0].clientX - startX;
      const diffY = e.changedTouches[0].clientY - startY;
      if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY) * 1.3) {
        // RTL Quran: swipe left -> next page (1), swipe right -> previous page (-1)
        if (diffX < 0) {
          navigatePreviewPage(1);
        } else {
          navigatePreviewPage(-1);
        }
      }
    }
  }, { passive: true });
}

// ==========================================
// SMART PLANNER & SPACED REPETITION (SRS)
// ==========================================
function renderPlanner() {
  const el = document.getElementById('plannerCard');
  if (!el) return;
  const t = todayStr();
  const count = Object.keys(state.memorizedPages).length;
  const left = 604 - count;
  const today = state.log[t] || 0;

  const due = SURAHS.filter(s => {
    if (!state.memorizedSurahs[s.id]) return false;
    const last = state.reviews[s.id];
    const interval = (state.surahIntervals && state.surahIntervals[s.id]) || REVIEW_DAYS;
    if (!last) return true;
    return daysBetween(last, t) >= interval;
  }).sort((a, b) => {
    const da = state.reviews[a.id] ? daysBetween(state.reviews[a.id], t) : 9999;
    const db = state.reviews[b.id] ? daysBetween(state.reviews[b.id], t) : 9999;
    return db - da;
  });

  const duePreview = due.slice(0, 5);
  const rows = duePreview.map(s => {
    const last = state.reviews[s.id];
    const daysAgo = last ? daysBetween(last, t) : null;
    const currentInterval = (state.surahIntervals && state.surahIntervals[s.id]) || REVIEW_DAYS;
    return `
      <div class="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0 font-sans">
        <div class="flex items-center gap-2">
          <span class="font-bold text-slate-800 dark:text-slate-200">سورة ${s.name}</span>
          <span class="text-[10px] text-slate-400">(${formatStdNum(s.ayahs)} آية)</span>
          <span class="text-[10px] text-amber-600 dark:text-amber-400">${daysAgo === null ? 'لم تُراجع بعد' : 'قبل ' + formatStdNum(daysAgo) + ' يوم'}</span>
        </div>
        <div class="flex items-center gap-1">
          <button onclick="rateSurahReview(${s.id}, 28, 'ممتاز')" title="ممتاز - مراجعة بعد 28 يوماً" class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900 border border-emerald-300/80 dark:border-emerald-800 active:scale-95 transition">🟢 ممتاز</button>
          <button onclick="rateSurahReview(${s.id}, 14, 'متوسط')" title="متوسط - مراجعة بعد 14 يوماً" class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900 border border-amber-300/80 dark:border-amber-800 active:scale-95 transition">🟡 متوسط</button>
          <button onclick="rateSurahReview(${s.id}, 4, 'ضعيف')" title="ضعيف - مراجعة قريبة بعد 4 أيام" class="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 dark:hover:bg-rose-900 border border-rose-300/80 dark:border-rose-800 active:scale-95 transition">🔴 تثبيت</button>
        </div>
      </div>
    `;
  }).join('');

  let goalLine = '';
  if (state.goal > 0) {
    const studyDays = state.studyDays || 7;
    const weeklyRate = state.goal * (studyDays / 7);
    const daysNeeded = weeklyRate > 0 ? Math.ceil(left / (state.goal / 7)) : Infinity;
    const fin = isFinite(daysNeeded) ? addDays(t, daysNeeded).toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }) : 'غير محدد';
    goalLine = `الهدف: <b class="text-slate-800 dark:text-white">${formatStdNum(state.goal)}</b> صفحة/أسبوع (${formatStdNum(studyDays)} أيام حفظ) • الختم المتوقع: <b class="text-emerald-700 dark:text-emerald-400">${fin}</b>`;
  } else {
    goalLine = 'حدد هدفك الأسبوعي لحساب موعد الختم المتوقع.';
  }

  const offset = state.weekOffset || 0;
  const now = new Date();
  const dayOfWeek = (now.getDay() + 1) % 7;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek + (offset * 7));

  const weekDays = [];
  const dayNames = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
  let weekMemorizedTotal = 0;
  let weekReviewedTotal = 0;

  for (let i = 0; i < 7; i++) {
    const curDate = new Date(weekStart);
    curDate.setDate(weekStart.getDate() + i);
    const key = dayKey(curDate);
    const isToday = (key === t);
    const dayOfWeekIdx = curDate.getDay();
    const isDesignatedReviewDay = (state.reviewDays || []).includes(dayOfWeekIdx);
    const pagesLogged = state.log[key] || 0;
    const isReviewDone = !!state.reviewLog[key];

    weekMemorizedTotal += pagesLogged;
    if (isReviewDone) weekReviewedTotal++;

    weekDays.push({
      key,
      name: dayNames[i],
      dateNum: curDate.getDate(),
      isToday,
      isDesignatedReviewDay,
      pagesLogged,
      isReviewDone
    });
  }

  const isCurrentWeek = (offset === 0);
  const weekRangeLabel = `من ${formatStdNum(weekDays[0].dateNum)} إلى ${formatStdNum(weekDays[6].dateNum)} ${weekStart.toLocaleDateString('ar-EG-u-nu-latn', { month: 'short' })}`;

  const chartHtml = `
    <div id="weeklyProgressCard" class="bg-slate-50 dark:bg-slate-800/50 p-2.5 sm:p-3 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2 select-none touch-pan-y">
      <div class="flex items-center justify-between text-xs">
        <div class="flex items-center gap-1.5">
          <span class="font-bold text-slate-800 dark:text-slate-200">سجل إنجاز الأسبوع</span>
          <span class="text-[10px] text-slate-400">(${weekRangeLabel})</span>
        </div>
        <div class="flex items-center gap-1">
          <button onclick="changePlannerWeek(-1)" title="الأسبوع السابق" class="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition">
            <i data-lucide="chevron-right" class="w-4 h-4"></i>
          </button>
          <button onclick="changePlannerWeek(0)" title="الأسبوع الحالي" class="px-1.5 py-0.5 rounded text-[10px] font-bold ${isCurrentWeek ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500'} transition">
            الحالي
          </button>
          <button onclick="changePlannerWeek(1)" ${isCurrentWeek ? 'disabled' : ''} title="الأسبوع التالي" class="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition ${isCurrentWeek ? 'opacity-30 cursor-not-allowed' : ''}">
            <i data-lucide="chevron-left" class="w-4 h-4"></i>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-7 gap-1 sm:gap-1.5 text-center text-xs">
        ${weekDays.map(d => `
          <div class="p-1.5 rounded-xl border flex flex-col items-center justify-between gap-1 transition ${
            d.isToday
              ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-400 dark:border-emerald-700 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
          }">
            <span class="text-[10px] text-slate-400 font-medium block">${d.name}</span>
            <span class="text-xs font-bold ${d.isToday ? 'text-emerald-700 dark:text-emerald-400 font-black' : 'text-slate-700 dark:text-slate-300'}">${formatStdNum(d.dateNum)}</span>
            <div class="w-full flex items-center justify-center py-0.5">
              ${d.pagesLogged > 0
                ? `<span class="inline-block px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-bold leading-tight shadow-xs">+${formatStdNum(d.pagesLogged)}</span>`
                : `<span class="text-[11px] text-slate-300 dark:text-slate-600">-</span>`
              }
            </div>
            <button onclick="toggleReviewDay('${d.key}')" title="${d.isReviewDone ? 'تمت المراجعة (انقر للإلغاء)' : 'انقر لتسجيل مراجعة هذا اليوم'}" class="w-5 h-5 rounded-md flex items-center justify-center transition ${
              d.isReviewDone
                ? 'bg-gold-500 text-white shadow-xs'
                : (d.isDesignatedReviewDay ? 'border border-dashed border-gold-400 text-gold-500 dark:text-gold-400 hover:bg-gold-50 dark:hover:bg-gold-950/30' : 'text-slate-300 dark:text-slate-600 hover:text-gold-500')
            }">
              <i data-lucide="check" class="w-3 h-3 stroke-[2.5]"></i>
            </button>
          </div>
        `).join('')}
      </div>

      <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800">
        <span>إجمالي حفظ الأسبوع: <b class="text-emerald-700 dark:text-emerald-400 font-bold">${formatStdNum(weekMemorizedTotal)}</b> صفحة</span>
        <span>أيام مراجعة مكتملة: <b class="text-gold-600 dark:text-gold-400 font-bold">${formatStdNum(weekReviewedTotal)}</b> من 7</span>
      </div>
    </div>
  `;

  const streak = getStreak();
  const motivator = getStreakMotivator(streak);
  const badgeTitle = motivator.current.title;
  const badgeIcon = motivator.current.icon;

  const streakHtml = `
    <div class="bg-gradient-to-br from-amber-500/10 via-emerald-500/5 to-teal-500/10 p-3 sm:p-3.5 rounded-2xl border-2 border-amber-500/30 dark:border-amber-400/20 space-y-2">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-2xl">${badgeIcon}</span>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-xs sm:text-sm font-black text-amber-900 dark:text-amber-200">${badgeTitle}</span>
              <span class="text-[10px] px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold">وسام نبوي</span>
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">سلسلة ثبات يومي: <b class="text-amber-600 dark:text-amber-400 font-bold text-xs sm:text-sm">${formatStdNum(streak)}</b> يوم متتالي 🔥</p>
          </div>
        </div>
        <div class="text-left font-sans">
          <span class="text-[10px] text-slate-400 block">${motivator.nextTier ? `باقي ${formatStdNum(motivator.daysRemaining)} أيام لـ` : 'الدرجة العليا'}</span>
          <span class="text-xs font-bold text-amber-700 dark:text-amber-300">${motivator.nextTier ? motivator.nextTier.title : '👑 متوج بالوقار'}</span>
        </div>
      </div>

      ${motivator.nextTier ? `
        <div class="w-full h-1.5 bg-amber-950/10 dark:bg-amber-950/40 rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-l from-amber-500 via-emerald-500 to-teal-500 rounded-full transition-all duration-300" style="width: ${motivator.progressToNext}%"></div>
        </div>
      ` : ''}

      <div class="pt-1.5 border-t border-amber-500/20 dark:border-amber-400/10 space-y-1">
        <p class="text-xs font-bold text-emerald-900 dark:text-emerald-300 font-quran leading-relaxed">${motivator.current.quote}</p>
        <p class="text-[11px] text-amber-800/90 dark:text-amber-300/80 leading-normal">${motivator.current.encouragement}</p>
      </div>
    </div>
  `;

  const reviewDayNames = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  const dayButtonsHtml = [0, 1, 2, 3, 4, 5, 6].map(d => {
    const active = (state.reviewDays || []).includes(d);
    return `<button type="button" onclick="toggleReviewDayOption(${d})" class="px-2 py-1 rounded-lg text-xs font-bold transition border ${active ? 'bg-emerald-700 text-white border-emerald-600 shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200'}">${reviewDayNames[d]}</button>`;
  }).join('');

  el.innerHTML = `
    <div class="space-y-3 font-sans">
      ${streakHtml}
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div class="flex items-center gap-2">
          <span class="text-slate-500">الهدف الأسبوعي:</span>
          <input type="number" min="0" max="604" value="${state.goal || ''}" placeholder="0" onchange="setGoal(this.value)" class="w-16 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-bold text-slate-800 dark:text-white">
          <span class="text-slate-400">صفحة</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-slate-500">أيام الحفظ:</span>
          <input type="number" min="1" max="7" value="${state.studyDays || 7}" onchange="setStudyDays(this.value)" class="w-12 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-bold text-slate-800 dark:text-white">
          <span class="text-slate-400">أيام</span>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-1.5 text-xs pt-1">
        <span class="text-slate-500 ml-1">أيام المراجعة المخصصة:</span>
        ${dayButtonsHtml}
      </div>
      <div class="text-[11px] text-slate-500">اليوم: <b class="text-slate-800 dark:text-white">${formatStdNum(today)}</b> صفحة</div>
      ${chartHtml}
      <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">${goalLine}</p>
      <div class="pt-2 border-t border-slate-100 dark:border-slate-800/80">
        <div class="flex items-center justify-between gap-2 mb-1">
          <h3 class="text-xs font-bold text-slate-900 dark:text-white">تحتاج مراجعة ${due.length ? '(' + formatStdNum(due.length) + ')' : ''}</h3>
          ${due.length ? '<button onclick="markAllReviewed()" class="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-700 text-white text-[11px] font-bold active:scale-95">تمت مراجعة الكل</button>' : ''}
        </div>
        ${rows || '<p class="text-[11px] text-slate-500">لا توجد سور متأخرة المراجعة حالياً.</p>'}
        ${due.length > 5 ? '<p class="text-[10px] text-slate-400 pt-1">تظهر أقدم 5 سور، وتظهر البقية بعد مراجعتها.</p>' : ''}
      </div>
    </div>`;

  attachWeeklySwipe();
  lucide.createIcons();
}

function renderAll() {
  updateMetrics();
  renderPlanner();
  if (state.activeView === 'surah') renderSurahs();
  else if (state.activeView === 'page') renderPages();
  else if (state.activeView === 'tamkeen') renderTamkeenQuiz();
  else renderJuz();
}

// ==========================================
// NAVIGATION & MODE SWITCHER
// ==========================================
function switchMode(mode) {
  state.activeView = mode;
  const tabSurah = document.getElementById('tabModeSurah');
  const tabPage = document.getElementById('tabModePage');
  const tabJuz = document.getElementById('tabModeJuz');
  const tabTamkeen = document.getElementById('tabModeTamkeen');
  const viewSurahs = document.getElementById('viewSurahs');
  const viewPages = document.getElementById('viewPages');
  const viewJuz = document.getElementById('viewJuz');
  const viewTamkeen = document.getElementById('viewTamkeen');

  const mobileTabs = {
    surah: document.getElementById('mobileTabSurah'),
    page: document.getElementById('mobileTabPage'),
    juz: document.getElementById('mobileTabJuz'),
    tamkeen: document.getElementById('mobileTabTamkeen'),
  };

  const activeClasses = ['bg-white', 'dark:bg-slate-900', 'text-emerald-800', 'dark:text-emerald-300', 'shadow-sm'];
  const inactiveClasses = ['text-slate-600', 'dark:text-slate-400'];

  [tabSurah, tabPage, tabJuz, tabTamkeen].forEach(tab => {
    if (tab) {
      tab.classList.remove(...activeClasses);
      tab.classList.add(...inactiveClasses);
    }
  });

  const mobileActiveClasses = ['text-emerald-800', 'dark:text-emerald-300', 'bg-emerald-50', 'dark:bg-emerald-950/70', 'font-bold', 'shadow-xs'];
  const mobileInactiveClasses = ['text-slate-500', 'dark:text-slate-400', 'font-semibold', 'hover:text-slate-900', 'dark:hover:text-white'];

  Object.values(mobileTabs).forEach(btn => {
    if (btn) {
      btn.classList.remove(...mobileActiveClasses);
      btn.classList.add(...mobileInactiveClasses);
    }
  });

  if (viewSurahs) viewSurahs.classList.add('hidden');
  if (viewPages) viewPages.classList.add('hidden');
  if (viewJuz) viewJuz.classList.add('hidden');
  if (viewTamkeen) viewTamkeen.classList.add('hidden');

  if (mode === 'surah') {
    if (tabSurah) {
      tabSurah.classList.add(...activeClasses);
      tabSurah.classList.remove(...inactiveClasses);
    }
    if (mobileTabs.surah) {
      mobileTabs.surah.classList.add(...mobileActiveClasses);
      mobileTabs.surah.classList.remove(...mobileInactiveClasses);
    }
    if (viewSurahs) viewSurahs.classList.remove('hidden');
    renderSurahs();
  } else if (mode === 'page') {
    if (tabPage) {
      tabPage.classList.add(...activeClasses);
      tabPage.classList.remove(...inactiveClasses);
    }
    if (mobileTabs.page) {
      mobileTabs.page.classList.add(...mobileActiveClasses);
      mobileTabs.page.classList.remove(...mobileInactiveClasses);
    }
    if (viewPages) viewPages.classList.remove('hidden');
    renderPages();
  } else if (mode === 'juz') {
    if (tabJuz) {
      tabJuz.classList.add(...activeClasses);
      tabJuz.classList.remove(...inactiveClasses);
    }
    if (mobileTabs.juz) {
      mobileTabs.juz.classList.add(...mobileActiveClasses);
      mobileTabs.juz.classList.remove(...mobileInactiveClasses);
    }
    if (viewJuz) viewJuz.classList.remove('hidden');
    renderJuz();
  } else if (mode === 'tamkeen') {
    if (tabTamkeen) {
      tabTamkeen.classList.add(...activeClasses);
      tabTamkeen.classList.remove(...inactiveClasses);
    }
    if (mobileTabs.tamkeen) {
      mobileTabs.tamkeen.classList.add(...mobileActiveClasses);
      mobileTabs.tamkeen.classList.remove(...mobileInactiveClasses);
    }
    if (viewTamkeen) {
      viewTamkeen.classList.remove('hidden');
      renderTamkeenQuiz();
    }
  }
}

window.switchMode = switchMode;

// ==========================================
// CARD EXPORT AS IMAGE
// ==========================================
async function saveCardImage() {
  const btnSaveCardAsImage = document.getElementById('btnSaveCardAsImage');
  const btnSaveCardText = document.getElementById('btnSaveCardText');
  const cardElement = document.getElementById('printAchievementCard');
  if (!cardElement || !btnSaveCardAsImage) return;

  btnSaveCardAsImage.disabled = true;
  if (btnSaveCardText) btnSaveCardText.textContent = "جاري إنشاء الصورة...";

  try {
    const canvas = await html2canvas(cardElement, {
      scale: 3,
      useCORS: true,
      backgroundColor: null,
      logging: false
    });

    const fileName = `انجاز_القرآن_${new Date().toISOString().slice(0, 10)}.png`;

    canvas.toBlob(async (blob) => {
      if (!blob) {
        const dataUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast("تم تنزيل الصورة بنجاح!");
        btnSaveCardAsImage.disabled = false;
        if (btnSaveCardText) btnSaveCardText.textContent = "حفظ كصورة في الاستوديو";
        return;
      }

      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 1500);

      showToast("تم تنزيل الصورة بنجاح في جهازك!");
      btnSaveCardAsImage.disabled = false;
      if (btnSaveCardText) btnSaveCardText.textContent = "حفظ كصورة في الاستوديو";
    }, 'image/png');

  } catch (error) {
    console.error("خطأ في توليد صورة بطاقة الإنجاز:", error);
    showToast("تعذر إنشاء الصورة، يرجى المحاولة مرة أخرى.");
    btnSaveCardAsImage.disabled = false;
    if (btnSaveCardText) btnSaveCardText.textContent = "حفظ كصورة في الاستوديو";
  }
}

// ==========================================
// DOMContentLoaded INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  syncCount();
  renderJuzJumpers();
  renderAll();
  attachPreviewSwipe();
  lucide.createIcons();

  const installModal = document.getElementById('installAppModal');
  const btnInstall = document.getElementById('btnInstallApp');
  const btnDismissInstall = document.getElementById('btnDismissInstallModal');
  const btnCloseInstall = document.getElementById('btnCloseInstallModal');

  if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
      if (deferredPrompt) {
        try {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === 'accepted') {
            showToast("تم طلب تثبيت التطبيق بنجاح!");
          }
          deferredPrompt = null;
        } catch (e) {
          if (installModal) installModal.classList.remove('hidden');
        }
      } else {
        if (installModal) installModal.classList.remove('hidden');
      }
    });
  }

  if (btnCloseInstall) btnCloseInstall.addEventListener('click', () => installModal.classList.add('hidden'));
  if (btnDismissInstall) btnDismissInstall.addEventListener('click', () => installModal.classList.add('hidden'));

  const btnHeaderTamkeen = document.getElementById('btnHeaderTamkeen');
  const viewTamkeen = document.getElementById('viewTamkeen');
  if (btnHeaderTamkeen && viewTamkeen) {
    btnHeaderTamkeen.addEventListener('click', () => {
      switchMode('tamkeen');
      viewTamkeen.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  const btnHeroTamkeen = document.getElementById('btnHeroTamkeen');
  if (btnHeroTamkeen && viewTamkeen) {
    btnHeroTamkeen.addEventListener('click', () => {
      switchMode('tamkeen');
      viewTamkeen.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  loadTamkeenStats();

  const tabSurah = document.getElementById('tabModeSurah');
  const tabPage = document.getElementById('tabModePage');
  const tabJuz = document.getElementById('tabModeJuz');
  const tabTamkeen = document.getElementById('tabModeTamkeen');

  if (tabSurah) tabSurah.addEventListener('click', () => switchMode('surah'));
  if (tabPage) tabPage.addEventListener('click', () => switchMode('page'));
  if (tabJuz) tabJuz.addEventListener('click', () => switchMode('juz'));
  if (tabTamkeen) tabTamkeen.addEventListener('click', () => switchMode('tamkeen'));

  const mobileTabs = {
    surah: document.getElementById('mobileTabSurah'),
    page: document.getElementById('mobileTabPage'),
    juz: document.getElementById('mobileTabJuz'),
    tamkeen: document.getElementById('mobileTabTamkeen'),
  };

  if (mobileTabs.surah) mobileTabs.surah.addEventListener('click', () => switchMode('surah'));
  if (mobileTabs.page) mobileTabs.page.addEventListener('click', () => switchMode('page'));
  if (mobileTabs.juz) mobileTabs.juz.addEventListener('click', () => switchMode('juz'));
  if (mobileTabs.tamkeen) mobileTabs.tamkeen.addEventListener('click', () => switchMode('tamkeen'));

  // Ensure active mode is applied on init
  switchMode(state.activeView || 'surah');

  const searchInput = document.getElementById('globalSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (state.activeView === 'surah') renderSurahs();
      else if (state.activeView === 'page') renderPages();
    });
  }

  const filterSelect = document.getElementById('filterStatusSelect');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      state.currentFilter = e.target.value;
      if (state.activeView === 'surah') renderSurahs();
      else if (state.activeView === 'page') renderPages();
    });
  }

  const resetModal = document.getElementById('resetConfirmModal');
  const btnResetConfirm = document.getElementById('btnResetConfirm');
  const btnResetCancel = document.getElementById('btnResetCancel');
  const btnResetYes = document.getElementById('btnResetYes');

  if (btnResetConfirm && resetModal) btnResetConfirm.addEventListener('click', () => resetModal.classList.remove('hidden'));
  if (btnResetCancel && resetModal) btnResetCancel.addEventListener('click', () => resetModal.classList.add('hidden'));
  if (resetModal) {
    resetModal.addEventListener('click', (e) => {
      if (e.target === resetModal) resetModal.classList.add('hidden');
    });
  }

  if (btnResetYes && resetModal) {
    btnResetYes.addEventListener('click', () => {
      state.memorizedPages = {};
      state.memorizedSurahs = {};
      state.reviews = {};
      state.log = {};
      state.ayahs = {};
      state.reviewLog = {};
      tamkeenState.stats = { total: 0, correct: 0, streak: 0, bestStreak: 0 };
      saveTamkeenStats();
      updateTamkeenStatsUI();
      syncCount();
      saveState();
      renderAll();
      resetModal.classList.add('hidden');
      showToast("تم تصفير جميع بيانات الحفظ ونتائج تمكين.");
    });
  }

  const backupModal = document.getElementById('backupModal');
  const jsonTextarea = document.getElementById('jsonStateTextarea');
  const btnBackup = document.getElementById('btnBackupModal');
  const btnCloseBackup = document.getElementById('btnCloseBackupModal');
  const btnExportJson = document.getElementById('btnExportJsonFile');
  const btnCopyJson = document.getElementById('btnCopyJsonText');
  const importInput = document.getElementById('importJsonFileInput');

  if (btnBackup && backupModal && jsonTextarea) {
    btnBackup.addEventListener('click', () => {
      jsonTextarea.value = JSON.stringify({
        memorizedPages: state.memorizedPages,
        memorizedSurahs: state.memorizedSurahs,
        reviews: state.reviews,
        log: state.log,
        goal: state.goal,
        studyDays: state.studyDays,
        ayahs: state.ayahs,
        reviewDays: state.reviewDays,
        reviewLog: state.reviewLog,
        surahIntervals: state.surahIntervals,
        userName: state.userName,
        exportedAt: new Date().toISOString()
      }, null, 2);
      backupModal.classList.remove('hidden');
    });
  }

  if (btnCloseBackup && backupModal) btnCloseBackup.addEventListener('click', () => backupModal.classList.add('hidden'));

  if (btnCopyJson && jsonTextarea) {
    btnCopyJson.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(jsonTextarea.value);
        showToast("تم نسخ بيانات النسخة إلى الحافظة!");
      } catch (e) {
        jsonTextarea.select();
        document.execCommand('copy');
        showToast("تم نسخ البيانات!");
      }
    });
  }

  if (btnExportJson) {
    btnExportJson.addEventListener('click', () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
        memorizedPages: state.memorizedPages,
        memorizedSurahs: state.memorizedSurahs,
        reviews: state.reviews,
        log: state.log,
        goal: state.goal,
        studyDays: state.studyDays,
        ayahs: state.ayahs,
        reviewDays: state.reviewDays,
        reviewLog: state.reviewLog,
        surahIntervals: state.surahIntervals,
        userName: state.userName,
        exportedAt: new Date().toISOString()
      }, null, 2));
      const a = document.createElement('a');
      a.href = dataStr;
      a.download = `quran_tracker_backup_${todayStr()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("تم تحميل ملف النسخة الاحتياطية بنجاح!");
    });
  }

  if (importInput && backupModal) {
    importInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (parsed && (parsed.memorizedPages || parsed.memorizedSurahs)) {
            state.memorizedPages = parsed.memorizedPages || {};
            state.memorizedSurahs = parsed.memorizedSurahs || {};
            state.reviews = parsed.reviews || {};
            state.log = parsed.log || {};
            state.goal = parseInt(parsed.goal) || 0;
            state.studyDays = Math.min(7, Math.max(1, parseInt(parsed.studyDays) || 7));
            state.ayahs = parsed.ayahs || {};
            state.reviewDays = Array.isArray(parsed.reviewDays) ? parsed.reviewDays : [];
            state.reviewLog = parsed.reviewLog || {};
            state.surahIntervals = parsed.surahIntervals || {};
            state.userName = parsed.userName || '';
            syncCount();
            saveState();
            renderAll();
            backupModal.classList.add('hidden');
            showToast("تمت استعادة البيانات بنجاح تام!");
          } else {
            showToast("الملف لا يحتوي على بيانات حفظ صالحة.");
          }
        } catch (err) {
          showToast("ملف JSON غير صالح.");
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }

  const achievementModal = document.getElementById('achievementModal');
  const btnShareCard = document.getElementById('btnShareCard');
  const btnCloseAchievement = document.getElementById('btnCloseAchievementModal');
  const btnMainSaveImage = document.getElementById('btnMainSaveImage');
  const btnSaveCardAsImage = document.getElementById('btnSaveCardAsImage');

  if (btnShareCard && achievementModal) {
    btnShareCard.addEventListener('click', () => {
      updateMetrics();
      achievementModal.classList.remove('hidden');
    });
  }

  if (btnCloseAchievement && achievementModal) {
    btnCloseAchievement.addEventListener('click', () => achievementModal.classList.add('hidden'));
  }

  if (btnSaveCardAsImage) {
    btnSaveCardAsImage.addEventListener('click', saveCardImage);
  }

  if (btnMainSaveImage && achievementModal) {
    btnMainSaveImage.addEventListener('click', () => {
      updateMetrics();
      achievementModal.classList.remove('hidden');
    });
  }

  const themeBtn = document.getElementById('btnThemeToggle');
  let savedTheme = null;
  try { savedTheme = localStorage.getItem('quran_tracker_theme'); } catch (e) { }
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      try { localStorage.setItem('quran_tracker_theme', isDark ? 'dark' : 'light'); } catch (e) { }
    });
  }

  const studentInput = document.getElementById('studentNameInput');
  if (studentInput) {
    studentInput.value = state.userName || '';
    studentInput.addEventListener('input', (e) => {
      state.userName = e.target.value;
      updateStudentNameDisplay();
      saveState();
    });
  }

  const aboutModal = document.getElementById('aboutAppModal');
  const btnAbout = document.getElementById('btnAboutModal');
  const btnCloseAbout = document.getElementById('btnCloseAboutModal');
  const btnDismissAbout = document.getElementById('btnDismissAboutModal');

  if (btnAbout && aboutModal) {
    btnAbout.addEventListener('click', () => {
      aboutModal.classList.remove('hidden');
      if (window.lucide) lucide.createIcons();
    });
  }
  if (btnCloseAbout && aboutModal) btnCloseAbout.addEventListener('click', () => aboutModal.classList.add('hidden'));
  if (btnDismissAbout && aboutModal) btnDismissAbout.addEventListener('click', () => aboutModal.classList.add('hidden'));

  const resetTamkeenModal = document.getElementById('resetTamkeenConfirmModal');

  window.addEventListener('click', (e) => {
    if (e.target === backupModal) backupModal.classList.add('hidden');
    if (e.target === achievementModal) achievementModal.classList.add('hidden');
    if (e.target === installModal) installModal.classList.add('hidden');
    if (e.target === aboutModal) aboutModal.classList.add('hidden');
    if (e.target === resetTamkeenModal) closeResetTamkeenModal();
    const previewModal = document.getElementById('pagePreviewModal');
    if (previewModal && e.target === previewModal) previewModal.classList.add('hidden');
  });
});

// ==========================================
// HISTORY POPSTATE EXIT GUARD
// ==========================================
(function () {
  const modal = document.getElementById('exitConfirmModal');
  if (!modal) return;
  let isGuarded = false;

  function pushGuard() {
    if (!isGuarded) {
      try {
        history.pushState({ quranTrackerGuard: true }, '', location.href);
        isGuarded = true;
      } catch (e) {
        isGuarded = false;
      }
    }
  }

  pushGuard();

  window.addEventListener('popstate', function () {
    if (isGuarded) {
      isGuarded = false;
      modal.classList.remove('hidden');
    }
  });

  const btnStay = document.getElementById('btnExitStay');
  if (btnStay) {
    btnStay.addEventListener('click', function () {
      modal.classList.add('hidden');
      pushGuard();
    });
  }

  const btnLeave = document.getElementById('btnExitLeave');
  if (btnLeave) {
    btnLeave.addEventListener('click', function () {
      modal.classList.add('hidden');
      isGuarded = false;
      if (window.history.length > 1) {
        history.back();
      } else {
        window.close();
      }
    });
  }

  modal.addEventListener('click', function (e) {
    if (e.target === modal) {
      modal.classList.add('hidden');
      pushGuard();
    }
  });
})();
