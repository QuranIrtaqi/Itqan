/**
 * Tamkeen: Interactive Quran Testing & Retention Engine
 * Powered by Open API (alquran.cloud) with offline local caching and fallback
 */

const TAMKEEN_RECENT_QUESTIONS = [];
const TAMKEEN_RECENT_SURAHS = [];

function recordTamkeenQuestionSignature(q) {
  if (!q) return;
  const sig = `${q.mode}_${q.surahId}_${q.ayahNum}_${q.id || ''}`;
  TAMKEEN_RECENT_QUESTIONS.push(sig);
  if (TAMKEEN_RECENT_QUESTIONS.length > 35) {
    TAMKEEN_RECENT_QUESTIONS.shift();
  }
  if (q.surahId) {
    TAMKEEN_RECENT_SURAHS.push(q.surahId);
    if (TAMKEEN_RECENT_SURAHS.length > 8) {
      TAMKEEN_RECENT_SURAHS.shift();
    }
  }
}

let tamkeenState = {
  activeMode: 'all',
  scope: 'all',
  currentQuestion: null,
  isAnswered: false,
  selectedOptionIndex: null,
  isBlurred: true,
  stats: {
    total: 0,
    correct: 0,
    streak: 0,
    bestStreak: 0
  }
};

function loadTamkeenStats() {
  try {
    const saved = localStorage.getItem('quran_tracker_tamkeen_stats');
    if (saved) {
      tamkeenState.stats = JSON.parse(saved);
    }
  } catch (e) { }
  updateTamkeenStatsUI();
}

function saveTamkeenStats() {
  try {
    localStorage.setItem('quran_tracker_tamkeen_stats', JSON.stringify(tamkeenState.stats));
  } catch (e) { }
}

function updateTamkeenStatsUI() {
  const elTotal = document.getElementById('tamkeenStatTotal');
  const elCorrect = document.getElementById('tamkeenStatCorrect');
  const elAcc = document.getElementById('tamkeenStatAccuracy');
  const elStreak = document.getElementById('tamkeenStatStreak');
  if (!elTotal) return;

  const t = tamkeenState.stats.total || 0;
  const c = tamkeenState.stats.correct || 0;
  const acc = t > 0 ? Math.round((c / t) * 100) : 0;
  elTotal.textContent = formatStdNum(t);
  elCorrect.textContent = formatStdNum(c);
  elAcc.textContent = `${formatStdNum(acc)}%`;
  elStreak.textContent = `🔥 ${formatStdNum(tamkeenState.stats.streak || 0)}`;
}

function openResetTamkeenModal() {
  const modal = document.getElementById('resetTamkeenConfirmModal');
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }
}

function closeResetTamkeenModal() {
  const modal = document.getElementById('resetTamkeenConfirmModal');
  if (modal) modal.classList.add('hidden');
}

function executeResetTamkeenStats() {
  tamkeenState.stats = {
    total: 0,
    correct: 0,
    streak: 0,
    bestStreak: 0
  };
  saveTamkeenStats();
  updateTamkeenStatsUI();
  closeResetTamkeenModal();
  if (typeof showToast === 'function') {
    showToast('تم تصفير نتائج وإحصائيات الأسئلة بنجاح.');
  }
}

function setTamkeenMode(mode) {
  tamkeenState.activeMode = mode;
  document.querySelectorAll('.tamkeen-mode-btn').forEach(btn => {
    btn.classList.remove('bg-white', 'text-emerald-950', 'shadow-sm', 'font-bold');
    btn.classList.add('bg-white/10', 'text-emerald-100', 'font-semibold');
  });
  const activeBtn = document.getElementById(`btnTamkeenMode_${mode}`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-white/10', 'text-emerald-100', 'font-semibold');
    activeBtn.classList.add('bg-white', 'text-emerald-950', 'shadow-sm', 'font-bold');
  }
  nextTamkeenQuestion();
}

function setTamkeenScope(scope) {
  tamkeenState.scope = scope;
  nextTamkeenQuestion();
}

function toggleTamkeenBlur() {
  tamkeenState.isBlurred = !tamkeenState.isBlurred;
  const container = document.getElementById('tamkeenChoicesContainer');
  const txt = document.getElementById('blurToggleText');
  const btn = document.getElementById('btnToggleTamkeenBlur');
  if (container) {
    if (tamkeenState.isBlurred) {
      container.classList.add('blur-sm', 'pointer-events-none');
      if (txt) txt.textContent = 'إظهار الخيارات للتحديد';
    } else {
      container.classList.remove('blur-sm', 'pointer-events-none');
      if (txt) txt.textContent = 'إخفاء للتسميع غيباً أولاً';
    }
  }
  if (btn) {
    const icon = btn.querySelector('i');
    if (icon) {
      icon.setAttribute('data-lucide', tamkeenState.isBlurred ? 'eye' : 'eye-off');
      lucide.createIcons();
    }
  }
}

// ==========================================
// OPEN API DYNAMIC QUESTION GENERATOR (alquran.cloud)
// ==========================================
const QURAN_API_CACHE = {};

function cleanAyahText(text, surahId, ayahNum) {
  if (!text) return '';
  let cleaned = text.trim();
  if (surahId !== 1 && surahId !== 9 && ayahNum === 1) {
    cleaned = cleaned.replace(/^بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ\s*/, '').trim();
  }
  return cleaned;
}

async function fetchSurahFromApi(surahId) {
  if (QURAN_API_CACHE[surahId]) return QURAN_API_CACHE[surahId];
  try {
    const local = localStorage.getItem(`tamkeen_surah_${surahId}`);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && parsed.ayahs && parsed.ayahs.length > 0) {
        QURAN_API_CACHE[surahId] = parsed;
        return parsed;
      }
    }
  } catch (e) { }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahId}/quran-uthmani`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    if (!json || !json.data || !json.data.ayahs) throw new Error("Invalid API payload");
    QURAN_API_CACHE[surahId] = json.data;
    try {
      localStorage.setItem(`tamkeen_surah_${surahId}`, JSON.stringify(json.data));
    } catch (e) { }
    return json.data;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function generateDynamicTamkeenQuestion(mode, scope) {
  let effectiveMode = mode;
  if (mode === 'all') {
    const candidateModes = ['next_ayah', 'surah_id'];
    effectiveMode = candidateModes[Math.floor(Math.random() * candidateModes.length)];
  }

  // Filter candidates for next_ayah and surah_id
  let candidateIds = [];
  if (scope === 'memorized') {
    candidateIds = Object.keys(state.memorizedSurahs || {}).map(Number).filter(id => id >= 1 && id <= 114);
    if (candidateIds.length === 0) {
      showToast("لم تُحدد بعد سوراً محفوظة، تم التوليد من القرآن كاملاً!");
      candidateIds = SURAHS.map(s => s.id);
    }
  } else {
    candidateIds = SURAHS.map(s => s.id);
  }

  // Avoid recently queried surahs if we have multiple candidates
  let freshSurahs = candidateIds.filter(id => !TAMKEEN_RECENT_SURAHS.includes(id));
  if (freshSurahs.length === 0) {
    freshSurahs = candidateIds;
  }
  const surahId = freshSurahs[Math.floor(Math.random() * freshSurahs.length)];
  const surahData = await fetchSurahFromApi(surahId);
  const meta = SURAHS.find(s => s.id === surahId) || { id: surahId, name: surahData.name, ayahs: surahData.ayahs.length, juz: 1 };

  // 1. Next Ayah Prompt
  if (effectiveMode === 'next_ayah') {
    if (surahData.ayahs.length < 2) {
      return generateDynamicTamkeenQuestion('next_ayah', scope);
    }
    let idx = 0;
    let attempts = 0;
    do {
      idx = Math.floor(Math.random() * (surahData.ayahs.length - 1));
      attempts++;
    } while (attempts < 15 && TAMKEEN_RECENT_QUESTIONS.includes(`next_ayah_${surahId}_${idx + 1}`));

    const qVerse = cleanAyahText(surahData.ayahs[idx].text, surahId, idx + 1);
    const correct = cleanAyahText(surahData.ayahs[idx + 1].text, surahId, idx + 2);

    const distractors = [];
    if (idx + 2 < surahData.ayahs.length) {
      distractors.push(cleanAyahText(surahData.ayahs[idx + 2].text, surahId, idx + 3));
    }
    for (let a = 0; a < 20 && distractors.length < 3; a++) {
      const randIdx = Math.floor(Math.random() * surahData.ayahs.length);
      if (randIdx !== idx && randIdx !== idx + 1) {
        const dText = cleanAyahText(surahData.ayahs[randIdx].text, surahId, randIdx + 1);
        if (dText && dText !== correct && !distractors.includes(dText)) {
          distractors.push(dText);
        }
      }
    }
    const fallbackTexts = [
      "إِنَّ اللَّهَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ",
      "وَاتَّقُوا اللَّهَ إِنَّ اللَّهَ شَدِيدُ الْعِقَابِ",
      "أُولَٰئِكَ هُمُ الْمُفْلِحُونَ",
      "فَسَبِّحْ بِحَمْدِ رَبِّكَ وَاسْتَغْفِرْهُ ۚ إِنَّهُ كَانَ تَوَّابًا"
    ];
    for (const fb of fallbackTexts) {
      if (fb !== correct && !distractors.includes(fb) && distractors.length < 3) {
        distractors.push(fb);
      }
    }

    return {
      mode: 'next_ayah',
      surahId,
      surahName: meta.name,
      ayahNum: idx + 1,
      globalAyahNum: (surahData.ayahs[idx] && surahData.ayahs[idx].number) || getGlobalAyahNumber(surahId, idx + 1),
      prompt: `ما هي الآية الكريمة التي تلي هذه الآية مباشرة في سورة «${meta.name}»؟`,
      verse: qVerse,
      correct,
      options: [correct, ...distractors.slice(0, 3)],
      rule: `سورة ${meta.name} • الآية (${idx + 2}) تلي الآية (${idx + 1}): «${correct}».`,
      source: 'api'
    };
  }

  // 2. Surah Identification
  let idx = 0;
  let attempts = 0;
  do {
    idx = Math.floor(Math.random() * surahData.ayahs.length);
    attempts++;
  } while (attempts < 15 && TAMKEEN_RECENT_QUESTIONS.includes(`surah_id_${surahId}_${idx + 1}`));

  const verseText = cleanAyahText(surahData.ayahs[idx].text, surahId, idx + 1);
  const correct = `سورة ${meta.name}`;

  const otherSurahs = SURAHS.filter(s => s.id !== surahId).sort(() => Math.random() - 0.5).slice(0, 3);
  const distractors = otherSurahs.map(s => `سورة ${s.name}`);

  return {
    mode: 'surah_id',
    surahId,
    surahName: meta.name,
    ayahNum: idx + 1,
    globalAyahNum: (surahData.ayahs[idx] && surahData.ayahs[idx].number) || getGlobalAyahNumber(surahId, idx + 1),
    prompt: `في أي سورة كريمة وردت هذه الآية المباركة؟`,
    verse: verseText,
    correct,
    options: [correct, ...distractors],
    rule: `وردت هذه الآية الكريمة في سورة ${meta.name}، الآية رقم (${idx + 1})، الجزء (${formatStdNum(meta.juz)}).`,
    source: 'api'
  };
}

// Static fallback questions when device is offline and API cannot be reached
const TAMKEEN_STATIC_FALLBACKS = [
  {
    mode: 'next_ayah',
    surahId: 1,
    surahName: 'الفَاتِحَة',
    ayahNum: 1,
    prompt: 'ما هي الآية الكريمة التي تلي هذه الآية مباشرة في سورة «الفَاتِحَة»؟',
    verse: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    correct: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
    options: ['الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', 'الرَّحْمَٰنِ الرَّحِيمِ', 'مَالِكِ يَوْمِ الدِّينِ', 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ'],
    rule: 'سورة الفاتحة تبدأ بالبسملة تليها آية الحمد لله رب العالمين.',
    source: 'offline'
  },
  {
    mode: 'next_ayah',
    surahId: 112,
    surahName: 'الإِخْلَاص',
    ayahNum: 1,
    prompt: 'ما هي الآية الكريمة التي تلي هذه الآية مباشرة في سورة «الإِخْلَاص»؟',
    verse: 'قُلْ هُوَ اللَّهُ أَحَدٌ',
    correct: 'اللَّهُ الصَّمَدُ',
    options: ['اللَّهُ الصَّمَدُ', 'لَمْ يَلِدْ وَلَمْ يُولَدْ', 'وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ', 'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ'],
    rule: 'سورة الإخلاص: (قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ).',
    source: 'offline'
  },
  {
    mode: 'surah_id',
    surahId: 67,
    surahName: 'المُلْك',
    ayahNum: 1,
    prompt: 'في أي سورة كريمة وردت هذه الآية المباركة؟',
    verse: 'تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ',
    correct: 'سورة المُلْك',
    options: ['سورة المُلْك', 'سورة القَلَم', 'سورة الفُرْقَان', 'سورة الحَاقَّة'],
    rule: 'فاتحة سورة الملك تبارك الذي بيده الملك.',
    source: 'offline'
  },
  {
    mode: 'surah_id',
    surahId: 36,
    surahName: 'يس',
    ayahNum: 1,
    prompt: 'في أي سورة كريمة وردت هذه الآية المباركة؟',
    verse: 'يس ۝ وَالْقُرْآنِ الْحَكِيمِ ۝ إِنَّكَ لَمِنَ الْمُرْسَلِينَ',
    correct: 'سورة يس',
    options: ['سورة يس', 'سورة الصَّافَّات', 'سورة الدُّخَان', 'سورة طه'],
    rule: 'فواتح سورة يس المباركة.',
    source: 'offline'
  },
  {
    mode: 'next_ayah',
    surahId: 114,
    surahName: 'النَّاس',
    ayahNum: 1,
    prompt: 'ما هي الآية الكريمة التي تلي هذه الآية مباشرة في سورة «النَّاس»؟',
    verse: 'قُلْ أَعُوذُ بِرَبِّ النَّاسِ',
    correct: 'مَلِكِ النَّاسِ',
    options: ['مَلِكِ النَّاسِ', 'إِلَٰهِ النَّاسِ', 'مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ', 'الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ'],
    rule: 'سورة الناس: (قُلْ أَعُوذُ بِرَبِّ النَّاسِ ۝ مَلِكِ النَّاسِ).',
    source: 'offline'
  }
];

function renderTamkeenLoadingState() {
  const card = document.getElementById('tamkeenCard');
  if (!card) return;
  card.innerHTML = `
    <div class="py-12 sm:py-16 flex flex-col items-center justify-center gap-3.5 text-center font-sans">
      <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-900/30 animate-spin">
        <i data-lucide="refresh-cw" class="w-6 h-6"></i>
      </div>
      <div class="space-y-1">
        <h4 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
          جاري استدعاء وتوليد سؤال جديد تلقائياً...
        </h4>
        <p class="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
          <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          اتصال مباشر عبر Open API (alquran.cloud)
        </p>
      </div>
    </div>
  `;
  lucide.createIcons();
}

function getTamkeenEligibleQuestions() {
  let pool = TAMKEEN_STATIC_FALLBACKS.slice();
  if (tamkeenState.activeMode !== 'all') {
    pool = pool.filter(q => q.mode === tamkeenState.activeMode);
  }
  if (tamkeenState.scope === 'memorized') {
    const memPool = pool.filter(q => state.memorizedSurahs && state.memorizedSurahs[q.surahId]);
    if (memPool.length > 0) {
      pool = memPool;
    }
  }
  const unasked = pool.filter(q => !TAMKEEN_RECENT_QUESTIONS.includes(`${q.mode}_${q.surahId}_${q.ayahNum}_${q.id || ''}`));
  return unasked.length > 0 ? unasked : (pool.length > 0 ? pool : TAMKEEN_STATIC_FALLBACKS);
}

function getGlobalAyahNumber(surahId, ayahNumInSurah) {
  let count = 0;
  for (let i = 1; i < surahId; i++) {
    const s = SURAHS.find(item => item.id === i);
    if (s) count += s.ayahs;
  }
  return count + (parseInt(ayahNumInSurah) || 1);
}

let currentTamkeenAudio = null;
let isTamkeenAudioPlaying = false;

function stopTamkeenAudio() {
  if (currentTamkeenAudio) {
    try { currentTamkeenAudio.pause(); } catch (e) { }
    currentTamkeenAudio = null;
    isTamkeenAudioPlaying = false;
  }
  const icon = document.getElementById('tamkeenAudioIcon');
  const text = document.getElementById('tamkeenAudioText');
  const waves = document.getElementById('tamkeenAudioWaves');
  if (icon) icon.setAttribute('data-lucide', 'volume-2');
  if (text) text.textContent = 'استمع للتلاوة';
  if (waves) waves.classList.add('hidden');
  if (window.lucide) lucide.createIcons();
}

function toggleTamkeenAudio() {
  const q = tamkeenState.currentQuestion;
  if (!q) return;

  const icon = document.getElementById('tamkeenAudioIcon');
  const text = document.getElementById('tamkeenAudioText');
  const waves = document.getElementById('tamkeenAudioWaves');

  if (currentTamkeenAudio && !currentTamkeenAudio.paused) {
    stopTamkeenAudio();
    return;
  }

  const globalAyahNum = q.globalAyahNum || getGlobalAyahNumber(q.surahId, q.ayahNum);
  const audioUrl = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${globalAyahNum}.mp3`;

  if (!currentTamkeenAudio || currentTamkeenAudio.dataset.url !== audioUrl) {
    if (currentTamkeenAudio) {
      try { currentTamkeenAudio.pause(); } catch (e) { }
    }
    currentTamkeenAudio = new Audio(audioUrl);
    currentTamkeenAudio.dataset.url = audioUrl;

    currentTamkeenAudio.onended = () => {
      stopTamkeenAudio();
    };

    currentTamkeenAudio.onerror = () => {
      stopTamkeenAudio();
      if (typeof showToast === 'function') showToast('تعذر تحميل تلاوة الآية حالياً');
    };
  }

  if (text) text.textContent = 'جاري التلاوة...';
  if (waves) waves.classList.remove('hidden');

  currentTamkeenAudio.play().then(() => {
    isTamkeenAudioPlaying = true;
    if (icon) icon.setAttribute('data-lucide', 'pause');
    if (text) text.textContent = 'إيقاف التلاوة';
    if (window.lucide) lucide.createIcons();
  }).catch(err => {
    console.warn("Audio playback note:", err);
    stopTamkeenAudio();
  });
}

async function startTamkeenSpecificSurah(surahId) {
  renderTamkeenLoadingState();
  stopTamkeenAudio();
  try {
    const surahData = await fetchSurahFromApi(surahId);
    const meta = SURAHS.find(s => s.id === surahId) || { id: surahId, name: surahData.name, ayahs: surahData.ayahs.length, juz: 1 };
    
    if (surahData.ayahs && surahData.ayahs.length > 1) {
      const idx = Math.floor(Math.random() * (surahData.ayahs.length - 1));
      const qVerse = cleanAyahText(surahData.ayahs[idx].text, surahId, idx + 1);
      const correct = cleanAyahText(surahData.ayahs[idx + 1].text, surahId, idx + 2);
      
      const distractors = [];
      for (let a = 0; a < 25 && distractors.length < 3; a++) {
        const randIdx = Math.floor(Math.random() * surahData.ayahs.length);
        if (randIdx !== idx && randIdx !== idx + 1) {
          const dText = cleanAyahText(surahData.ayahs[randIdx].text, surahId, randIdx + 1);
          if (dText && dText !== correct && !distractors.includes(dText)) {
            distractors.push(dText);
          }
        }
      }
      while (distractors.length < 3) {
        distractors.push("إِنَّ اللَّهَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ");
      }
      
      const q = {
        mode: 'next_ayah',
        surahId,
        surahName: meta.name,
        ayahNum: idx + 1,
        globalAyahNum: (surahData.ayahs[idx] && surahData.ayahs[idx].number) || getGlobalAyahNumber(surahId, idx + 1),
        prompt: `ما هي الآية الكريمة التي تلي هذه الآية مباشرة في سورة «${meta.name}»؟`,
        verse: qVerse,
        correct,
        options: [correct, ...distractors.slice(0, 3)],
        rule: `سورة ${meta.name} • الآية (${idx + 2}) تلي الآية (${idx + 1}): «${correct}».`,
        source: 'api'
      };
      
      const shuffledOptions = q.options.slice().sort(() => Math.random() - 0.5);
      tamkeenState.currentQuestion = {
        ...q,
        shuffledOptions
      };
      recordTamkeenQuestionSignature(q);
    } else {
      await nextTamkeenQuestion();
      return;
    }
  } catch (err) {
    console.warn("Specific surah question fallback:", err);
    await nextTamkeenQuestion();
    return;
  }
  tamkeenState.isAnswered = false;
  tamkeenState.selectedOptionIndex = null;
  tamkeenState.isBlurred = true;
  renderTamkeenQuiz();
}

async function nextTamkeenQuestion() {
  stopTamkeenAudio();
  renderTamkeenLoadingState();
  try {
    const q = await generateDynamicTamkeenQuestion(tamkeenState.activeMode, tamkeenState.scope);
    const shuffledOptions = q.options.slice().sort(() => Math.random() - 0.5);
    tamkeenState.currentQuestion = {
      ...q,
      shuffledOptions
    };
    recordTamkeenQuestionSignature(q);
  } catch (err) {
    console.warn("Open API generation fallback:", err);
    const pool = getTamkeenEligibleQuestions();
    let q = pool[Math.floor(Math.random() * pool.length)];
    const shuffledOptions = q.options.slice().sort(() => Math.random() - 0.5);
    tamkeenState.currentQuestion = {
      ...q,
      shuffledOptions,
      source: 'offline'
    };
    recordTamkeenQuestionSignature(q);
  }
  tamkeenState.isAnswered = false;
  tamkeenState.selectedOptionIndex = null;
  tamkeenState.isBlurred = true;
  renderTamkeenQuiz();
}

function handleTamkeenChoice(idx) {
  if (tamkeenState.isAnswered || !tamkeenState.currentQuestion) return;
  const q = tamkeenState.currentQuestion;
  tamkeenState.isAnswered = true;
  tamkeenState.isBlurred = false;
  tamkeenState.selectedOptionIndex = idx;
  tamkeenState.stats.total++;

  const chosenText = q.shuffledOptions[idx];
  const isCorrect = (chosenText === q.correct);

  if (isCorrect) {
    tamkeenState.stats.correct++;
    tamkeenState.stats.streak++;
    if (tamkeenState.stats.streak > tamkeenState.stats.bestStreak) {
      tamkeenState.stats.bestStreak = tamkeenState.stats.streak;
    }
    if (typeof triggerHaptic === 'function') triggerHaptic('success');

    // Celebratory Milestones
    const streak = tamkeenState.stats.streak;
    if (streak === 5 || streak === 10 || streak === 15 || streak === 20 || (streak > 20 && streak % 10 === 0)) {
      if (typeof launchConfetti === 'function') launchConfetti();
      if (typeof showToast === 'function') {
        showToast(`🎉 ما شاء الله! إتقان متتابع: ${formatStdNum(streak)} إجابات صحيحة دون خطأ!`);
      }
    }
  } else {
    tamkeenState.stats.streak = 0;
    if (typeof triggerHaptic === 'function') triggerHaptic('error');
    if (typeof addMistakeToNotebook === 'function') {
      addMistakeToNotebook(q, chosenText);
    }
  }

  saveTamkeenStats();
  updateTamkeenStatsUI();
  renderTamkeenQuiz();
}

function renderTamkeenQuiz() {
  const card = document.getElementById('tamkeenCard');
  if (!card) return;
  if (!tamkeenState.currentQuestion) {
    nextTamkeenQuestion();
    return;
  }

  const q = tamkeenState.currentQuestion;
  const modeNames = {
    next_ayah: '🔄 الآية التالية',
    surah_id: '📖 تحديد السورة'
  };
  const modeColors = {
    next_ayah: 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-500/30',
    surah_id: 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border-indigo-500/30'
  };

  let displayedVerse = q.verse;

  const letters = ['أ', 'ب', 'ج', 'د'];
  const isNextAyah = (q.mode === 'next_ayah');
  const choicesHtml = q.shuffledOptions.map((opt, idx) => {
    let btnClasses = "p-3 sm:p-4 rounded-2xl border text-right transition flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold active:scale-[0.98] min-h-[50px] touch-manipulation";
    let badgeClasses = "w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0";
    let iconHtml = "";

    if (!tamkeenState.isAnswered) {
      btnClasses += " bg-slate-50 hover:bg-emerald-50/70 dark:bg-slate-800/80 dark:hover:bg-slate-750 border-slate-200 dark:border-slate-700/80 hover:border-emerald-500 text-slate-800 dark:text-slate-100 cursor-pointer shadow-xs";
      badgeClasses += " bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600";
    } else {
      if (opt === q.correct) {
        btnClasses += " bg-emerald-600 text-white border-emerald-500 shadow-md font-bold";
        badgeClasses += " bg-white text-emerald-700";
        iconHtml = '<i data-lucide="check" class="w-4 h-4 text-white shrink-0"></i>';
      } else if (idx === tamkeenState.selectedOptionIndex) {
        btnClasses += " bg-rose-600 text-white border-rose-500 shadow-md font-bold";
        badgeClasses += " bg-white text-rose-700";
        iconHtml = '<i data-lucide="x" class="w-4 h-4 text-white shrink-0"></i>';
      } else {
        btnClasses += " bg-slate-100 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800 text-slate-400 opacity-50 cursor-not-allowed";
        badgeClasses += " bg-slate-200 dark:bg-slate-700 text-slate-400";
      }
    }

    return `
      <button onclick="handleTamkeenChoice(${idx})" ${tamkeenState.isAnswered ? 'disabled' : ''} class="${btnClasses}">
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <span class="${badgeClasses}">${letters[idx]}</span>
          <span class="${isNextAyah ? 'font-quran text-xs sm:text-sm leading-relaxed' : 'font-sans'} break-words">${opt}</span>
        </div>
        ${iconHtml}
      </button>
    `;
  }).join('');

  let feedbackHtml = '';
  if (tamkeenState.isAnswered) {
    const isCorrect = (q.shuffledOptions[tamkeenState.selectedOptionIndex] === q.correct);
    if (isCorrect) {
      feedbackHtml = `
        <div class="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div class="space-y-0.5">
            <span class="font-black text-emerald-900 dark:text-emerald-200 text-sm flex items-center gap-1.5">
              <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600 dark:text-emerald-400"></i>
              أحسنت! إجابة صحيحة ومتقنة 👏
            </span>
            <p class="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
              تتابعك الحالي: <b class="font-bold text-amber-600 dark:text-amber-400">🔥 ${formatStdNum(tamkeenState.stats.streak)}</b> إجابات صحيحة متتالية
            </p>
          </div>
          <button onclick="nextTamkeenQuestion()" class="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold shadow-md transition active:scale-95 shrink-0 flex items-center justify-center gap-1.5">
            <span>السؤال التالي</span>
            <i data-lucide="chevron-left" class="w-4 h-4"></i>
          </button>
        </div>
      `;
    } else {
      feedbackHtml = `
        <div class="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div class="space-y-0.5">
            <span class="font-black text-rose-900 dark:text-rose-200 text-sm flex items-center gap-1.5">
              <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-600 dark:text-rose-400"></i>
              إجابة غير صحيحة، تم حفظ الآية في «دفتر التثبيت» ✍️
            </span>
            <p class="text-xs text-rose-800 dark:text-rose-300">
              الإجابة الصحيحة هي: <b class="font-bold text-rose-950 dark:text-white">«${q.correct}»</b>
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" onclick="openMistakesModal()" class="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 text-xs font-bold transition active:scale-95 flex items-center gap-1">
              <i data-lucide="book-marked" class="w-3.5 h-3.5"></i>
              <span>دفتر التثبيت</span>
            </button>
            <button onclick="nextTamkeenQuestion()" class="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold shadow-md transition active:scale-95 shrink-0 flex items-center justify-center gap-1.5">
              <span>السؤال التالي</span>
              <i data-lucide="chevron-left" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      `;
    }

    if (q.rule) {
      feedbackHtml += `
        <div class="p-3.5 rounded-2xl bg-amber-50/90 dark:bg-gold-950/40 border border-amber-300 dark:border-gold-700/60 space-y-1.5">
          <h5 class="text-xs font-black text-amber-900 dark:text-gold-200 flex items-center gap-1.5">
            <i data-lucide="sparkle" class="w-3.5 h-3.5 text-amber-500"></i>
            فائدة وضابط التثبيت القرآني:
          </h5>
          <p class="text-xs text-amber-900/90 dark:text-gold-300/90 leading-relaxed font-medium">
            ${q.rule}
          </p>
        </div>
      `;
    }
  }

  card.innerHTML = `
    <div class="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${modeColors[q.mode]}">
          ${modeNames[q.mode]}
        </span>
        <span class="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-xl">
          ${q.mode === 'surah_id' && !tamkeenState.isAnswered ? `آية رقم (${formatStdNum(q.ayahNum)}) • اسم السورة مطلوب` : `سورة ${q.surahName} • آية ${formatStdNum(q.ayahNum)}`}
        </span>
        ${q.source === 'api' ? `
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Open API
          </span>
        ` : `
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            مخزن محلياً
          </span>
        `}
      </div>

      <div class="flex items-center gap-1.5">
        <button onclick="openMistakesModal()" class="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1 py-1 px-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition active:scale-95" title="عرض دفتر التثبيت والأخطاء">
          <i data-lucide="book-marked" class="w-3.5 h-3.5 text-amber-600"></i>
          <span>دفتر التثبيت</span>
          <span id="tamkeenMistakesBadge" class="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-mono leading-tight ${state.mistakesNotebook && state.mistakesNotebook.length ? '' : 'hidden'}">${state.mistakesNotebook ? state.mistakesNotebook.length : 0}</span>
        </button>
        <button onclick="nextTamkeenQuestion()" class="text-xs font-bold text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-300 flex items-center gap-1 py-1 px-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95" title="تخطي إلى سؤال آخر">
          <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
          <span>سؤال آخر</span>
        </button>
      </div>
    </div>

    <div class="space-y-2">
      <h3 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
        <i data-lucide="help-circle" class="w-4 h-4 text-emerald-600 dark:text-emerald-400"></i>
        ${q.prompt}
      </h3>

      <div class="p-3.5 sm:p-6 rounded-2xl bg-amber-50/50 dark:bg-emerald-950/20 border-2 border-gold-400/30 dark:border-gold-600/30 text-center relative shadow-xs">
        <p class="font-quran text-lg sm:text-2xl md:text-3xl leading-[2.2] sm:leading-loose text-slate-800 dark:text-slate-100 select-text">
          «${displayedVerse}»
        </p>

        <div class="mt-3 pt-2.5 border-t border-gold-300/40 dark:border-emerald-800/40 flex items-center justify-center gap-2">
          <button id="btnTamkeenAudioPlay" onclick="toggleTamkeenAudio()" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold shadow-xs border border-emerald-300/60 dark:border-emerald-700/60 transition active:scale-95" title="الاستماع لتلاوة الآية بصوت الشيخ مشاري العفاسي">
            <i id="tamkeenAudioIcon" data-lucide="volume-2" class="w-4 h-4 text-emerald-600 dark:text-emerald-400"></i>
            <span id="tamkeenAudioText">استمع للتلاوة</span>
            <span id="tamkeenAudioWaves" class="hidden audio-playing-indicator">
              <span></span><span></span><span></span><span></span>
            </span>
          </button>
        </div>
      </div>
    </div>

    <div class="space-y-2 pt-1">
      <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
        <span>اختر الإجابة الصحيحة:</span>
        ${!tamkeenState.isAnswered ? `
          <button id="btnToggleTamkeenBlur" onclick="toggleTamkeenBlur()" class="text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 font-bold text-[11px] sm:text-xs">
            <i data-lucide="${tamkeenState.isBlurred ? 'eye' : 'eye-off'}" class="w-3.5 h-3.5"></i>
            <span id="blurToggleText">${tamkeenState.isBlurred ? 'إظهار الخيارات للتحديد' : 'إخفاء للتسميع غيباً أولاً'}</span>
          </button>
        ` : ''}
      </div>

      <div id="tamkeenChoicesContainer" class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 transition duration-200 ${tamkeenState.isBlurred ? 'blur-sm pointer-events-none' : ''}">
        ${choicesHtml}
      </div>
    </div>

    ${feedbackHtml}
  `;

  lucide.createIcons();
}
