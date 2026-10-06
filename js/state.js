/**
 * State Management & User Progress Persistence
 * Handles LocalStorage, streaks, spaced repetition intervals, metrics calculations
 */

const STORAGE_KEY = "quran_hifz_tracker_state_v5";
const REVIEW_DAYS = 14;

let state = {
  memorizedPages: {},
  memorizedSurahs: {},
  reviews: {},
  log: {},
  goal: 0,
  studyDays: 7,
  reviewDays: [],
  reviewLog: {},
  surahIntervals: {},
  userName: '',
  ayahs: {},
  lastCount: null,
  autoSync: true,
  currentFilter: 'all',
  searchQuery: '',
  activeView: 'surah',
  weekOffset: 0,
  recoveryDays: 0,
  recoveredDates: {},
  lastAwardedMilestone: 0
};

function normAr(str) {
  return String(str)
    .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    .replace(/\u0629/g, '\u0647')
    .replace(/\u0649/g, '\u064A')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function formatStdNum(num) {
  return Number(num).toLocaleString('en-US');
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      state.memorizedPages = parsed.memorizedPages || {};
      state.memorizedSurahs = parsed.memorizedSurahs || {};
      state.reviews = parsed.reviews || {};
      state.log = parsed.log || {};
      state.goal = parseInt(parsed.goal) || 0;
      state.studyDays = Math.min(7, Math.max(1, parseInt(parsed.studyDays) || 7));
      state.ayahs = parsed.ayahs || {};
      state.reviewDays = Array.isArray(parsed.reviewDays) ? parsed.reviewDays.filter(n => Number.isInteger(n) && n >= 0 && n <= 6) : (Number.isInteger(parsed.reviewDay) && parsed.reviewDay >= 0 ? [parsed.reviewDay] : []);
      state.reviewLog = parsed.reviewLog || {};
      state.surahIntervals = parsed.surahIntervals || {};
      state.userName = parsed.userName || '';
      state.recoveryDays = typeof parsed.recoveryDays === 'number' ? parsed.recoveryDays : 0;
      state.recoveredDates = parsed.recoveredDates || {};
      state.lastAwardedMilestone = typeof parsed.lastAwardedMilestone === 'number' ? parsed.lastAwardedMilestone : 0;
      state.autoSync = true;
    }
  } catch (err) {
    console.error("خطأ في قراءة البيانات:", err);
  }
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d;
}

function dayKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function syncCount() {
  state.lastCount = Object.keys(state.memorizedPages).length;
}

function saveState() {
  const count = Object.keys(state.memorizedPages).length;
  if (state.lastCount !== null && count !== state.lastCount) {
    const t = todayStr();
    state.log[t] = Math.max(0, (state.log[t] || 0) + (count - state.lastCount));
    if (!state.log[t]) delete state.log[t];
  }
  state.lastCount = count;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
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
      autoSync: state.autoSync
    }));
  } catch (err) {
    console.error("خطأ في حفظ البيانات:", err);
  }
}

let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toastNotification');
  const text = document.getElementById('toastMessage');
  if (!toast || !text) return;
  text.textContent = msg;
  toast.classList.remove('translate-y-24', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-24', 'opacity-0');
  }, 2600);
}

function launchConfetti() {
  let canvas = document.getElementById('confettiCanvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'confettiCanvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);
  }
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#10B981', '#059669', '#F59E0B', '#D97706', '#3B82F6', '#8B5CF6', '#EC4899', '#FBBF24'];
  const particles = [];
  for (let i = 0; i < 90; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.4 - 50,
      w: Math.random() * 8 + 5,
      h: Math.random() * 12 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 4 + 3,
      rot: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 8,
      opacity: 1
    });
  }

  let animId;
  const startTime = Date.now();
  function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const elapsed = Date.now() - startTime;
    let active = 0;

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.rotSpeed;
      if (elapsed > 2000) p.opacity -= 0.02;

      if (p.opacity > 0 && p.y < canvas.height + 50) {
        active++;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
    }

    if (active > 0 && elapsed < 4000) {
      animId = requestAnimationFrame(update);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      cancelAnimationFrame(animId);
    }
  }
  animId = requestAnimationFrame(update);
}

function toggleSurah(surahId) {
  const isNowDone = !state.memorizedSurahs[surahId];
  delete state.ayahs[surahId];
  if (isNowDone) {
    state.memorizedSurahs[surahId] = true;
    state.reviews[surahId] = todayStr();
    launchConfetti();
    const s = SURAHS.find(x => x.id === surahId);
    showToast(`ما شاء الله! مبارك إتمام سورة ${s ? s.name : ''} 🎉`);
  } else {
    delete state.memorizedSurahs[surahId];
  }

  if (state.autoSync) {
    const currentSurah = SURAHS.find(s => s.id === surahId);
    if (currentSurah) {
      for (let p = currentSurah.startPage; p <= currentSurah.endPage; p++) {
        const surahsOnPage = SURAHS.filter(s => p >= s.startPage && p <= s.endPage);
        if (isNowDone) {
          const allDone = surahsOnPage.every(s => (s.id === surahId ? true : state.memorizedSurahs[s.id]));
          if (allDone) {
            state.memorizedPages[p] = true;
          }
        } else {
          delete state.memorizedPages[p];
        }
      }
    }
  }

  saveState();
  if (typeof renderAll === 'function') renderAll();
}

function setAyahs(surahId, v) {
  const s = SURAHS.find(x => x.id === surahId);
  if (!s) return;
  const n = Math.min(s.ayahs, Math.max(0, parseInt(v) || 0));
  if (v === '' || n === 0) delete state.ayahs[surahId];
  else state.ayahs[surahId] = n;
  saveState();
  if (typeof renderAll === 'function') renderAll();
}

function togglePage(pageNum) {
  const isNowDone = !state.memorizedPages[pageNum];
  if (isNowDone) {
    state.memorizedPages[pageNum] = true;
  } else {
    delete state.memorizedPages[pageNum];
  }

  if (state.autoSync) {
    SURAHS.forEach(s => {
      if (pageNum >= s.startPage && pageNum <= s.endPage) {
        if (isNowDone) {
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
          }
        } else {
          delete state.memorizedSurahs[s.id];
        }
      }
    });
  }

  saveState();
  if (typeof renderAll === 'function') renderAll();
}

function updateCardDate() {
  const el = document.getElementById('cardDateDisplay');
  if (!el) return;
  const now = new Date();
  const greg = now.toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  let text = greg;
  try {
    const hij = now.toLocaleDateString('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' });
    if (hij) text += ' • ' + hij;
  } catch (e) { }
  el.textContent = text;
}

function updateStudentNameDisplay() {
  const container = document.getElementById('cardStudentNameContainer');
  const display = document.getElementById('cardStudentNameDisplay');
  if (!container || !display) return;
  if (state.userName && state.userName.trim()) {
    display.textContent = state.userName.trim();
    container.classList.remove('hidden');
  } else {
    container.classList.add('hidden');
  }
}

function updateMetrics() {
  updateCardDate();
  updateStudentNameDisplay();
  const memorizedPagesCount = Object.keys(state.memorizedPages).length;
  const memorizedSurahsCount = Object.keys(state.memorizedSurahs).length;

  let totalAyahs = 0;
  SURAHS.forEach(s => {
    if (state.memorizedSurahs[s.id]) {
      totalAyahs += s.ayahs;
    } else if (state.ayahs[s.id] > 0) {
      totalAyahs += Math.min(state.ayahs[s.id], s.ayahs);
    } else {
      const totalPages = (s.endPage - s.startPage + 1);
      if (totalPages > 1) {
        let donePages = 0;
        for (let p = s.startPage; p <= s.endPage; p++) {
          if (state.memorizedPages[p]) donePages++;
        }
        if (donePages > 0) {
          totalAyahs += Math.round((donePages / totalPages) * s.ayahs);
        }
      }
    }
  });
  totalAyahs = Math.min(totalAyahs, 6236);

  let completedAjzaCount = 0;
  AJZA.forEach(j => {
    let pagesCount = 0;
    const total = (j.end - j.start + 1);
    for (let p = j.start; p <= j.end; p++) {
      if (state.memorizedPages[p]) pagesCount++;
    }
    if (pagesCount === total) completedAjzaCount++;
  });

  const pagePercent = ((memorizedPagesCount / 604) * 100).toFixed(1);

  const elOverall = document.getElementById('statOverallPercent');
  if (elOverall) elOverall.textContent = `${pagePercent}%`;
  const elProgress = document.getElementById('statProgressBar');
  if (elProgress) elProgress.style.width = `${pagePercent}%`;

  const elPagesMem = document.getElementById('statPagesMemorized');
  if (elPagesMem) elPagesMem.textContent = formatStdNum(memorizedPagesCount);
  const elSurahsMem = document.getElementById('statSurahsMemorized');
  if (elSurahsMem) elSurahsMem.textContent = formatStdNum(memorizedSurahsCount);
  const elJuzComp = document.getElementById('statJuzCompleted');
  if (elJuzComp) elJuzComp.textContent = formatStdNum(completedAjzaCount);
  const elAyahsMem = document.getElementById('statAyahsMemorized');
  if (elAyahsMem) elAyahsMem.textContent = formatStdNum(totalAyahs);

  const pagesLeft = 604 - memorizedPagesCount;
  const elRemNotice = document.getElementById('statRemainingNotice');
  if (elRemNotice) {
    if (pagesLeft === 0) {
      elRemNotice.textContent = "ما شاء الله! تبارك الرحمن أتممت حفظ القرآن كاملاً 🎉";
    } else {
      elRemNotice.textContent = `باقي ${formatStdNum(pagesLeft)} صفحة`;
    }
  }

  const elCardPct = document.getElementById('cardPercentDisplay');
  if (elCardPct) elCardPct.textContent = `${pagePercent}%`;
  const cardProgressBar = document.getElementById('cardProgressBar');
  if (cardProgressBar) cardProgressBar.style.width = `${pagePercent}%`;
  const cardProgressLabel = document.getElementById('cardProgressLabel');
  if (cardProgressLabel) cardProgressLabel.textContent = `${formatStdNum(memorizedPagesCount)} من 604 صفحة`;
  const cardRemainingNotice = document.getElementById('cardRemainingNotice');
  if (cardRemainingNotice) {
    cardRemainingNotice.textContent = pagesLeft === 0 ? "تم الختم بحمد الله 🎉" : `باقي ${formatStdNum(pagesLeft)} صفحة`;
  }
  const elCardPages = document.getElementById('cardPagesDisplay');
  if (elCardPages) elCardPages.textContent = formatStdNum(memorizedPagesCount);
  const elCardSurahs = document.getElementById('cardSurahsDisplay');
  if (elCardSurahs) elCardSurahs.textContent = formatStdNum(memorizedSurahsCount);
  const elCardJuz = document.getElementById('cardJuzDisplay');
  if (elCardJuz) elCardJuz.textContent = formatStdNum(completedAjzaCount);
}

function setGoal(v) {
  state.goal = Math.min(604, Math.max(0, parseInt(v) || 0));
  saveState();
  if (typeof renderPlanner === 'function') renderPlanner();
}

function setStudyDays(v) {
  state.studyDays = Math.min(7, Math.max(1, parseInt(v) || 7));
  saveState();
  if (typeof renderPlanner === 'function') renderPlanner();
}

function toggleReviewDay(key) {
  const t = todayStr();
  if (key > t) {
    showToast("لا يمكن تسجيل مراجعة لأيام قادمة");
    return;
  }
  if (key < t) {
    showToast("سجل الأيام السابقة للقراءة فقط؛ حماية السلسلة تتم برصيد أيام الاستدراك 🛡️");
    return;
  }
  if (state.reviewLog[key]) {
    delete state.reviewLog[key];
    showToast("تم إلغاء المراجعة لهذا اليوم");
  } else {
    state.reviewLog[key] = 1;
    showToast("تم تسجيل المراجعة لهذا اليوم");
  }
  saveState();
  if (typeof renderPlanner === 'function') renderPlanner();
}

function toggleReviewDayOption(n) {
  const i = state.reviewDays.indexOf(n);
  if (i >= 0) state.reviewDays.splice(i, 1);
  else state.reviewDays.push(n);
  saveState();
  if (typeof renderPlanner === 'function') renderPlanner();
}

function markAllReviewed() {
  const t = todayStr();
  SURAHS.forEach(s => {
    if (!state.memorizedSurahs[s.id]) return;
    const last = state.reviews[s.id];
    const interval = (state.surahIntervals && state.surahIntervals[s.id]) || REVIEW_DAYS;
    if (!last || daysBetween(last, t) >= interval) state.reviews[s.id] = t;
  });
  state.reviewLog[t] = (state.reviewLog[t] || 0) + 1;
  saveState();
  if (typeof renderPlanner === 'function') renderPlanner();
  showToast("تم تسجيل مراجعة جميع السور المتأخرة");
}

function markReviewed(id) {
  rateSurahReview(id, (state.surahIntervals && state.surahIntervals[id]) || REVIEW_DAYS, 'متوسط');
}

function rateSurahReview(id, intervalDays, ratingLabel) {
  if (!state.surahIntervals) state.surahIntervals = {};
  state.surahIntervals[id] = intervalDays;
  state.reviews[id] = todayStr();
  state.reviewLog[todayStr()] = (state.reviewLog[todayStr()] || 0) + 1;
  saveState();
  if (typeof renderPlanner === 'function') renderPlanner();
  const s = SURAHS.find(x => x.id === id);
  showToast(`تم تسجيل مراجعة ${s ? 'سورة ' + s.name : ''} (${ratingLabel}) - المراجعة القادمة بعد ${intervalDays} يوماً`);
}

function getStreak() {
  const t = todayStr();
  if (!state.recoveredDates) state.recoveredDates = {};
  if (typeof state.recoveryDays !== 'number') state.recoveryDays = 0;
  if (typeof state.lastAwardedMilestone !== 'number') state.lastAwardedMilestone = 0;

  const isActive = k => (state.log[k] > 0 || !!state.reviewLog[k] || !!state.recoveredDates[k]);

  // Start from today if active; otherwise check yesterday
  let cur = isActive(t) ? new Date(t + 'T00:00:00') : addDays(t, -1);
  let streak = 0;
  let safety = 0;

  while (safety < 1000) {
    const k = dayKey(cur);
    if (isActive(k)) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    } else {
      // Check if we can apply an accumulated recovery day to save this missed day:
      if (k <= t && state.recoveryDays > 0 && !state.recoveredDates[k]) {
        state.recoveredDates[k] = true;
        state.recoveryDays = Math.max(0, state.recoveryDays - 1);
        streak++;
        cur.setDate(cur.getDate() - 1);
        try { saveState(); } catch (e) { }
      } else {
        break;
      }
    }
    safety++;
  }

  // Award 1 recovery day for every completed perfect 7-day streak milestone:
  const completedWeeks = Math.floor(streak / 7);
  if (completedWeeks > state.lastAwardedMilestone) {
    const newlyEarned = completedWeeks - state.lastAwardedMilestone;
    state.recoveryDays += newlyEarned;
    state.lastAwardedMilestone = completedWeeks;
    try { saveState(); } catch (e) { }
  }

  return streak;
}

function getStreakMotivator(streak) {
  const tiers = [
    { min: 0, max: 2, title: "بداية مباركة", icon: "🌱", next: 3, quote: "«أَحَبُّ الأَعْمَالِ إِلَى اللهِ أَدْوَمُهَا وَإِنْ قَلَّ»", encouragement: "بداية الغيث قطرة.. ثباتك اليوم يشعل شعلة الحفظ المستمر!" },
    { min: 3, max: 6, title: "شعلة العزيمة", icon: "🔥", next: 7, quote: "«مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللهُ لَهُ بِهِ طَرِيقًا إِلَى الجَنَّةِ»", encouragement: "أوقدتَ شعلة الهمة! بضع خطوات تفصلك عن أسبوع الثبات الأول!" },
    { min: 7, max: 13, title: "أسبوع الثبات", icon: "🌿", next: 14, quote: "«يُقَالُ لِصَاحِبِ الْقُرْآنِ: اقْرَأْ وَارْتَقِ وَرَتِّلْ»", encouragement: "ما شاء الله! أسبوع كامل في رحاب كتاب الله.. واصل لأسبوعين!" },
    { min: 14, max: 20, title: "نور المداومة", icon: "✨", next: 21, quote: "«الْمَاهِرُ بِالْقُرْآنِ مَعَ السَّفَرَةِ الْكِرَامِ الْبَرَرَةِ»", encouragement: "أسبوعان متتاليان! النور يزداد والبركة تتنزل، واصل لترسيخ العادة!" },
    { min: 21, max: 29, title: "عادة راسخة", icon: "💎", next: 30, quote: "«إِنَّ الَّذِينَ يَتْلُونَ كِتَابَ اللَّهِ... يَرْجُونَ تِجَارَةً لَّن تَبُورَ»", encouragement: "21 يوماً من الثبات! صنعت عادة قرآنية متأصلة، شهر النور قريب!" },
    { min: 30, max: 59, title: "شهر النور", icon: "🌙", next: 60, quote: "«خَيْرُكُمْ مَنْ تَعَلَّمَ القُرْآنَ وَعَلَّمَهُ»", encouragement: "مبارك إتمام شهر كامل من صحبة القرآن! همتك تعانق السحاب!" },
    { min: 60, max: 99, title: "همة الصالحين", icon: "🏆", next: 100, quote: "«اقْرَءُوا الْقُرْآنَ فَإِنَّهُ يَأْتِي يَوْمَ الْقِيَامَةِ شَفِيعًا لِأَصْحَابِهِ»", encouragement: "همة عالية تبلغ الجبال! خطوات يسيرة تفصلك عن نادي المئة وتاج الوقار!" },
    { min: 100, max: Infinity, title: "تاج الوقار", icon: "👑", next: null, quote: "«يُوضَعُ عَلَى رَأْسِهِ تَاجُ الْوَقَارِ»", encouragement: "أكثر من 100 يوم! هنيئاً لك هذه الصحبة المباركة لكتاب الله عز وجل." }
  ];

  const current = tiers.find(t => streak >= t.min && streak <= t.max) || tiers[0];
  let progressToNext = 100;
  let daysRemaining = 0;
  let nextTier = null;

  if (current.next !== null) {
    nextTier = tiers.find(t => t.min === current.next);
    const span = current.next - current.min;
    const progress = streak - current.min;
    progressToNext = Math.min(100, Math.max(0, Math.round((progress / span) * 100)));
    daysRemaining = Math.max(1, current.next - streak);
  }

  return {
    streak,
    current,
    nextTier,
    progressToNext,
    daysRemaining
  };
}
