'use strict';

// Prüfungsformat (siehe README, Abschnitt „Prüfungsformat“)
const PRUEFUNG = { fragen: 100, minuten: 60, bestehen: 75 };

const KEYS = {
  fortschritt: 'bzf.fortschritt',
  lernen: 'bzf.lernen',
  pruefung: 'bzf.pruefung',
};

let FRAGEN = [];      // [{nr, frage, antworten: [richtig, falsch, falsch, falsch]}]
let BY_NR = {};
let ERKL = {};        // {"nr": "Erklärung"}
let timerId = null;

const app = document.getElementById('app');
const timerEl = document.getElementById('timer');

// ---------- Hilfsfunktionen ----------

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  }
  return el;
}

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch { /* privater Modus o. Ä.: dann eben ohne Speichern */ }
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fmtTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function show(...nodes) {
  app.replaceChildren(...nodes.flat().filter((n) => n != null && n !== false));
  window.scrollTo(0, 0);
}

function questionBody(q) {
  return h('div', { class: 'question' },
    q.frage,
    q.bild ? h('img', { class: 'qimg', src: q.bild, alt: `Abbildung zu Frage ${q.nr}` }) : null);
}

function explanation(nr) {
  const text = ERKL[String(nr)];
  return text ? h('div', { class: 'explain' }, h('strong', {}, 'Erklärung (inoffiziell)'), h('p', {}, text)) : null;
}

// ---------- Fortschritt ----------

let progress = load(KEYS.fortschritt, {});

function record(nr, ok) {
  const p = progress[nr] || { r: 0, f: 0 };
  if (ok) p.r++; else p.f++;
  p.last = ok ? 1 : 0;
  progress[nr] = p;
  save(KEYS.fortschritt, progress);
}

function stats() {
  let richtig = 0, falsch = 0;
  for (const q of FRAGEN) {
    const p = progress[q.nr];
    if (!p) continue;
    if (p.last) richtig++; else falsch++;
  }
  return { richtig, falsch, offen: FRAGEN.length - richtig - falsch };
}

// ---------- Startseite ----------

function renderHome() {
  const s = stats();
  const total = FRAGEN.length;
  const exam = load(KEYS.pruefung, null);
  const running = exam && !exam.done && remaining(exam) > 0;

  let examHint = `${PRUEFUNG.fragen} Fragen in ${PRUEFUNG.minuten} Minuten, bestanden ab ${PRUEFUNG.bestehen} richtigen`;
  if (running) examHint = `Laufende Prüfung fortsetzen (${fmtTime(remaining(exam))} übrig)`;
  else if (exam && exam.done) examHint += ` · zuletzt ${score(exam)} von ${exam.ids.length} richtig`;

  show(
    h('h1', {}, 'BZF Trainer'),
    h('p', { class: 'muted' }, `Fragenkatalog der Bundesnetzagentur für BZF II und BZF I · ${total} Fragen`),
    h('div', { class: 'card' },
      h('div', { class: 'bar', 'aria-hidden': 'true' },
        h('div', { class: 'ok', style: `width:${(s.richtig / total) * 100}%` }),
        h('div', { class: 'bad', style: `width:${(s.falsch / total) * 100}%` })),
      h('p', { class: 'small muted' },
        `${s.richtig} zuletzt richtig · ${s.falsch} zuletzt falsch · ${s.offen} noch nicht beantwortet`)),
    h('div', { class: 'menu' },
      h('button', { onclick: () => { location.hash = 'lernen'; } },
        h('strong', {}, 'Lernen'),
        h('span', {}, 'Karteikarten mit Auflösung und Erklärung')),
      h('button', { onclick: () => { location.hash = 'pruefung'; } },
        h('strong', {}, running ? 'Prüfung fortsetzen' : 'Prüfung'),
        h('span', {}, examHint)),
      h('button', { onclick: () => { location.hash = 'videos'; } },
        h('strong', {}, 'Videos'),
        h('span', {}, 'Funkverkehr hören: Simulationen und Erklärvideos'))),
    h('button', {
      class: 'link',
      onclick: () => {
        if (!confirm('Den gesamten Lernfortschritt auf diesem Gerät löschen?')) return;
        progress = {};
        save(KEYS.fortschritt, null);
        save(KEYS.lernen, null);
        renderHome();
      },
    }, 'Fortschritt zurücksetzen'),
  );
}

// ---------- Lernmodus ----------

function renderLearn() {
  const settings = Object.assign({ reihenfolge: 'reihe', auswahl: 'alle', pos: 1 }, load(KEYS.lernen, {}));
  let queue = buildQueue(settings);
  let i = 0;

  const selReihenfolge = h('select', { onchange: (e) => update({ reihenfolge: e.target.value }) },
    h('option', { value: 'reihe' }, 'der Reihe nach'),
    h('option', { value: 'zufall' }, 'zufällig'));
  const selAuswahl = h('select', { onchange: (e) => update({ auswahl: e.target.value }) },
    h('option', { value: 'alle' }, 'alle Fragen'),
    h('option', { value: 'neu' }, 'noch nicht beantwortet'),
    h('option', { value: 'falsch' }, 'zuletzt falsch beantwortet'));
  const inpNr = h('input', { type: 'number', min: 1, max: FRAGEN.length, placeholder: 'Nr.', 'aria-label': 'Fragennummer' });
  const goto = (e) => {
    e.preventDefault();
    const n = parseInt(inpNr.value, 10);
    if (BY_NR[n]) update({ reihenfolge: 'reihe', auswahl: 'alle', pos: n });
    inpNr.value = '';
  };
  selReihenfolge.value = settings.reihenfolge;
  selAuswahl.value = settings.auswahl;

  const cardBox = h('div');

  show(
    h('div', { class: 'settings' },
      h('label', {}, 'Reihenfolge', selReihenfolge),
      h('label', {}, 'Auswahl', selAuswahl),
      h('form', { class: 'settings', style: 'margin:0', onsubmit: goto },
        h('label', {}, 'Gehe zu', inpNr), h('button', { type: 'submit' }, 'Los'))),
    cardBox,
  );
  renderCard();

  function update(change) {
    Object.assign(settings, change);
    save(KEYS.lernen, settings);
    selReihenfolge.value = settings.reihenfolge;
    selAuswahl.value = settings.auswahl;
    queue = buildQueue(settings);
    i = 0;
    renderCard();
  }

  function renderCard() {
    if (!queue.length) {
      const msg = settings.auswahl === 'falsch'
        ? 'Keine zuletzt falsch beantworteten Fragen. Sehr gut!'
        : 'Alle Fragen sind schon beantwortet.';
      cardBox.replaceChildren(h('div', { class: 'card' },
        h('p', {}, msg),
        h('button', { class: 'primary', onclick: () => update({ auswahl: 'alle' }) }, 'Alle Fragen lernen')));
      document.onkeydown = null;
      return;
    }
    if (i >= queue.length) {
      const s = stats();
      cardBox.replaceChildren(h('div', { class: 'card' },
        h('h2', {}, 'Durchgang abgeschlossen'),
        h('p', {}, `Insgesamt ${s.richtig} von ${FRAGEN.length} Fragen zuletzt richtig beantwortet.`),
        h('div', { class: 'actions' },
          h('button', { onclick: () => update({ pos: 1 }) }, 'Neuer Durchgang'),
          s.falsch ? h('button', { class: 'primary', onclick: () => update({ auswahl: 'falsch' }) }, 'Falsche wiederholen') : null)));
      document.onkeydown = null;
      return;
    }

    const q = BY_NR[queue[i]];
    const order = shuffle([0, 1, 2, 3]);
    let answered = false;

    const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
    const buttons = order.map((orig, pos) => h('button', { class: 'answer', onclick: () => choose(orig) },
      h('span', { class: 'key' }, 'ABCD'[pos]), h('span', {}, q.antworten[orig])));
    const next = h('button', { onclick: advance }, 'Überspringen');

    function choose(orig) {
      if (answered) return;
      answered = true;
      const ok = orig === 0;
      record(q.nr, ok);
      buttons.forEach((b, pos) => {
        b.disabled = true;
        if (order[pos] === 0) b.classList.add('correct');
        else if (order[pos] === orig) b.classList.add('wrong');
      });
      feedback.append(h('p', { class: ok ? 'ok' : 'bad' }, ok ? 'Richtig!' : 'Leider falsch.'));
      const erkl = explanation(q.nr);
      if (erkl) feedback.append(erkl);
      next.textContent = 'Weiter';
      next.className = 'primary';
      next.focus({ preventScroll: true });
    }

    function advance() {
      if (settings.reihenfolge === 'reihe') {
        settings.pos = q.nr + 1;
        save(KEYS.lernen, settings);
      }
      i++;
      renderCard();
      window.scrollTo(0, 0);
    }

    document.onkeydown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      const idx = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
      if (!answered && idx >= 0 && e.key.length === 1) choose(order[idx]);
      else if (answered && (e.key === 'Enter' || e.key === 'ArrowRight')) { e.preventDefault(); advance(); }
    };

    cardBox.replaceChildren(h('div', { class: 'card' },
      h('div', { class: 'qmeta' }, `Frage ${q.nr} · ${i + 1} von ${queue.length}`),
      questionBody(q),
      h('div', { class: 'answers' }, buttons),
      feedback,
      h('div', { class: 'actions' }, h('span'), next)));
  }
}

function buildQueue({ reihenfolge, auswahl, pos }) {
  let nrs = FRAGEN.map((q) => q.nr);
  if (auswahl === 'neu') nrs = nrs.filter((n) => !progress[n]);
  if (auswahl === 'falsch') nrs = nrs.filter((n) => progress[n] && !progress[n].last);
  if (reihenfolge === 'zufall') return shuffle(nrs);
  const start = nrs.findIndex((n) => n >= pos);
  return start > 0 ? nrs.slice(start).concat(nrs.slice(0, start)) : nrs;
}

// ---------- Prüfungsmodus ----------

function remaining(exam) {
  return exam.start + PRUEFUNG.minuten * 60000 - Date.now();
}

function score(exam) {
  return exam.answers.filter((a) => a === 0).length;
}

function newExam() {
  const ids = shuffle(FRAGEN.map((q) => q.nr)).slice(0, PRUEFUNG.fragen);
  return {
    ids,
    orders: ids.map(() => shuffle([0, 1, 2, 3])),
    answers: ids.map(() => null),
    current: 0,
    start: Date.now(),
    done: false,
  };
}

function finishExam(exam) {
  exam.done = true;
  exam.end = Math.min(Date.now(), exam.start + PRUEFUNG.minuten * 60000);
  exam.ids.forEach((nr, k) => {
    if (exam.answers[k] != null) record(nr, exam.answers[k] === 0);
  });
  save(KEYS.pruefung, exam);
}

function renderExam() {
  const exam = load(KEYS.pruefung, null);
  if (!exam || exam.done) return renderExamStart(exam);
  if (remaining(exam) <= 0) {
    finishExam(exam);
    showResult(exam);
    return;
  }
  renderExamQuestion(exam);
}

function renderExamStart(last) {
  show(
    h('h1', {}, 'Prüfungssimulation'),
    h('div', { class: 'card' },
      h('p', {}, `${PRUEFUNG.fragen} zufällige Fragen aus dem Katalog, ${PRUEFUNG.minuten} Minuten Zeit.`),
      h('p', {}, `Bestanden ab ${PRUEFUNG.bestehen} richtigen Antworten.`),
      h('p', { class: 'muted small' },
        'Die Antworten werden erst nach der Abgabe ausgewertet. Nach Ablauf der Zeit wird automatisch abgegeben.'),
      last ? h('p', { class: 'small' },
        `Letzte Prüfung: ${score(last)} von ${last.ids.length} richtig. `,
        h('a', { href: '#ergebnis' }, 'Auswertung ansehen')) : null,
      h('div', { class: 'actions' },
        h('button', { onclick: () => { location.hash = ''; } }, 'Zurück'),
        h('button', {
          class: 'primary',
          onclick: () => {
            save(KEYS.pruefung, newExam());
            renderExam();
          },
        }, 'Prüfung starten'))),
  );
}

function renderExamQuestion(exam) {
  const k = exam.current;
  const q = BY_NR[exam.ids[k]];
  const order = exam.orders[k];
  const n = exam.ids.length;

  const go = (idx) => {
    exam.current = Math.max(0, Math.min(n - 1, idx));
    save(KEYS.pruefung, exam);
    renderExamQuestion(exam);
  };
  const pick = (orig) => {
    exam.answers[k] = orig;
    save(KEYS.pruefung, exam);
    buttons.forEach((b, pos) => b.classList.toggle('selected', order[pos] === orig));
    grid.children[k].classList.add('done');
    countEl.textContent = answeredText();
  };
  const answeredText = () => `${exam.answers.filter((a) => a != null).length} von ${n} beantwortet`;
  const submit = () => {
    const open = exam.answers.filter((a) => a == null).length;
    const msg = open
      ? `Noch ${open} Fragen unbeantwortet. Trotzdem abgeben?`
      : 'Prüfung jetzt abgeben?';
    if (!confirm(msg)) return;
    finishExam(exam);
    showResult(exam);
  };
  const countEl = h('span', { class: 'small muted' }, answeredText());

  const buttons = order.map((orig, pos) => h('button', {
    class: 'answer' + (exam.answers[k] === orig ? ' selected' : ''),
    onclick: () => pick(orig),
  }, h('span', { class: 'key' }, 'ABCD'[pos]), h('span', {}, q.antworten[orig])));

  const grid = h('div', { class: 'grid', 'aria-label': 'Fragenübersicht' },
    exam.ids.map((_, idx) => h('button', {
      class: [exam.answers[idx] != null ? 'done' : '', idx === k ? 'current' : ''].join(' ').trim() || null,
      'aria-label': `Frage ${idx + 1}`,
      onclick: () => go(idx),
    }, idx + 1)));

  document.onkeydown = (e) => {
    const idx = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
    if (idx >= 0 && e.key.length === 1) pick(order[idx]);
    else if (e.key === 'ArrowRight') go(k + 1);
    else if (e.key === 'ArrowLeft') go(k - 1);
  };

  show(
    h('div', { class: 'card' },
      h('div', { class: 'qmeta' }, `Frage ${k + 1} von ${n}`),
      questionBody(q),
      h('div', { class: 'answers' }, buttons),
      h('div', { class: 'actions' },
        h('button', { onclick: () => go(k - 1), disabled: k === 0 }, 'Zurück'),
        k < n - 1
          ? h('button', { class: 'primary', onclick: () => go(k + 1) }, 'Weiter')
          : h('button', { class: 'primary', onclick: submit }, 'Abgeben'))),
    h('div', { class: 'card' },
      h('div', { class: 'actions', style: 'margin-top:0;align-items:center' },
        countEl,
        h('button', { onclick: submit }, 'Abgeben')),
      grid),
  );
  startTimer(exam);
}

function startTimer(exam) {
  stopTimer();
  const tick = () => {
    const left = remaining(exam);
    timerEl.textContent = fmtTime(left);
    timerEl.classList.toggle('low', left < 5 * 60000);
    if (left <= 0) {
      stopTimer();
      const current = load(KEYS.pruefung, exam);
      if (!current.done) finishExam(current);
      showResult(load(KEYS.pruefung, current));
    }
  };
  timerEl.hidden = false;
  tick();
  timerId = setInterval(tick, 1000);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
  timerEl.hidden = true;
}

function showResult(exam) {
  if (location.hash === '#ergebnis') renderResult(exam);
  else location.hash = 'ergebnis';
}

function renderResult(exam) {
  stopTimer();
  const n = exam.ids.length;
  const richtig = score(exam);
  const passed = richtig >= PRUEFUNG.bestehen;
  const used = fmtTime(exam.end - exam.start);
  const fehler = exam.ids
    .map((nr, k) => ({ q: BY_NR[nr], a: exam.answers[k] }))
    .filter((x) => x.a !== 0);

  show(
    h('div', { class: 'card result-head' },
      h('p', { class: 'verdict ' + (passed ? 'ok' : 'bad') }, passed ? 'Bestanden' : 'Nicht bestanden'),
      h('p', {}, `${richtig} von ${n} richtig (mindestens ${PRUEFUNG.bestehen})`),
      h('p', { class: 'muted small' }, `Bearbeitungszeit ${used} min`),
      h('div', { class: 'actions', style: 'justify-content:center' },
        h('button', { onclick: () => { location.hash = ''; } }, 'Startseite'),
        h('button', {
          class: 'primary',
          onclick: () => {
            save(KEYS.pruefung, newExam());
            if (location.hash === '#pruefung') renderExam();
            else location.hash = 'pruefung';
          },
        }, 'Neue Prüfung'))),
    fehler.length ? h('h2', {}, `Falsch oder nicht beantwortet (${fehler.length})`) : null,
    fehler.map(({ q, a }) => h('div', { class: 'card review' },
      h('div', { class: 'qmeta' }, `Frage ${q.nr}`),
      questionBody(q),
      h('p', { class: 'yours' }, a == null ? 'Nicht beantwortet' : `Deine Antwort: ${q.antworten[a]}`),
      h('p', { class: 'right' }, `Richtig: ${q.antworten[0]}`),
      explanation(q.nr))),
  );
}

// ---------- Videos ----------

let VIDEOS = null;

async function renderVideos() {
  if (!VIDEOS) {
    try {
      const res = await fetch('data/videos.json');
      if (!res.ok) throw new Error(res.status);
      VIDEOS = await res.json();
    } catch {
      show(h('div', { class: 'card' }, h('p', {}, 'Die Videoliste konnte nicht geladen werden.')));
      return;
    }
  }
  if (location.hash !== '#videos') return; // inzwischen weiternavigiert

  show(
    h('h1', {}, 'Videos zum Flugfunk'),
    h('p', { class: 'muted' },
      'Tipp: Nach jeder Ansage der Bodenfunkstelle pausieren, selbst laut antworten und dann vergleichen.'),
    VIDEOS.map((g) => h('div', { class: 'card' },
      h('h2', {}, g.gruppe),
      h('ul', { class: 'links' }, g.videos.map((v) => h('li', {},
        h('a', { href: v.url, target: '_blank', rel: 'noopener noreferrer' }, v.titel),
        h('div', { class: 'small muted' }, `${v.art} · ${v.kanal} · ${v.sprache}`),
        h('p', { class: 'small' }, v.beschreibung)))))),
    h('p', { class: 'small muted' },
      'Externe Links zu YouTube; die Inhalte stammen von den jeweiligen Kanälen. ' +
      'Hinweis: Den Flugfunk selbst mit einem Scanner mitzuhören ist in Deutschland nach § 5 TDDDG nicht erlaubt.'),
  );
}

// ---------- Start ----------

function route() {
  stopTimer();
  document.onkeydown = null;
  const r = location.hash.slice(1);
  const exam = load(KEYS.pruefung, null);
  if (r === 'videos') renderVideos();
  else if (r === 'lernen') renderLearn();
  else if (r === 'pruefung') renderExam();
  else if (r === 'ergebnis' && exam && exam.done) renderResult(exam);
  else if (r === 'ergebnis') renderExam();
  else renderHome();
}

async function init() {
  try {
    const res = await fetch('data/fragen.json');
    if (!res.ok) throw new Error(res.status);
    FRAGEN = await res.json();
    BY_NR = Object.fromEntries(FRAGEN.map((q) => [q.nr, q]));
  } catch {
    show(h('div', { class: 'card' },
      h('p', {}, 'Die Fragen konnten nicht geladen werden.'),
      h('p', { class: 'muted small' },
        'Die Seite muss über einen Webserver geöffnet werden, nicht als Datei. Siehe README.')));
    return;
  }
  try {
    const res = await fetch('data/erklaerungen.json');
    if (res.ok) ERKL = await res.json();
  } catch { /* ohne Erklärungen weitermachen */ }

  window.addEventListener('hashchange', route);
  route();
}

init();
