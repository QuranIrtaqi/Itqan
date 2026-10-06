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

function isAppInstalled() {
  if (deferredPrompt) return false;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
    || (document.referrer && document.referrer.includes('android-app://'));
  return isStandalone;
}

function updateInstallUI() {
  const isInstalled = isAppInstalled();
  const installBtn = document.getElementById('btnInstallApp');
  const installBtnText = document.getElementById('installBtnText');
  const banner = document.getElementById('installReminderBanner');

  if (installBtn) {
    if (isInstalled) {
      // Installed state: remove this button completely instead of making it smaller!
      installBtn.classList.remove('animate-pulse');
      installBtn.classList.add('hidden');
    } else {
      // Browser state (not installed): shows phone icon on mobile, plus text on larger screens
      installBtn.classList.remove('hidden');
      installBtn.className = "p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm shadow-emerald-900/30 transition active:scale-95 flex items-center gap-1 shrink-0 animate-pulse";
      installBtn.title = "تثبيت التطبيق على الشاشة الرئيسية";
      if (installBtnText) installBtnText.className = "hidden min-[480px]:inline";
    }
  }

  if (banner) {
    const isDismissed = sessionStorage.getItem('dismiss_install_banner') === 'true';
    if (isInstalled || isDismissed) {
      banner.classList.add('hidden');
    } else {
      banner.classList.remove('hidden');
    }
  }
}

// ==========================================
// COACH MARKS / SPOTLIGHT & POPOVERS TOUR
// ==========================================
const COACH_MARKS_STEPS = [
  {
    targetSelector: 'header',
    fallbackSelector: '#btnHeaderScrollTop',
    badge: 'الخطوة 1 من 10',
    icon: 'compass',
    title: 'الشريط العلوي وأدوات التحكم والوصول السريع',
    text: 'الترويسة العلوية تمنحك وصولاً فورياً لاختبارات تمكين، تثبيت التطبيق، تصدير بطاقة الإنجاز، دفتر التثبيت، دليل التطبيق، منبه الورد، وتبديل النمط. كما يمكنك النقر على العنوان في أي وقت للصعود الفوري لأعلى الصفحة.',
    switchView: 'surah'
  },
  {
    targetSelector: '.lg\\:col-span-8',
    fallbackSelector: '#statProgressBar',
    badge: 'الخطوة 2 من 10',
    icon: 'percent',
    title: 'لوحة إنجاز الحفظ ومسار الختم',
    text: 'تتابع هنا إجمالي تقدمك في حفظ القرآن الكريم (604 صفحة) بالنسبة المئوية الحية، مع شريط تقدم المسار المتبقي نحو الختم، وإحصائيات السور والأجزاء المكتملة وعدد الآيات المحفوظة.',
    switchView: 'surah'
  },
  {
    targetSelector: '#plannerCard',
    fallbackSelector: '#statRemainingNotice',
    badge: 'الخطوة 3 من 10',
    icon: 'flame',
    title: 'شعلة الالتزام ورصيد أيام التعويض (Streak)',
    text: 'تابع التزامك اليومي وترقّ عبر 8 أوسمة نبوية متدرجة حتى تتوج بـ «👑 تاج الوقار». يحمي نظام التعويض سلسلتك من الانقطاع برصيد أيام تعويض (تلقائياً أو يدوياً) يزداد مع استمرارك كل 7 أسابيع.',
    switchView: 'surah'
  },
  {
    targetSelector: '#dailyWardContainer',
    fallbackSelector: '#dailyWardCard',
    badge: 'الخطوة 4 من 10',
    icon: 'calendar-check',
    title: 'الورد اليومي الذكي للمراجعة والحفظ',
    text: 'بطاقة ذكية تقترح عليك يومياً السور والصفحات المستحقة للمراجعة بناءً على خوارزمية التكرار المتباعد لمنع تفلت الحفظ، مع إمكانية تسجيل إنجاز مراجعة السورة بنقرة واحدة.',
    switchView: 'surah'
  },
  {
    targetSelector: '#tabModeSurah',
    fallbackSelector: '.tab-btn',
    badge: 'الخطوة 5 من 10',
    icon: 'layers',
    title: 'خيارات العرض والبحث الفوري والتصفية',
    text: 'تنقل بمرونة فائقة بين عرض السور (114)، شبكة الصفحات (604)، الأجزاء (30)، ومحرك تمكين بدون أي تمرير جانبي، مع شريط بحث فوري بالاسم أو الرقم أو الصفحة وفلاتر المحفوظ.',
    switchView: 'surah'
  },
  {
    targetSelector: '#surahGridContainer',
    fallbackSelector: '#viewSurahs',
    badge: 'الخطوة 6 من 10',
    icon: 'check-circle-2',
    title: 'تسجيل الحفظ وجدولة المراجعة (SRS)',
    text: 'انقر على أي سورة لتحديد تمام حفظها، وقيّم جودة مراجعتك بثلاثة مستويات: (🟢 ممتاز 28 يوماً | 🟡 متوسط 14 يوماً | 🔴 يحتاج تثبيت 4 أيام) ليتولى النظام جدولة مراجعتها بدقة.',
    switchView: 'surah'
  },
  {
    targetSelector: '#viewPages',
    fallbackSelector: '#tabModePage',
    badge: 'الخطوة 7 من 10',
    icon: 'layout-grid',
    title: 'شبكة الصفحات وتحديد النطاق دفعة واحدة',
    text: 'استعرض صفحات المصحف الـ 604، وحدد حفظ أي صفحة بنقرة، أو استخدم أداة «نطاق الصفحات» لحفظ أو إلغاء مجموعة صفحات متتابعة دفعة واحدة (من ص X إلى ص Y) مع المزامنة التلقائية للسور والأجزاء.',
    switchView: 'page'
  },
  {
    targetSelector: '#tabModePage',
    fallbackSelector: '#pageGridContainer',
    badge: 'الخطوة 8 من 10',
    icon: 'volume-2',
    title: 'معاينة المصحف الشريف والتلاوة الصوتية',
    text: 'اضغط على زر العين (👁️) في أي صفحة لعرض مصحف المدينة عالي الدقة، مع مشغل صوتي لـ 9 قراء (الشيخ الحصري افتراضياً)، ومتابعة رقم الآية الدقيق في السورة وموقعها، وتقليب الصفحات بالسحب (Swipe) أو الأسهم.',
    switchView: 'page'
  },
  {
    targetSelector: '#viewTamkeen',
    fallbackSelector: '#tabModeTamkeen',
    badge: 'الخطوة 9 من 10',
    icon: 'brain',
    title: 'منظومة «تَمْكِين» لاختبار وتثبيت الحفظ',
    text: 'محرك اختبارات تفاعلي لا نهائي للآيات بالرسم العثماني؛ يدعم اختبارات الآية التالية وتحديد السورة مع ميزة حجب الخيارات للتسميع غيباً أولاً في صدرك، ومنع تكرار الأسئلة، ولوحة إحصائيات متقدمة.',
    switchView: 'tamkeen'
  },
  {
    targetSelector: '#btnBackupCard',
    fallbackSelector: '#btnResetConfirm',
    badge: 'الخطوة 10 من 10',
    icon: 'database',
    title: 'دفتر التثبيت والنسخ الاحتياطي وتصفير السجل',
    text: 'سجل أخطائك في تمكين يُحفظ تلقائياً في «دفتر التثبيت» للتركيز عليه. كما يمكنك حفظ نسخة احتياطية (JSON) واستعادتها في أي وقت، أو تصفير السجل بالكامل للبدء من جديد كأول استخدام.',
    switchView: 'surah'
  }
];

let currentCoachStep = 0;
let coachMarksActive = false;

function startCoachMarksTour(stepIndex = 0) {
  coachMarksActive = true;
  currentCoachStep = Math.max(0, Math.min(stepIndex, COACH_MARKS_STEPS.length - 1));
  const overlay = document.getElementById('coachMarksOverlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  renderCoachStep();
}

function stopCoachMarksTour(markSeen = true) {
  coachMarksActive = false;
  const overlay = document.getElementById('coachMarksOverlay');
  if (overlay) overlay.classList.add('hidden');
  if (markSeen) {
    localStorage.setItem('itqan_tutorial_seen', 'true');
    const reminder = document.getElementById('newUserTutorialReminder');
    if (reminder) reminder.classList.add('hidden');
  }
}

function getVisibleTarget(step) {
  let el = document.querySelector(step.targetSelector);
  if (!el || el.offsetParent === null) {
    if (step.fallbackSelector) el = document.querySelector(step.fallbackSelector);
  }
  return el;
}

function renderCoachStep() {
  if (!coachMarksActive) return;
  const step = COACH_MARKS_STEPS[currentCoachStep];
  if (step.switchView && typeof switchMode === 'function') {
    switchMode(step.switchView, false);
  }
  const target = getVisibleTarget(step);
  const spotlight = document.getElementById('coachMarksSpotlight');
  const popover = document.getElementById('coachMarksPopover');
  const titleEl = document.getElementById('coachMarksTitle');
  const textEl = document.getElementById('coachMarksText');
  const badgeEl = document.getElementById('coachMarksBadge');
  const btnPrev = document.getElementById('btnCoachMarksPrev');
  const btnNext = document.getElementById('btnCoachMarksNext');
  const dotsContainer = document.getElementById('coachMarksDots');

  if (badgeEl) badgeEl.textContent = step.badge;
  if (titleEl) {
    titleEl.innerHTML = `<i data-lucide="${step.icon}" class="w-4 h-4 text-gold-500 shrink-0"></i><span>${step.title}</span>`;
  }
  if (textEl) textEl.textContent = step.text;

  if (dotsContainer) {
    dotsContainer.innerHTML = COACH_MARKS_STEPS.map((_, i) => `
      <button type="button" onclick="startCoachMarksTour(${i})" class="h-2 rounded-full transition-all ${
        i === currentCoachStep ? 'w-5 bg-gold-500' : 'w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
      }" title="الخطوة ${i + 1}"></button>
    `).join('');
  }

  if (btnPrev) {
    btnPrev.style.display = currentCoachStep === 0 ? 'none' : 'inline-flex';
  }

  if (btnNext) {
    if (currentCoachStep === COACH_MARKS_STEPS.length - 1) {
      btnNext.innerHTML = `<span>إنهاء الجولة ✨</span>`;
      btnNext.className = "px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-500 hover:from-gold-600 hover:to-amber-600 text-slate-950 font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-1";
    } else {
      btnNext.innerHTML = `<span>التالي</span><i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>`;
      btnNext.className = "px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-1";
    }
  }

  if (window.lucide) lucide.createIcons();

  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      positionSpotlightAndPopover(target, spotlight, popover);
    }, 180);
  } else {
    centerSpotlightAndPopover(spotlight, popover);
  }
}

function positionSpotlightAndPopover(target, spotlight, popover) {
  if (!spotlight || !popover || !target) return;
  const r = target.getBoundingClientRect();
  const pad = 8;
  const spotTop = Math.max(0, r.top - pad);
  const spotLeft = Math.max(0, r.left - pad);
  const spotWidth = Math.min(window.innerWidth, r.width + pad * 2);
  const spotHeight = r.height + pad * 2;

  spotlight.style.top = `${spotTop}px`;
  spotlight.style.left = `${spotLeft}px`;
  spotlight.style.width = `${spotWidth}px`;
  spotlight.style.height = `${spotHeight}px`;

  const popWidth = Math.min(popover.offsetWidth || 360, window.innerWidth - 24);
  const popHeight = popover.offsetHeight || 190;

  let top;
  if (spotTop + spotHeight + popHeight + 20 < window.innerHeight) {
    top = spotTop + spotHeight + 12;
  } else if (spotTop - popHeight - 16 > 0) {
    top = spotTop - popHeight - 12;
  } else {
    top = Math.max(12, (window.innerHeight - popHeight) / 2);
  }

  let left = spotLeft + (spotWidth - popWidth) / 2;
  left = Math.max(12, Math.min(left, window.innerWidth - popWidth - 12));

  popover.style.top = `${top}px`;
  popover.style.left = `${left}px`;
}

function centerSpotlightAndPopover(spotlight, popover) {
  if (spotlight) {
    spotlight.style.top = '40%';
    spotlight.style.left = '50%';
    spotlight.style.width = '0px';
    spotlight.style.height = '0px';
  }
  if (popover) {
    const popWidth = Math.min(360, window.innerWidth - 24);
    const popHeight = 190;
    popover.style.top = `${(window.innerHeight - popHeight) / 2}px`;
    popover.style.left = `${(window.innerWidth - popWidth) / 2}px`;
  }
}

window.addEventListener('resize', () => {
  if (coachMarksActive) renderCoachStep();
});
window.addEventListener('scroll', () => {
  if (coachMarksActive) {
    const step = COACH_MARKS_STEPS[currentCoachStep];
    const target = getVisibleTarget(step);
    const spotlight = document.getElementById('coachMarksSpotlight');
    const popover = document.getElementById('coachMarksPopover');
    if (target && spotlight && popover) {
      positionSpotlightAndPopover(target, spotlight, popover);
    }
  }
}, { passive: true });

function checkNewUserTutorial() {
  const seen = localStorage.getItem('itqan_tutorial_seen') === 'true';
  const dismissedInSession = sessionStorage.getItem('dismiss_tutorial_prompt') === 'true';
  const reminder = document.getElementById('newUserTutorialReminder');
  if (reminder) {
    if (!seen && !dismissedInSession) {
      reminder.classList.remove('hidden');
    } else {
      reminder.classList.add('hidden');
    }
  }
}
window.startCoachMarksTour = startCoachMarksTour;
window.stopCoachMarksTour = stopCoachMarksTour;
window.openTutorial = startCoachMarksTour;
window.closeTutorial = stopCoachMarksTour;

async function triggerInstallFlow() {
  if (deferredPrompt) {
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        updateInstallUI();
        showToast("تم طلب تثبيت التطبيق بنجاح!");
      }
      deferredPrompt = null;
    } catch (e) {
      const installModal = document.getElementById('installAppModal');
      if (installModal) installModal.classList.remove('hidden');
    }
  } else {
    const installModal = document.getElementById('installAppModal');
    if (installModal) installModal.classList.remove('hidden');
  }
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  try { localStorage.removeItem('quran_app_installed'); } catch (e) { }
  updateInstallUI();
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  updateInstallUI();
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
    let pagesCount = 0;

    for (let p = s.startPage; p <= s.endPage; p++) {
      if (state.memorizedPages[p]) pagesCount++;
    }

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
        pct = Math.round((pagesCount / totalPages) * 100);
        progressLabel = `${pct}% (${formatStdNum(pagesCount)}/${formatStdNum(totalPages)} ص)`;
      }
    }

    const hasStarted = !isDone && (pagesCount > 0 || (state.ayahs && state.ayahs[s.id] > 0));

    let cardBgClass = "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800 shadow-sm";
    let badgeStateHtml = `<span class="text-[10px] px-2 py-0.5 rounded-full ${s.type === 'مكية' ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'} font-semibold font-sans">${s.type}</span>`;
    let progressBarClass = "bg-emerald-600";

    if (isDone) {
      cardBgClass = "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-400/80 dark:border-emerald-700 shadow-sm shadow-emerald-700/10";
      badgeStateHtml = `<span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300/80 dark:border-emerald-800 flex items-center gap-1"><span>✓</span><span>مكتملة</span></span>`;
    } else if (hasStarted) {
      cardBgClass = "surah-card-in-progress shadow-sm shadow-amber-900/10";
      badgeStateHtml = `<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold border border-amber-300/80 dark:border-amber-800 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span><span>قيد الحفظ (${formatStdNum(pct)}%)</span></span>`;
      progressBarClass = "bg-gradient-to-l from-amber-500 to-amber-600";
    }

    return `
      <div onclick="toggleSurah(${s.id})" class="cursor-pointer group relative p-3.5 rounded-2xl border transition-all duration-200 select-none active:scale-[0.99] touch-manipulation ${cardBgClass}">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs font-sans ${isDone
        ? 'bg-emerald-700 text-white shadow-md shadow-emerald-700/30'
        : (hasStarted ? 'bg-amber-500 text-white shadow-md shadow-amber-600/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-950 group-hover:text-emerald-800 transition')
      }">
              ${formatStdNum(s.id)}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h4 class="font-bold text-slate-900 dark:text-white text-base group-hover:text-emerald-700 dark:group-hover:text-emerald-300 font-quran transition">
                  سُورَةُ ${s.name}
                </h4>
                ${badgeStateHtml}
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

        <div class="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between font-sans gap-2 flex-wrap">
          <div class="flex items-center gap-2 flex-1 min-w-[120px]">
            <div class="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full ${progressBarClass} rounded-full transition-all duration-300" style="width: ${pct}%"></div>
            </div>
            <span class="text-[10px] text-slate-500 font-medium whitespace-nowrap">${progressLabel}</span>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <button type="button" onclick="event.stopPropagation(); triggerHaptic('light'); openPagePreview(${s.startPage})" title="تصفح وقراءة السورة في المصحف" class="px-2 py-1 rounded-lg text-[10.5px] font-bold bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/50 text-slate-700 hover:text-emerald-800 dark:text-slate-300 dark:hover:text-emerald-300 border border-slate-200 dark:border-slate-700 transition active:scale-95 flex items-center gap-1">
              <i data-lucide="book-open" class="w-3 h-3 text-emerald-600"></i>
              <span>المصحف</span>
            </button>
            <button type="button" onclick="event.stopPropagation(); triggerHaptic('light'); startTamkeenForSurah(${s.id})" title="اختبار فوري في تمكين لهذه السورة" class="px-2 py-1 rounded-lg text-[10.5px] font-bold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800 transition active:scale-95 flex items-center gap-1">
              <i data-lucide="brain" class="w-3 h-3 text-amber-600"></i>
              <span>اختبرني</span>
            </button>
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

function startTamkeenForSurah(surahId) {
  triggerHaptic('light');
  switchMode('tamkeen', true);
  if (typeof startTamkeenSpecificSurah === 'function') {
    startTamkeenSpecificSurah(surahId);
  }
}

function renderPages() {
  const container = document.getElementById('pageGridContainer');
  if (!container) return;
  const query = normAr(state.searchQuery);
  const filter = state.currentFilter;

  let totalVisiblePages = 0;
  let html = '';

  AJZA.forEach(j => {
    let juzPagesHtml = '';
    let juzDoneCount = 0;
    let juzVisibleCount = 0;
    const totalInJuz = (j.end - j.start + 1);
    const midPointPage = Math.ceil((j.start + j.end) / 2);
    const hizb1Num = (j.juz * 2) - 1;
    const hizb2Num = j.juz * 2;

    for (let p = j.start; p <= j.end; p++) {
      const isDone = !!state.memorizedPages[p];
      if (isDone) juzDoneCount++;

      const surahNames = getSurahsForPage(p);
      const juz = j.juz;

      let matches = true;
      if (query) {
        const matchNum = p.toString() === query;
        const matchSurah = normAr(surahNames).includes(query);
        const matchJuz = normAr(`جزء ${juz}`).includes(query) || juz.toString() === query;
        matches = matchNum || matchSurah || matchJuz;
      }
      if (filter === 'memorized' && !isDone) matches = false;
      if (filter === 'unmemorized' && isDone) matches = false;

      if (matches) {
        juzVisibleCount++;
        totalVisiblePages++;
      }

      // Add Hizb 2 separator divider before the second half of the Juz
      if (p === midPointPage) {
        juzPagesHtml += `
          <div class="col-span-full my-2.5 py-1 px-3 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-between text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
            <span class="flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
              الحزب ${formatStdNum(hizb2Num)} (النصف الثاني)
            </span>
            <span class="text-[10px] font-normal opacity-75">ص ${formatStdNum(midPointPage)} - ${formatStdNum(j.end)}</span>
          </div>
        `;
      }

      const opacityClass = matches ? 'opacity-100' : 'opacity-20 pointer-events-none';

      juzPagesHtml += `
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

    // Skip displaying the Juz card entirely if there is an active search and no pages matched
    if (query && juzVisibleCount === 0) return;

    const juzPct = Math.round((juzDoneCount / totalInJuz) * 100);
    const isJuzComplete = juzDoneCount === totalInJuz;

    html += `
      <section id="juz-block-${j.juz}" class="bg-white/95 dark:bg-slate-900/95 border ${isJuzComplete ? 'border-emerald-500/60 shadow-emerald-900/10' : 'border-slate-200/90 dark:border-slate-800'} rounded-2xl p-3.5 sm:p-5 shadow-sm space-y-3 transition scroll-mt-28">
        <!-- رأس الجزء -->
        <div class="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
          <div class="flex items-center gap-2.5">
            <span class="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${isJuzComplete ? 'bg-emerald-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}">
              ${formatStdNum(j.juz)}
            </span>
            <div>
              <div class="flex items-center gap-2">
                <h4 class="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">الجزء ${formatStdNum(j.juz)}</h4>
                <span class="text-[11px] text-emerald-700 dark:text-emerald-400 font-quran font-normal">(${j.name})</span>
              </div>
              <p class="text-[10px] text-slate-400 font-sans">
                الحزب ${formatStdNum(hizb1Num)} و${formatStdNum(hizb2Num)} • الصفحات ${formatStdNum(j.start)} - ${formatStdNum(j.end)}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-xs font-bold px-2 py-0.5 rounded-full ${isJuzComplete ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}">
              ${formatStdNum(juzDoneCount)}/${formatStdNum(totalInJuz)} (${juzPct}%)
            </span>
            <div class="flex items-center gap-1">
              <button onclick="markWholeJuz(${j.juz}, true)" title="حفظ الجزء بالكامل" class="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-[11px] font-bold transition active:scale-95">
                حفظ الكل
              </button>
              <button onclick="markWholeJuz(${j.juz}, false)" title="إلغاء حفظ الجزء" class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 text-[11px] font-bold transition active:scale-95">
                إلغاء
              </button>
            </div>
          </div>
        </div>

        <!-- شبكة صفحات الجزء مع فواصل الأحزاب -->
        <div class="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5 sm:gap-2">
          ${juzPagesHtml}
        </div>
      </section>
    `;
  });

  if (!html) {
    html = `
      <div class="text-center py-12 bg-white/70 dark:bg-slate-900/70 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-6 space-y-2">
        <i data-lucide="search-x" class="w-10 h-10 text-slate-400 mx-auto"></i>
        <h4 class="text-sm font-bold text-slate-700 dark:text-slate-300">لا توجد صفحات مطابقة</h4>
        <p class="text-xs text-slate-500">جرب البحث برقم صفحة آخر أو إلغاء التصفية الحالية</p>
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
    <button id="juz-btn-${j.juz}" onclick="jumpToPage(${j.start}, ${j.juz})" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-700 hover:text-white text-slate-700 dark:text-slate-300 transition text-xs whitespace-nowrap font-bold font-sans active:scale-95">
      ج${formatStdNum(j.juz)}
    </button>
  `).join('');
}

function jumpToPage(page, juzNum) {
  if (typeof triggerHaptic === 'function') triggerHaptic('light');
  if (juzNum) {
    document.querySelectorAll('#juzJumpersContainer button').forEach(b => b.classList.remove('juz-jumper-active'));
    const btn = document.getElementById(`juz-btn-${juzNum}`);
    if (btn) {
      btn.classList.add('juz-jumper-active');
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  // First try scrolling to the specific page cell
  const el = document.getElementById(`page-cell-${page}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-4', 'ring-gold-400');
    setTimeout(() => el.classList.remove('ring-4', 'ring-gold-400'), 1500);
    return;
  }

  // Fallback to scrolling to the juz section block
  if (juzNum) {
    const juzBlock = document.getElementById(`juz-block-${juzNum}`);
    if (juzBlock) {
      juzBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
// PAGE PREVIEW MODAL, AUDIO PLAYER & SWIPE GESTURES
// ==========================================
let currentPreviewPage = 1;

const PAGE_RECITERS = [
  { id: 'ar.husary', name: 'محمود خليل الحصري' },
  { id: 'ar.alafasy', name: 'مشاري راشد العفاسي' },
  { id: 'ar.minshawi', name: 'محمد صديق المنشاوي (مرتل)' },
  { id: 'ar.abdulbasitmurattal', name: 'عبد الباسط عبد الصمد (مرتل)' },
  { id: 'ar.mahermuaiqly', name: 'ماهر المعيقلي' },
  { id: 'ar.saoodshuraym', name: 'سعود الشريم' },
  { id: 'ar.hudhaify', name: 'علي عبد الرحمن الحذيفي' },
  { id: 'ar.ahmedajamy', name: 'أحمد بن علي العجمي' }
];

let selectedPageReciter = 'ar.husary';
try {
  const savedReciter = localStorage.getItem('quran_preview_reciter_v2') || localStorage.getItem('quran_preview_reciter');
  if (savedReciter && PAGE_RECITERS.some(r => r.id === savedReciter)) {
    selectedPageReciter = localStorage.getItem('quran_preview_reciter_v2') ? savedReciter : (savedReciter === 'ar.alafasy' ? 'ar.husary' : savedReciter);
  }
} catch (e) { }

let currentPreviewAudio = null;
let isPageAudioPlaying = false;
let isPageAudioLoading = false;
let currentPageAyahsData = null;
let currentPlayingAyahIndex = 0;
let pageAudioCache = {};

function initPageReciterSelect() {
  const select = document.getElementById('pageReciterSelect');
  if (!select) return;
  select.innerHTML = PAGE_RECITERS.map(r => `
    <option value="${r.id}" ${r.id === selectedPageReciter ? 'selected' : ''}>${r.name}</option>
  `).join('');
}

function updatePageAudioUIState(isPlaying, isLoading = false, ayahIndex = 0) {
  const icon = document.getElementById('pageAudioPlayIcon');
  const text = document.getElementById('pageAudioPlayText');
  const waves = document.getElementById('pageAudioWaves');
  const statusPill = document.getElementById('pageAudioAyahStatus');
  const ayahText = document.getElementById('pageAudioAyahText');
  const navControls = document.getElementById('pageAudioNavControls');

  if (isLoading) {
    if (text) text.textContent = 'جاري التحميل...';
    if (icon) icon.setAttribute('data-lucide', 'loader-2');
    if (waves) waves.classList.add('hidden');
    if (window.lucide) lucide.createIcons();
    return;
  }

  if (isPlaying) {
    if (icon) icon.setAttribute('data-lucide', 'pause');
    if (text) text.textContent = 'إيقاف مؤقت';
    if (waves) waves.classList.remove('hidden');
    if (statusPill) {
      statusPill.classList.remove('hidden');
      statusPill.classList.add('flex');
    }
    if (navControls) {
      navControls.classList.remove('hidden');
      navControls.classList.add('flex');
    }

    if (ayahText && currentPageAyahsData && currentPageAyahsData[ayahIndex]) {
      const curAyah = currentPageAyahsData[ayahIndex];
      const sName = curAyah.surah && curAyah.surah.name ? curAyah.surah.name.replace(/^سُورَةُ\s*/, '') : '';
      const ayahNumInSurah = curAyah.numberInSurah;
      const totalInPage = currentPageAyahsData.length;
      ayahText.textContent = `${sName ? sName + ' : ' : ''}الآية ${formatStdNum(ayahNumInSurah)} (${formatStdNum(ayahIndex + 1)} من ${formatStdNum(totalInPage)})`;
    }
  } else {
    if (currentPreviewAudio && currentPreviewAudio.paused && currentPageAyahsData) {
      if (icon) icon.setAttribute('data-lucide', 'play');
      if (text) text.textContent = 'استئناف التلاوة';
      if (waves) waves.classList.add('hidden');
      if (statusPill) {
        statusPill.classList.remove('hidden');
        statusPill.classList.add('flex');
      }
      if (navControls) {
        navControls.classList.remove('hidden');
        navControls.classList.add('flex');
      }
      if (ayahText && currentPageAyahsData[ayahIndex]) {
        const curAyah = currentPageAyahsData[ayahIndex];
        const sName = curAyah.surah && curAyah.surah.name ? curAyah.surah.name.replace(/^سُورَةُ\s*/, '') : '';
        const ayahNumInSurah = curAyah.numberInSurah;
        const totalInPage = currentPageAyahsData.length;
        ayahText.textContent = `${sName ? sName + ' : ' : ''}الآية ${formatStdNum(ayahNumInSurah)} (${formatStdNum(ayahIndex + 1)} من ${formatStdNum(totalInPage)})`;
      }
    } else {
      if (icon) icon.setAttribute('data-lucide', 'volume-2');
      if (text) text.textContent = 'استمع للتلاوة';
      if (waves) waves.classList.add('hidden');
      if (statusPill) {
        statusPill.classList.add('hidden');
        statusPill.classList.remove('flex');
      }
      if (navControls) {
        navControls.classList.add('hidden');
        navControls.classList.remove('flex');
      }
    }
  }
  if (window.lucide) lucide.createIcons();
}

async function getPageAyahsAudio(pageNum, reciterId) {
  const cacheKey = `quran_page_audio_${pageNum}_${reciterId}`;
  if (pageAudioCache[cacheKey]) return pageAudioCache[cacheKey];

  try {
    const local = localStorage.getItem(cacheKey);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && Array.isArray(parsed.ayahs) && parsed.ayahs.length > 0) {
        pageAudioCache[cacheKey] = parsed.ayahs;
        return parsed.ayahs;
      }
    }
  } catch (e) { }

  const resp = await fetch(`https://api.alquran.cloud/v1/page/${pageNum}/${reciterId}`);
  if (!resp.ok) throw new Error("فشل جلب تلاوة الصفحة");
  const json = await resp.json();
  if (json && json.data && Array.isArray(json.data.ayahs)) {
    pageAudioCache[cacheKey] = json.data.ayahs;
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ ayahs: json.data.ayahs }));
    } catch (e) { }
    return json.data.ayahs;
  }
  throw new Error("استجابة غير صالحة");
}

function playPageAyahAtIndex(index) {
  if (!currentPageAyahsData || index < 0 || index >= currentPageAyahsData.length) {
    stopPageAudio();
    return;
  }
  currentPlayingAyahIndex = index;
  const ayah = currentPageAyahsData[index];
  const audioUrl = ayah.audio || `https://cdn.islamic.network/quran/audio/128/${selectedPageReciter}/${ayah.number}.mp3`;

  if (currentPreviewAudio) {
    try { currentPreviewAudio.pause(); } catch (e) { }
  }

  currentPreviewAudio = new Audio(audioUrl);
  currentPreviewAudio.dataset.index = index;
  currentPreviewAudio.dataset.page = currentPreviewPage;

  currentPreviewAudio.onended = () => {
    if (currentPlayingAyahIndex + 1 < currentPageAyahsData.length) {
      playPageAyahAtIndex(currentPlayingAyahIndex + 1);
    } else {
      stopPageAudio();
      if (typeof showToast === 'function') {
        showToast(`اكتملت تلاوة صفحة ${formatStdNum(currentPreviewPage)} بحمد الله.`);
      }
    }
  };

  currentPreviewAudio.onerror = (e) => {
    console.warn("Audio playback note:", e);
    if (currentPlayingAyahIndex + 1 < currentPageAyahsData.length) {
      playPageAyahAtIndex(currentPlayingAyahIndex + 1);
    } else {
      stopPageAudio();
      if (typeof showToast === 'function') showToast("تعذر تشغيل الصوت للآية الحالية");
    }
  };

  currentPreviewAudio.play().then(() => {
    isPageAudioPlaying = true;
    updatePageAudioUIState(true, false, index);
  }).catch(err => {
    console.warn("Audio playback note:", err);
    stopPageAudio();
  });
}

async function startPlayingCurrentPreviewPage(fromIndex = 0) {
  if (currentPreviewAudio) {
    try { currentPreviewAudio.pause(); } catch (e) { }
    currentPreviewAudio = null;
  }
  isPageAudioPlaying = false;
  isPageAudioLoading = true;
  updatePageAudioUIState(false, true, 0);

  try {
    const ayahs = await getPageAyahsAudio(currentPreviewPage, selectedPageReciter);
    currentPageAyahsData = ayahs;
    isPageAudioLoading = false;
    playPageAyahAtIndex(fromIndex);
  } catch (err) {
    console.error("Failed to load page audio:", err);
    isPageAudioLoading = false;
    stopPageAudio();
    if (typeof showToast === 'function') {
      showToast("تعذر تحميل تلاوة الصفحة، تأكد من الاتصال بالإنترنت.");
    }
  }
}

async function togglePageAudio() {
  if (isPageAudioLoading) return;

  if (isPageAudioPlaying && currentPreviewAudio) {
    try { currentPreviewAudio.pause(); } catch (e) { }
    isPageAudioPlaying = false;
    updatePageAudioUIState(false, false, currentPlayingAyahIndex);
    return;
  }

  if (!isPageAudioPlaying && currentPreviewAudio && currentPreviewAudio.paused && currentPageAyahsData && currentPreviewAudio.dataset.page == currentPreviewPage) {
    try {
      await currentPreviewAudio.play();
      isPageAudioPlaying = true;
      updatePageAudioUIState(true, false, currentPlayingAyahIndex);
      return;
    } catch (e) { }
  }

  await startPlayingCurrentPreviewPage(0);
}

function stopPageAudio() {
  if (currentPreviewAudio) {
    try { currentPreviewAudio.pause(); } catch (e) { }
    currentPreviewAudio = null;
  }
  isPageAudioPlaying = false;
  isPageAudioLoading = false;
  currentPageAyahsData = null;
  currentPlayingAyahIndex = 0;
  updatePageAudioUIState(false, false, 0);
}

function skipPageAyah(delta) {
  if (!currentPageAyahsData || !currentPageAyahsData.length) return;
  const newIndex = currentPlayingAyahIndex + delta;
  if (newIndex >= 0 && newIndex < currentPageAyahsData.length) {
    playPageAyahAtIndex(newIndex);
  }
}

function changePageReciter(reciterId) {
  selectedPageReciter = reciterId;
  try {
    localStorage.setItem('quran_preview_reciter', reciterId);
    localStorage.setItem('quran_preview_reciter_v2', reciterId);
  } catch (e) { }
  const reciter = PAGE_RECITERS.find(r => r.id === reciterId);
  if (typeof showToast === 'function') {
    showToast(`تم تعيين القارئ: ${reciter ? reciter.name : reciterId}`);
  }
  if (isPageAudioPlaying) {
    startPlayingCurrentPreviewPage(currentPlayingAyahIndex);
  } else {
    stopPageAudio();
  }
}

function openPagePreview(pageNum) {
  const targetPage = Math.min(604, Math.max(1, parseInt(pageNum) || 1));
  if (targetPage !== currentPreviewPage || !currentPageAyahsData) {
    stopPageAudio();
  }
  currentPreviewPage = targetPage;
  const modal = document.getElementById('pagePreviewModal');
  if (!modal) return;
  initPageReciterSelect();
  updatePagePreviewUI();
  modal.classList.remove('hidden');
  const scrollContainer = document.getElementById('previewScrollContainer');
  if (scrollContainer) scrollContainer.scrollTop = 0;
}

function closePagePreview() {
  stopPageAudio();
  const modal = document.getElementById('pagePreviewModal');
  if (modal) modal.classList.add('hidden');
}

function navigatePreviewPage(delta) {
  const newPage = currentPreviewPage + delta;
  if (newPage >= 1 && newPage <= 604) {
    const wasPlaying = isPageAudioPlaying;
    stopPageAudio();
    currentPreviewPage = newPage;
    updatePagePreviewUI();
    if (wasPlaying) {
      startPlayingCurrentPreviewPage(0);
    }
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
  const sc = document.getElementById('previewScrollContainer');
  if (sc) sc.scrollTop = 0;
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

  const studyDays = state.studyDays || 7;
  const dailyTarget = (state.goal > 0 && studyDays > 0) ? Math.max(1, Math.ceil(state.goal / studyDays)) : 1;
  const chosenReviewDaysCount = (state.reviewDays && state.reviewDays.length > 0) ? state.reviewDays.length : 7;

  let goalLine = '';
  if (state.goal > 0) {
    const weeklyRate = state.goal * (studyDays / 7);
    const daysNeeded = weeklyRate > 0 ? Math.ceil(left / (state.goal / 7)) : Infinity;
    const fin = isFinite(daysNeeded) ? addDays(t, daysNeeded).toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }) : 'غير محدد';
    goalLine = `الهدف: <b class="text-slate-800 dark:text-white">${formatStdNum(state.goal)}</b> صفحة/أسبوع (بمعدل <b class="text-emerald-700 dark:text-emerald-400">${formatStdNum(dailyTarget)}</b> صفحة/يوم) • الختم المتوقع: <b class="text-emerald-700 dark:text-emerald-400">${fin}</b>`;
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
    const isRecovered = !!(state.recoveredDates && state.recoveredDates[key]);
    const isMemorizedGoalMet = (state.goal > 0) ? (pagesLogged >= dailyTarget) : (pagesLogged > 0);

    weekMemorizedTotal += pagesLogged;
    if (isReviewDone || isRecovered) weekReviewedTotal++;

    weekDays.push({
      key,
      name: dayNames[i],
      dateNum: curDate.getDate(),
      isToday,
      isDesignatedReviewDay,
      pagesLogged,
      isReviewDone,
      isMemorizedGoalMet,
      isRecovered
    });
  }

  const isCurrentWeek = (offset === 0);
  const weekRangeLabel = `من ${formatStdNum(weekDays[0].dateNum)} إلى ${formatStdNum(weekDays[6].dateNum)} ${weekStart.toLocaleDateString('ar-EG-u-nu-latn', { month: 'short' })}`;

  const chartHtml = `
    <div id="weeklyProgressCard" class="bg-slate-50 dark:bg-slate-800/50 p-2.5 sm:p-3 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
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
          <div class="p-1.5 rounded-xl border flex flex-col items-center justify-between gap-1 transition ${d.isToday
      ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-400 dark:border-emerald-700 shadow-xs'
      : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
    }">
            <span class="text-[10px] text-slate-400 font-medium block">${d.name}</span>
            <span class="text-xs font-bold ${d.isToday ? 'text-emerald-700 dark:text-emerald-400 font-black' : 'text-slate-700 dark:text-slate-300'}">${formatStdNum(d.dateNum)}</span>
            <div class="w-full flex items-center justify-center py-0.5">
              ${d.pagesLogged > 0
      ? `<span class="inline-block px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-bold leading-tight shadow-xs">+${formatStdNum(d.pagesLogged)}</span>`
      : (d.isRecovered ? `<span class="text-[9px] text-teal-600 dark:text-teal-400 font-bold whitespace-nowrap">🛡️ مستدرك</span>` : `<span class="text-[11px] text-slate-300 dark:text-slate-600">-</span>`)
    }
            </div>
            <button onclick="toggleReviewDay('${d.key}')" title="${d.isRecovered
      ? 'يوم مستدرك تم إنقاذ سلسلته بواسطة رصيد الاستدراك 🛡️'
      : (d.isMemorizedGoalMet
        ? `تم إنجاز هدف الحفظ (${formatStdNum(d.pagesLogged)} من ${formatStdNum(dailyTarget)} صفحة)`
        : (d.isReviewDone ? 'تمت المراجعة لهذا اليوم' : (d.isToday ? 'انقر لتسجيل مراجعة هذا اليوم' : 'سجل قراءة فقط')))
    }" class="w-5 h-5 rounded-md flex items-center justify-center transition ${d.isRecovered
      ? 'bg-teal-600 text-white shadow-xs'
      : (d.isMemorizedGoalMet
        ? 'bg-emerald-600 text-white shadow-xs'
        : (d.isReviewDone
          ? 'bg-gold-500 text-white shadow-xs'
          : (d.isDesignatedReviewDay
            ? 'border border-dashed border-gold-400 text-gold-500 dark:text-gold-400 hover:bg-gold-50 dark:hover:bg-gold-950/30'
            : 'text-slate-300 dark:text-slate-600 hover:text-emerald-500 border border-slate-200 dark:border-slate-700')))
    }">
              <i data-lucide="${d.isRecovered ? 'shield-check' : 'check'}" class="w-3 h-3 stroke-[2.5]"></i>
            </button>
          </div>
        `).join('')}
      </div>

      <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800">
        <span>إجمالي حفظ الأسبوع: <b class="text-emerald-700 dark:text-emerald-400 font-bold">${formatStdNum(weekMemorizedTotal)}</b> صفحة</span>
        <span>أيام مراجعة مكتملة: <b class="text-gold-600 dark:text-gold-400 font-bold">${formatStdNum(weekReviewedTotal)}</b> من ${formatStdNum(chosenReviewDaysCount)}</span>
      </div>
    </div>
  `;

  const streak = getStreak();
  const motivator = getStreakMotivator(streak);
  const badgeTitle = motivator.current.title;
  const badgeIcon = motivator.current.icon;
  const isAutoMode = (state.recoveryMode !== 'manual');

  let manualRecoveryAlertHtml = '';
  const firstActive = typeof getFirstActiveDate === 'function' ? getFirstActiveDate() : null;
  if (!isAutoMode && firstActive && (state.recoveryDays || 0) > 0) {
    const yesterday = addDays(t, -1);
    const yesterdayKey = dayKey(yesterday);
    const isYesterdayActive = (state.log[yesterdayKey] > 0 || !!state.reviewLog[yesterdayKey] || (state.recoveredDates && !!state.recoveredDates[yesterdayKey]));
    if (yesterdayKey > firstActive && !isYesterdayActive) {
      manualRecoveryAlertHtml = `
        <div class="p-2 sm:p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between gap-2 text-xs font-sans">
          <div class="flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
            <i data-lucide="alert-circle" class="w-4 h-4 text-amber-600 shrink-0"></i>
            <span class="text-[11px] font-bold">فُوّت الورد بالأمس (${yesterdayKey})!</span>
          </div>
          <button type="button" onclick="applyManualRecovery('${yesterdayKey}')" class="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px] shadow-xs active:scale-95 flex items-center gap-1 shrink-0">
            <span>استدراك الأمس 🛡️</span>
          </button>
        </div>
      `;
    }
  }

  const streakHtml = `
    <div class="bg-gradient-to-br from-amber-500/10 via-emerald-500/5 to-teal-500/10 p-3 sm:p-3.5 rounded-2xl border-2 border-amber-500/30 dark:border-amber-400/20 space-y-2.5">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-2xl">${badgeIcon}</span>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-xs sm:text-sm font-black text-amber-900 dark:text-amber-200">${badgeTitle}</span>
              <span class="text-[10px] px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold">وسام شريف</span>
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

      <div class="flex flex-wrap items-center justify-between pt-1.5 border-t border-amber-500/20 dark:border-amber-400/10 text-xs font-sans gap-2">
        <div class="flex items-center gap-1.5">
          <span class="w-5 h-5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shadow-xs">🛡️</span>
          <span class="text-slate-700 dark:text-slate-200 font-bold">رصيد الاستدراك:</span>
          <b class="text-emerald-700 dark:text-emerald-400 font-black text-sm">${formatStdNum(state.recoveryDays || 0)}</b>
          <span class="text-[10px] text-slate-400 font-medium">يوم</span>
          <span class="text-[10px] text-amber-700 dark:text-amber-300 font-semibold mr-1">(+1 يوم لكل أسبوع كامل 7/7)</span>
        </div>

        <div class="inline-flex items-center p-0.5 rounded-xl bg-slate-200/80 dark:bg-slate-800 border border-slate-300/60 dark:border-slate-700 text-[10px] font-bold">
          <button type="button" onclick="setRecoveryMode('auto')" class="px-2 py-0.5 rounded-lg transition ${isAutoMode ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}" title="استهلاك رصيد الاستدراك تلقائياً عند فوات يوم">
            ⚡ تلقائي
          </button>
          <button type="button" onclick="setRecoveryMode('manual')" class="px-2 py-0.5 rounded-lg transition ${!isAutoMode ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}" title="أنت تقرر متى تستخدم رصيد الاستدراك يدوياً">
            🖐️ يدوي
          </button>
        </div>
      </div>

      ${manualRecoveryAlertHtml}

      <div class="pt-1 border-t border-amber-500/20 dark:border-amber-400/10 space-y-1">
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
        <div class="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
          الهدف اليومي: <b class="font-bold">${formatStdNum(dailyTarget)}</b> صفحة
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-1.5 text-xs pt-1">
        <span class="text-slate-500 ml-1">أيام المراجعة المخصصة (${formatStdNum(chosenReviewDaysCount)}):</span>
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

  lucide.createIcons();
}

// ==========================================
// SMART DAILY REVIEW WARD (الورد اليومي الذكي)
// ==========================================
let isReviewedTodayExpanded = false;

function toggleReviewedTodayExpand() {
  isReviewedTodayExpanded = !isReviewedTodayExpanded;
  renderDailyWard();
}

function renderDailyWard() {
  const container = document.getElementById('dailyWardCard');
  if (!container) return;

  const memorizedCount = Object.keys(state.memorizedSurahs || {}).length;
  if (memorizedCount === 0) {
    container.innerHTML = `
      <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm text-right font-sans">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <i data-lucide="book-open-check" class="w-5 h-5"></i>
          </div>
          <div class="space-y-0.5 flex-1">
            <h3 class="font-bold text-slate-900 dark:text-white text-sm sm:text-base">الورد اليومي الذكي للمراجعة</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              ابدأ بتحديد السور التي تحفظها في تبويب <b>«حسب السور»</b> أو الصفحات، ليقوم النظام الذكي بجدولة ورد مراجعتك اليومي تلقائياً وفق خوارزمية التكرار المتباعد لمنع التفلت.
            </p>
          </div>
        </div>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  const { due, reviewedToday, totalDueCount, reviewedTodayCount, isAllDone } = getDueReviewSurahs();
  const totalTargetToday = totalDueCount + reviewedTodayCount;
  const progressPercent = totalTargetToday > 0 ? Math.round((reviewedTodayCount / totalTargetToday) * 100) : 100;

  let contentHtml = '';

  if (isAllDone && totalDueCount === 0) {
    contentHtml = `
      <div class="space-y-3 font-sans">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-500/20">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <i data-lucide="award" class="w-5 h-5"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-bold text-slate-900 dark:text-white text-sm sm:text-base">الورد اليومي الذكي للمراجعة</h3>
                <span class="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">مكتمل 100% ✓</span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400">أتممت مراجعة جميع السور المستحقة في ورد اليوم بنجاح</p>
            </div>
          </div>
          <button type="button" onclick="switchMode('tamkeen')"
            class="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition active:scale-95 flex items-center gap-1.5">
            <i data-lucide="brain" class="w-3.5 h-3.5"></i>
            <span>اختبر حفظك في تمكين</span>
          </button>
        </div>

        <div class="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div class="flex items-center gap-2">
            <i data-lucide="sparkle" class="w-4 h-4 text-emerald-600 shrink-0"></i>
            <span class="text-xs font-bold text-emerald-900 dark:text-emerald-200">
              هنيئاً لك! لا توجد سور مستحقة للمراجعة حالياً. حافظت على عهد القرآن وتثبيت آياته اليوم.
            </span>
          </div>
          ${reviewedTodayCount > 0 ? `
            <button type="button" onclick="toggleReviewedTodayExpand()" class="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-1 shrink-0">
              <span>عرض ما روجع اليوم (${formatStdNum(reviewedTodayCount)})</span>
              <i data-lucide="${isReviewedTodayExpanded ? 'chevron-up' : 'chevron-down'}" class="w-3.5 h-3.5"></i>
            </button>
          ` : ''}
        </div>

        ${isReviewedTodayExpanded && reviewedTodayCount > 0 ? `
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
            ${reviewedToday.map(s => `
              <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                <div>
                  <span class="font-bold text-slate-800 dark:text-slate-100">سورة ${s.name}</span>
                  <span class="text-[10px] text-slate-400 block">${s.totalVerses} آية</span>
                </div>
                <span class="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">تمت ✓</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  } else {
    // Due surahs exist!
    const dueItemsHtml = due.map(s => {
      let intervalBadge = '';
      if (s.interval <= 4) {
        intervalBadge = `<span class="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-bold text-[10px] border border-rose-300/60 dark:border-rose-800 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>كل 4 أيام (تثبيت مكثف)</span>`;
      } else if (s.interval <= 14) {
        intervalBadge = `<span class="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-bold text-[10px] border border-amber-300/60 dark:border-amber-800 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>كل 14 يوم (متوسط)</span>`;
      } else {
        intervalBadge = `<span class="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] border border-emerald-300/60 dark:border-emerald-800 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>كل 28 يوم (إتقان تام)</span>`;
      }

      const overdueText = s.overdueDays === 999 
        ? 'لم تراجع مسبقاً' 
        : (s.overdueDays > 0 ? `متأخرة ${formatStdNum(s.overdueDays)} يوم` : 'مستحقة اليوم');

      return `
        <div class="p-3 sm:p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 hover:bg-slate-100/80 dark:hover:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-start sm:items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-500/20 font-mono">
              ${formatStdNum(s.id)}
            </div>
            <div class="space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-bold text-slate-900 dark:text-white text-sm sm:text-base">سورة ${s.name}</span>
                <span class="text-[11px] text-slate-500 dark:text-slate-400 font-medium">(${formatStdNum(s.totalVerses)} آية • ص ${formatStdNum(s.startPage)})</span>
                ${intervalBadge}
              </div>
              <div class="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span class="font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  <i data-lucide="clock" class="w-3 h-3"></i>
                  ${overdueText}
                </span>
                ${s.lastReview ? `<span class="text-slate-400">• آخر مراجعة: ${s.lastReview}</span>` : ''}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button type="button" onclick="openPagePreview(${s.startPage})"
              class="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition active:scale-95 flex items-center gap-1"
              title="تصفح السورة في المصحف الشريف">
              <i data-lucide="book-open" class="w-3.5 h-3.5"></i>
              <span class="hidden sm:inline">المصحف</span>
            </button>
            <button type="button" onclick="rateSurahReview(${s.id}, ${s.interval}, 'متقن')"
              class="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center gap-1.5">
              <i data-lucide="check" class="w-3.5 h-3.5"></i>
              <span>تمت المراجعة ✓</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    contentHtml = `
      <div class="space-y-3.5 font-sans">
        <!-- Top bar with progress and bulk action -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <i data-lucide="calendar" class="w-5 h-5"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-bold text-slate-900 dark:text-white text-sm sm:text-base">الورد اليومي الذكي للمراجعة</h3>
                <span class="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-[11px] font-bold">
                  متبقي ${formatStdNum(totalDueCount)} سورة
                </span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                مرتبة حسب الأولوية وفترات التكرار المتباعد لتثبيت الحفظ في الصدور
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button type="button" onclick="bulkMarkAllDueReviewed()"
              class="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-800 hover:to-emerald-900 text-white font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-1.5"
              title="تحديد مراجعة جميع سور الورد اليوم">
              <i data-lucide="check-check" class="w-4 h-4"></i>
              <span>تمت مراجعة كل الورد اليوم ✓</span>
            </button>
          </div>
        </div>

        <!-- Progress bar -->
        <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
          <div class="flex items-center justify-between text-xs font-bold">
            <span class="text-slate-700 dark:text-slate-300">
              إنجاز ورد اليوم: <b class="text-emerald-700 dark:text-emerald-400">${formatStdNum(reviewedTodayCount)}</b> من <b class="text-slate-900 dark:text-white">${formatStdNum(totalTargetToday)}</b> سورة
            </span>
            <span class="text-emerald-700 dark:text-emerald-400 font-mono">${formatStdNum(progressPercent)}%</span>
          </div>
          <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
            <div class="bg-gradient-to-r from-emerald-600 to-gold-500 h-2.5 rounded-full transition-all duration-500" style="width: ${progressPercent}%"></div>
          </div>
        </div>

        <!-- Due List -->
        <div class="space-y-2">
          ${dueItemsHtml}
        </div>

        <!-- Bottom toggle for already reviewed today -->
        ${reviewedTodayCount > 0 ? `
          <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button type="button" onclick="toggleReviewedTodayExpand()" class="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1">
              <span>سور راجعتها اليوم (${formatStdNum(reviewedTodayCount)})</span>
              <i data-lucide="${isReviewedTodayExpanded ? 'chevron-up' : 'chevron-down'}" class="w-3.5 h-3.5"></i>
            </button>
            <span class="text-[11px] text-slate-400">تقبل الله طاعتك</span>
          </div>

          ${isReviewedTodayExpanded ? `
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
              ${reviewedToday.map(s => `
                <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                  <div>
                    <span class="font-bold text-slate-800 dark:text-slate-100">سورة ${s.name}</span>
                    <span class="text-[10px] text-slate-400 block">${s.totalVerses} آية</span>
                  </div>
                  <span class="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">تمت ✓</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        ` : ''}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="rounded-3xl bg-white dark:bg-slate-900 border border-emerald-900/10 dark:border-emerald-500/15 p-4 sm:p-5 shadow-sm text-right font-sans transition-all">
      ${contentHtml}
    </div>
  `;

  lucide.createIcons();
}

// ==========================================
// LOCAL NOTIFICATIONS & REMINDERS (المنبه والتذكيرات)
// ==========================================
function updateReminderUI() {
  const dot = document.getElementById('reminderActiveDot');
  const isEnabled = state.reminderSettings && state.reminderSettings.enabled;
  if (dot) {
    if (isEnabled) dot.classList.remove('hidden');
    else dot.classList.add('hidden');
  }

  const chk = document.getElementById('chkReminderEnabled');
  const timeInput = document.getElementById('reminderTimeInput');
  if (chk && state.reminderSettings) chk.checked = !!state.reminderSettings.enabled;
  if (timeInput && state.reminderSettings && state.reminderSettings.time) {
    timeInput.value = state.reminderSettings.time;
  }

  updateReminderPermissionBox();
}

function updateReminderPermissionBox() {
  const box = document.getElementById('reminderPermissionBox');
  const text = document.getElementById('reminderPermStatusText');
  const btn = document.getElementById('btnRequestNotificationPerm');
  if (!box || !text || !btn) return;

  if (!('Notification' in window)) {
    text.textContent = "متصفحك لا يدعم إشعارات الويب المحلية.";
    btn.classList.add('hidden');
    box.className = "p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300";
    return;
  }

  if (Notification.permission === 'granted') {
    text.textContent = "إذن الإشعارات مفعل ومصرح به في المتصفح ✓";
    btn.classList.add('hidden');
    box.className = "p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between";
  } else if (Notification.permission === 'denied') {
    text.textContent = "تم حظر الإشعارات في إعدادات المتصفح، يرجى تفعيلها يدوياً لتلقي التنبيهات.";
    btn.classList.add('hidden');
    box.className = "p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300";
  } else {
    text.textContent = "إذن إشعارات المتصفح مطلوب لتشغيل المنبه اليومي";
    btn.classList.remove('hidden');
    box.className = "p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2";
  }
}

function openRemindersModal() {
  const modal = document.getElementById('remindersModal');
  if (!modal) return;
  updateReminderUI();
  modal.classList.remove('hidden');
}

function closeRemindersModal() {
  const modal = document.getElementById('remindersModal');
  if (modal) modal.classList.add('hidden');
}

function setQuickReminderTime(timeStr) {
  const timeInput = document.getElementById('reminderTimeInput');
  if (timeInput) {
    timeInput.value = timeStr;
    showToast(`تم اختيار التوقيت: ${timeStr}`);
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast("متصفحك لا يدعم إشعارات الويب");
    return;
  }
  try {
    const res = await Notification.requestPermission();
    updateReminderPermissionBox();
    if (res === 'granted') {
      showToast("تم منح إذن الإشعارات بنجاح! ✨");
    } else if (res === 'denied') {
      showToast("تم رفض الإذن، يمكنك تفعيله من إعدادات المتصفح");
    }
  } catch (e) {
    console.error("Permission request error:", e);
  }
}

function saveReminderSettingsFromModal() {
  const chk = document.getElementById('chkReminderEnabled');
  const timeInput = document.getElementById('reminderTimeInput');
  if (!state.reminderSettings) state.reminderSettings = { enabled: false, time: '09:00', lastNotifiedDate: null };

  state.reminderSettings.enabled = chk ? chk.checked : false;
  state.reminderSettings.time = timeInput ? timeInput.value : '09:00';

  if (state.reminderSettings.enabled && 'Notification' in window && Notification.permission === 'default') {
    requestNotificationPermission();
  }

  saveState();
  updateReminderUI();
  closeRemindersModal();
  showToast(state.reminderSettings.enabled 
    ? `تم ضبط التذكير اليومي في تمام الساعة ${state.reminderSettings.time} بنجاح 🔔` 
    : "تم تعطيل التذكير اليومي");
}

function sendLocalNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const options = {
    body,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    tag: 'quran-ward-reminder'
  };

  try {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, options);
      }).catch(() => {
        new Notification(title, options);
      });
    } else {
      new Notification(title, options);
    }
  } catch (e) {
    console.warn("Notification trigger failed:", e);
  }
}

function testNotificationNow() {
  if (!('Notification' in window)) {
    showToast("متصفحك لا يدعم إشعارات الويب");
    return;
  }

  if (Notification.permission !== 'granted') {
    requestNotificationPermission().then(() => {
      if (Notification.permission === 'granted') {
        sendLocalNotification("إتقان | تذكير تجريبي 🔔", "هذا إشعار تجريبي من تطبيق إرتَقِ بالقرآن لتأكيد عمل منبه الورد بنجاح.");
        showToast("تم إرسال الإشعار التجريبي!");
      } else {
        showToast("يرجى منح إذن الإشعارات أولاً لتجربة الإشعار");
      }
    });
  } else {
    sendLocalNotification("إتقان | تذكير تجريبي 🔔", "هذا إشعار تجريبي من تطبيق إرتَقِ بالقرآن لتأكيد عمل منبه الورد بنجاح.");
    showToast("تم إرسال الإشعار التجريبي!");
  }
}

function checkDailyReminder() {
  if (!state.reminderSettings || !state.reminderSettings.enabled) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const today = todayStr();
  if (state.reminderSettings.lastNotifiedDate === today) return;

  const now = new Date();
  const currentHHMM = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const targetTime = state.reminderSettings.time || '09:00';

  if (currentHHMM >= targetTime) {
    const { totalDueCount } = getDueReviewSurahs();
    let title = "إرتَقِ بالقرآن | تذكير الورد اليومي 📖";
    let body = totalDueCount > 0
      ? `لديك اليوم ${formatStdNum(totalDueCount)} سورة في ورد المراجعة بانتظارك. بارك الله في وقتك وحفظك!`
      : "حان موعد وردك اليومي من القرآن الكريم! ادخل لاختبار حفظك أو تثبيت جديدك ✨";

    sendLocalNotification(title, body);
    state.reminderSettings.lastNotifiedDate = today;
    saveState();
  }
}

// ==========================================
// MISTAKES NOTEBOOK (دفتر التثبيت وسجل الأخطاء)
// ==========================================
function updateMistakesBadge() {
  const count = (state.mistakesNotebook && state.mistakesNotebook.length) || 0;
  
  const headerBadge = document.getElementById('headerMistakesCount');
  if (headerBadge) {
    headerBadge.textContent = formatStdNum(count);
    if (count > 0) {
      headerBadge.classList.remove('hidden');
      headerBadge.classList.add('flex');
    } else {
      headerBadge.classList.add('hidden');
      headerBadge.classList.remove('flex');
    }
  }

  const tamkeenBadge = document.getElementById('tamkeenMistakesBadge');
  if (tamkeenBadge) {
    tamkeenBadge.textContent = formatStdNum(count);
    if (count > 0) tamkeenBadge.classList.remove('hidden');
    else tamkeenBadge.classList.add('hidden');
  }

  const modalBadge = document.getElementById('mistakesModalCountBadge');
  if (modalBadge) {
    modalBadge.textContent = count > 0 ? `${formatStdNum(count)} آية` : '0 آية';
  }
}

function openMistakesModal() {
  const modal = document.getElementById('mistakesModal');
  if (!modal) return;
  renderMistakesNotebook();
  updateMistakesBadge();
  modal.classList.remove('hidden');
}

function closeMistakesModal() {
  const modal = document.getElementById('mistakesModal');
  if (modal) modal.classList.add('hidden');
}

function renderMistakesNotebook() {
  const container = document.getElementById('mistakesListContainer');
  if (!container) return;

  const mistakes = state.mistakesNotebook || [];
  updateMistakesBadge();

  if (mistakes.length === 0) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-center p-8 space-y-3 font-sans">
        <div class="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
          <i data-lucide="book-open-check" class="w-7 h-7"></i>
        </div>
        <div class="space-y-1">
          <h4 class="font-bold text-slate-900 dark:text-white text-base">ما شاء الله تبارك الله!</h4>
          <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
            دفتر التثبيت خالٍ تماماً من الأخطاء. يتم تسجيل أي آية تخطئ فيها تلقائياً أثناء اختبارات تمكين لتثبيتها وإتقانها لاحقاً.
          </p>
        </div>
        <button type="button" onclick="closeMistakesModal(); switchMode('tamkeen');"
          class="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-1.5">
          <i data-lucide="brain" class="w-4 h-4"></i>
          <span>ابدأ اختبار تمكين الآن</span>
        </button>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = mistakes.map((m) => `
    <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3 font-sans transition hover:border-slate-300 dark:hover:border-slate-600">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 text-xs font-bold border border-emerald-300/60 dark:border-emerald-800">
            سورة ${m.surahName || ('رقم ' + m.surahId)}
          </span>
          <span class="px-2 py-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono font-bold">
            آية ${formatStdNum(m.ayahNum)}
          </span>
          ${(m.count && m.count > 1) ? `
            <span class="px-2 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
              تكرر ${formatStdNum(m.count)} مرات
            </span>
          ` : ''}
        </div>
        <span class="text-[10px] text-slate-400 font-medium">${m.date || ''}</span>
      </div>

      <!-- Ayah text in authentic Amiri Quran font -->
      <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 text-right">
        <p class="font-quran text-base sm:text-lg text-emerald-950 dark:text-emerald-100 leading-loose" dir="rtl">
          ﴿&nbsp;${m.verse}&nbsp;﴾
        </p>
      </div>

      <!-- Correction comparison -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div class="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 space-y-0.5">
          <span class="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block">الإجابة الصحيحة:</span>
          <p class="font-bold font-quran text-sm">«${m.correct}»</p>
        </div>
        <div class="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 text-rose-900 dark:text-rose-200 space-y-0.5">
          <span class="text-[10px] font-bold text-rose-700 dark:text-rose-400 block">إجابتك السابقة:</span>
          <p class="font-medium font-quran text-sm line-through decoration-rose-500">«${m.wrongChoice || 'إجابة غير صحيحة'}»</p>
        </div>
      </div>

      <!-- Item actions -->
      <div class="flex items-center justify-between pt-1 gap-2">
        <button type="button" onclick="launchMistakeRetest('${m.id}')"
          class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center gap-1.5">
          <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
          <span>إعادة الاختبار الآن</span>
        </button>
        <button type="button" onclick="removeMistakeFromNotebook('${m.id}')"
          class="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center gap-1.5">
          <i data-lucide="check" class="w-3.5 h-3.5"></i>
          <span>تم الإتقان والتثبيت ✓</span>
        </button>
      </div>
    </div>
  `).join('');

  lucide.createIcons();
}

function confirmClearMistakesNotebook() {
  if (!state.mistakesNotebook || state.mistakesNotebook.length === 0) {
    showToast("دفتر التثبيت فارغ بالفعل");
    return;
  }
  if (confirm("هل أنت متأكد من رغبتك في تفريغ دفتر التثبيت وسجل الأخطاء بالكامل؟")) {
    clearMistakesNotebook();
  }
}

function launchMistakeRetest(mistakeId) {
  const m = (state.mistakesNotebook || []).find(x => x.id === mistakeId);
  if (!m) return;
  closeMistakesModal();
  switchMode('tamkeen');
  
  // Custom single question retest targeting this exact ayah
  tamkeenState.currentQuestion = {
    surahId: m.surahId,
    surahName: m.surahName,
    ayahNum: m.ayahNum,
    verse: m.verse,
    correct: m.correct,
    mode: m.mode || 'next_ayah',
    options: [
      m.correct,
      m.wrongChoice || 'إجابة بديلة',
      'خيار تدريبي آخر'
    ].sort(() => 0.5 - Math.random()),
    answered: false,
    selectedIdx: null,
    isCorrect: null
  };
  tamkeenState.stats.totalQuestions++;
  renderTamkeenQuiz();
  showToast(`جاري اختبار تثبيت الآية (${formatStdNum(m.ayahNum)}) من سورة ${m.surahName} 🎯`);
}

function updateMobileNavBadges() {
  const surahBtn = document.getElementById('mobileTabSurah');
  if (!surahBtn) return;
  let badge = document.getElementById('mobileDueReviewBadge');
  const { totalDueCount } = (typeof getDueReviewSurahs === 'function') ? getDueReviewSurahs() : { totalDueCount: 0 };
  if (totalDueCount > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'mobileDueReviewBadge';
      badge.className = 'absolute top-1 right-2 px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[9px] font-bold font-mono leading-none shadow-xs';
      surahBtn.classList.add('relative');
      surahBtn.appendChild(badge);
    }
    badge.textContent = formatStdNum(totalDueCount);
    badge.classList.remove('hidden');
  } else if (badge) {
    badge.classList.add('hidden');
  }
}

function renderAll() {
  updateMetrics();
  renderPlanner();
  renderDailyWard();
  updateMistakesBadge();
  updateReminderUI();
  updateMobileNavBadges();
  if (state.activeView === 'surah') renderSurahs();
  else if (state.activeView === 'page') renderPages();
  else if (state.activeView === 'tamkeen') renderTamkeenQuiz();
  else renderJuz();
}

// ==========================================
// NAVIGATION & MODE SWITCHER
// ==========================================
function switchMode(mode, shouldScroll = true) {
  if (typeof triggerHaptic === 'function') triggerHaptic('light');
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

  const activeClasses = ['bg-white', 'dark:bg-slate-900', 'text-emerald-800', 'dark:text-emerald-300', 'shadow-sm', 'font-bold'];
  const inactiveClasses = ['text-slate-600', 'dark:text-slate-400', 'font-semibold'];

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

  if (shouldScroll) {
    const targetSection = (mode === 'surah') ? viewSurahs : (mode === 'page') ? viewPages : (mode === 'juz') ? viewJuz : viewTamkeen;
    if (targetSection) {
      const header = document.querySelector('header');
      const headerHeight = header ? header.offsetHeight : 64;
      const elementPosition = targetSection.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - headerHeight - 14;
      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: 'smooth'
      });
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
  const btnBannerInstall = document.getElementById('btnBannerInstall');
  const btnDismissInstallBanner = document.getElementById('btnDismissInstallBanner');

  if (btnInstall) {
    btnInstall.addEventListener('click', () => {
      if (isAppInstalled()) {
        showToast("التطبيق مثبت بالفعل على جهازك ويعمل دون اتصال!");
      } else {
        triggerInstallFlow();
      }
    });
  }

  if (btnBannerInstall) {
    btnBannerInstall.addEventListener('click', () => {
      triggerInstallFlow();
    });
  }

  if (btnDismissInstallBanner) {
    btnDismissInstallBanner.addEventListener('click', () => {
      sessionStorage.setItem('dismiss_install_banner', 'true');
      const banner = document.getElementById('installReminderBanner');
      if (banner) banner.classList.add('hidden');
    });
  }

  if (btnCloseInstall) btnCloseInstall.addEventListener('click', () => installModal.classList.add('hidden'));
  if (btnDismissInstall) btnDismissInstall.addEventListener('click', () => installModal.classList.add('hidden'));

  updateInstallUI();

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

  if (tabSurah) tabSurah.addEventListener('click', () => switchMode('surah', true));
  if (tabPage) tabPage.addEventListener('click', () => switchMode('page', true));
  if (tabJuz) tabJuz.addEventListener('click', () => switchMode('juz', true));
  if (tabTamkeen) tabTamkeen.addEventListener('click', () => switchMode('tamkeen', true));

  const mobileTabs = {
    surah: document.getElementById('mobileTabSurah'),
    page: document.getElementById('mobileTabPage'),
    juz: document.getElementById('mobileTabJuz'),
    tamkeen: document.getElementById('mobileTabTamkeen'),
  };

  if (mobileTabs.surah) mobileTabs.surah.addEventListener('click', () => switchMode('surah', true));
  if (mobileTabs.page) mobileTabs.page.addEventListener('click', () => switchMode('page', true));
  if (mobileTabs.juz) mobileTabs.juz.addEventListener('click', () => switchMode('juz', true));
  if (mobileTabs.tamkeen) mobileTabs.tamkeen.addEventListener('click', () => switchMode('tamkeen', true));

  // Ensure active mode is applied on init without auto-scrolling
  switchMode(state.activeView || 'surah', false);

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
      // 1. Reset all state properties completely as if accessing for the very first time
      state.memorizedPages = {};
      state.memorizedSurahs = {};
      state.reviews = {};
      state.log = {};
      state.goal = 0;
      state.studyDays = 7;
      state.reviewDays = [];
      state.reviewLog = {};
      state.surahIntervals = {};
      state.userName = '';
      state.ayahs = {};
      state.lastCount = null;
      state.autoSync = true;
      state.currentFilter = 'all';
      state.searchQuery = '';
      state.weekOffset = 0;
      state.recoveryDays = 1;
      state.recoveredDates = {};
      state.recoveryMode = 'auto';
      state.lastAwardedMilestone = 0;
      state.reminderSettings = { enabled: false, time: '20:00', lastNotifiedDate: '' };
      state.mistakesNotebook = [];
      state.dailyWardCompleted = {};

      // 2. Reset Tamkeen stats and session questions
      if (typeof tamkeenState !== 'undefined') {
        tamkeenState.stats = { total: 0, correct: 0, streak: 0, bestStreak: 0 };
        tamkeenState.currentQuestion = null;
        tamkeenState.isAnswered = false;
        tamkeenState.history = [];
      }
      if (typeof saveTamkeenStats === 'function') saveTamkeenStats();
      if (typeof updateTamkeenStatsUI === 'function') updateTamkeenStatsUI();

      // 3. Clear LocalStorage and SessionStorage completely for this user
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('quran_tracker_tamkeen_stats');
        localStorage.removeItem('itqan_tutorial_seen');
        sessionStorage.removeItem('dismiss_tutorial_prompt');
        Object.keys(localStorage).forEach(k => {
          if (k.startsWith('tamkeen_surah_')) {
            localStorage.removeItem(k);
          }
        });
      } catch (e) {
        console.error("خطأ أثناء تصفير التخزين:", e);
      }

      // 4. Reset form inputs
      const studentInput = document.getElementById('studentNameInput');
      if (studentInput) studentInput.value = '';

      const searchInput = document.getElementById('searchSurah');
      if (searchInput) searchInput.value = '';

      const filterSelect = document.getElementById('filterStatusSelect');
      if (filterSelect) filterSelect.value = 'all';

      const reminderTimeInput = document.getElementById('reminderTimeInput');
      if (reminderTimeInput) reminderTimeInput.value = '20:00';

      const reminderToggle = document.getElementById('reminderToggle');
      if (reminderToggle) reminderToggle.checked = false;

      // 5. Save clean state and refresh UI
      syncCount();
      saveState();
      switchMode('surah', false);
      renderAll();

      if (typeof renderMistakesNotebook === 'function') renderMistakesNotebook();
      if (typeof updateMistakesBadge === 'function') updateMistakesBadge();
      if (typeof updateStudentNameDisplay === 'function') updateStudentNameDisplay();
      if (typeof checkNewUserTutorial === 'function') checkNewUserTutorial();

      resetModal.classList.add('hidden');
      showToast("تم تصفير جميع البيانات بنجاح والبدء من جديد كأول مرة!");
    });
  }

  const backupModal = document.getElementById('backupModal');
  const jsonTextarea = document.getElementById('jsonStateTextarea');
  const btnBackup = document.getElementById('btnBackupModal');
  const btnBackupCard = document.getElementById('btnBackupCard');
  const btnCloseBackup = document.getElementById('btnCloseBackupModal');
  const btnExportJson = document.getElementById('btnExportJsonFile');
  const btnCopyJson = document.getElementById('btnCopyJsonText');
  const importInput = document.getElementById('importJsonFileInput');

  const openBackupModal = () => {
    if (!backupModal || !jsonTextarea) return;
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
      recoveryDays: state.recoveryDays || 0,
      recoveredDates: state.recoveredDates || {},
      lastAwardedMilestone: state.lastAwardedMilestone || 0,
      recoveryMode: state.recoveryMode || 'auto',
      mistakesNotebook: state.mistakesNotebook || [],
      dailyWardCompleted: state.dailyWardCompleted || {},
      reminderSettings: state.reminderSettings || { enabled: false, time: '20:00', lastNotifiedDate: null },
      exportedAt: new Date().toISOString()
    }, null, 2);
    backupModal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  };

  if (btnBackup) btnBackup.addEventListener('click', openBackupModal);
  if (btnBackupCard) btnBackupCard.addEventListener('click', openBackupModal);

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
        recoveryDays: state.recoveryDays || 0,
        recoveredDates: state.recoveredDates || {},
        recoveryMode: state.recoveryMode || 'auto',
        lastAwardedMilestone: state.lastAwardedMilestone || 0,
        mistakesNotebook: state.mistakesNotebook || [],
        reminderSettings: state.reminderSettings || { enabled: false, time: '09:00', lastNotifiedDate: null },
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
            state.recoveryDays = typeof parsed.recoveryDays === 'number' ? parsed.recoveryDays : 1;
            state.recoveredDates = parsed.recoveredDates || {};
            state.recoveryMode = parsed.recoveryMode === 'manual' ? 'manual' : 'auto';
            state.lastAwardedMilestone = typeof parsed.lastAwardedMilestone === 'number' ? parsed.lastAwardedMilestone : 0;
            state.mistakesNotebook = Array.isArray(parsed.mistakesNotebook) ? parsed.mistakesNotebook : (state.mistakesNotebook || []);
            if (parsed.reminderSettings) state.reminderSettings = parsed.reminderSettings;
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
  let currentTheme = 'light';
  try {
    currentTheme = localStorage.getItem('quran_tracker_theme') || 'light';
  } catch (e) { }

  function applyAppTheme(theme) {
    document.documentElement.classList.remove('dark', 'sepia-mode');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'sepia') {
      document.documentElement.classList.add('sepia-mode');
    }
    currentTheme = theme;
    try { localStorage.setItem('quran_tracker_theme', theme); } catch (e) { }

    if (themeBtn) {
      if (theme === 'dark') {
        themeBtn.title = 'النمط الحالي: ليلي داكن (انقر للتبديل للنهاري)';
        themeBtn.innerHTML = '<i data-lucide="sun" class="w-4 h-4 text-gold-400"></i>';
      } else if (theme === 'sepia') {
        themeBtn.title = 'النمط الحالي: مصحفي دافئ 📜 (انقر للتبديل للداكن)';
        themeBtn.innerHTML = '<i data-lucide="moon" class="w-4 h-4 text-amber-700"></i>';
      } else {
        themeBtn.title = 'النمط الحالي: نهاري فاتح ☀️ (انقر للتبديل للمصحفي الدافئ)';
        themeBtn.innerHTML = '<i data-lucide="palette" class="w-4 h-4 text-emerald-700"></i>';
      }
      if (window.lucide) lucide.createIcons();
    }
  }

  applyAppTheme(currentTheme);

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      if (typeof triggerHaptic === 'function') triggerHaptic('light');
      let nextTheme = 'light';
      if (currentTheme === 'light') nextTheme = 'sepia';
      else if (currentTheme === 'sepia') nextTheme = 'dark';
      else nextTheme = 'light';
      applyAppTheme(nextTheme);
      const themeNames = { light: 'النهاري الفاتح ☀️', sepia: 'المصحفي الدافئ 📜', dark: 'الليلي الداكن 🌙' };
      if (typeof showToast === 'function') showToast(`تم التبديل إلى نمط ${themeNames[nextTheme]}`);
    });
  }

  const btnHeaderScrollTop = document.getElementById('btnHeaderScrollTop');
  if (btnHeaderScrollTop) {
    btnHeaderScrollTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    btnHeaderScrollTop.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
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

  // Coach Marks Spotlight & Popover event listeners
  const btnStartTutorialFromBanner = document.getElementById('btnStartTutorialFromBanner');
  const btnDismissTutorialBanner = document.getElementById('btnDismissTutorialBanner');
  const btnLaunchTutorialFromAbout = document.getElementById('btnLaunchTutorialFromAbout');
  const btnCoachMarksSkip = document.getElementById('btnCoachMarksSkip');
  const btnCoachMarksPrev = document.getElementById('btnCoachMarksPrev');
  const btnCoachMarksNext = document.getElementById('btnCoachMarksNext');
  const coachMarksBackdrop = document.getElementById('coachMarksBackdrop');

  if (btnStartTutorialFromBanner) {
    btnStartTutorialFromBanner.addEventListener('click', () => startCoachMarksTour(0));
  }
  if (btnDismissTutorialBanner) {
    btnDismissTutorialBanner.addEventListener('click', () => {
      sessionStorage.setItem('dismiss_tutorial_prompt', 'true');
      const reminder = document.getElementById('newUserTutorialReminder');
      if (reminder) reminder.classList.add('hidden');
    });
  }
  if (btnLaunchTutorialFromAbout) {
    btnLaunchTutorialFromAbout.addEventListener('click', () => {
      if (aboutModal) aboutModal.classList.add('hidden');
      startCoachMarksTour(0);
    });
  }
  if (btnCoachMarksSkip) {
    btnCoachMarksSkip.addEventListener('click', () => stopCoachMarksTour(true));
  }
  if (coachMarksBackdrop) {
    coachMarksBackdrop.addEventListener('click', () => stopCoachMarksTour(false));
  }
  if (btnCoachMarksPrev) {
    btnCoachMarksPrev.addEventListener('click', () => {
      if (currentCoachStep > 0) {
        currentCoachStep--;
        renderCoachStep();
      }
    });
  }
  if (btnCoachMarksNext) {
    btnCoachMarksNext.addEventListener('click', () => {
      if (currentCoachStep < COACH_MARKS_STEPS.length - 1) {
        currentCoachStep++;
        renderCoachStep();
      } else {
        stopCoachMarksTour(true);
        showToast("جولة موفقة! نسأل الله لك التوفيق والبركة في حفظ كتابه الكريم ✨");
      }
    });
  }

  checkNewUserTutorial();

  // Mistakes Notebook Modal wiring
  const btnHeaderMistakes = document.getElementById('btnHeaderMistakes');
  const btnCloseMistakesModal = document.getElementById('btnCloseMistakesModal');
  const mistakesModal = document.getElementById('mistakesModal');

  if (btnHeaderMistakes) {
    btnHeaderMistakes.addEventListener('click', () => openMistakesModal());
  }
  if (btnCloseMistakesModal) {
    btnCloseMistakesModal.addEventListener('click', () => closeMistakesModal());
  }

  // Reminders Modal wiring
  const btnRemindersModal = document.getElementById('btnRemindersModal');
  const btnCloseRemindersModal = document.getElementById('btnCloseRemindersModal');
  const remindersModal = document.getElementById('remindersModal');

  if (btnRemindersModal) {
    btnRemindersModal.addEventListener('click', () => openRemindersModal());
  }
  if (btnCloseRemindersModal) {
    btnCloseRemindersModal.addEventListener('click', () => closeRemindersModal());
  }

  // Initial check and periodic polling for daily reminder
  checkDailyReminder();
  setInterval(checkDailyReminder, 60000);
  initPageReciterSelect();

  const resetTamkeenModal = document.getElementById('resetTamkeenConfirmModal');

  window.addEventListener('click', (e) => {
    if (e.target === backupModal) backupModal.classList.add('hidden');
    if (e.target === achievementModal) achievementModal.classList.add('hidden');
    if (e.target === installModal) installModal.classList.add('hidden');
    if (e.target === aboutModal) aboutModal.classList.add('hidden');
    if (e.target === resetTamkeenModal) closeResetTamkeenModal();
    if (e.target === mistakesModal) closeMistakesModal();
    if (e.target === remindersModal) closeRemindersModal();
    const previewModal = document.getElementById('pagePreviewModal');
    if (previewModal && e.target === previewModal) closePagePreview();
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
