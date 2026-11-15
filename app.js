const groups = [
  { title: 'Principes et valeurs de la République', practiceSections: ['values'], quotas: { symbols: 3, secular: 2, valuesCase: 6 } },
  { title: 'Système institutionnel et politique', quotas: { vote: 3, institutions: 2, europe: 1 } },
  { title: 'Droits et devoirs', quotas: { rights: 2, duties: 3, rightsCase: 6 } },
  { title: 'Histoire, géographie et culture', quotas: { history: 3, geography: 3, heritage: 2 } },
  { title: 'Vivre dans la société française', quotas: { residence: 1, health: 1, work: 1, school: 1 } }
];
const quotas = Object.assign({}, ...groups.map(group => group.quotas));
const themeBySection = new Map(groups.flatMap(group =>
  [...Object.keys(group.quotas), ...(group.practiceSections ?? [])].map(section => [section, group.title])
));
const key = 'civique-cr-v1';
const app = document.querySelector('#app');
let bank;
let questionsById;
let activePractice;
let screen = 'home';
let filter = 'all';
let data = { score: { correct: 0, total: 0 }, exam: null, practice: null };
try {
  data = JSON.parse(localStorage.getItem(key)) ?? data;
} catch {}
data.favorites ??= [];
data.fullPractice ??= null;

function save() {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function createQuestion(question) {
  const options = shuffle([
    { text: pick(question.correct), correct: true },
    ...shuffle(question.distractors).slice(0, 3).map(group => ({ text: pick(group), correct: false }))
  ]);
  return { ...question, options, answer: null };
}

function escape(text) {
  return String(text).replace(/[&<>"']/g, character =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function isScenario(question) {
  return question.section === 'valuesCase' || question.section === 'rightsCase';
}

function theme(question) {
  return themeBySection.get(question.section);
}

function scoreText() {
  const label = data.score.correct === 1 ? 'bonne réponse' : 'bonnes réponses';
  const { correct, total } = data.score;
  if (!total) return `${correct} ${label} sur 0 · — %`;
  const percentage = ((100 * correct) / total).toFixed(1).replace('.', ',');
  const status = correct * 40 < total * 32 ? 'below' : 'at-or-above';
  return `${correct} ${label} sur ${total} · <span class="score-percentage score-${status}">${percentage} %</span>`;
}

function resetScoreButton() {
  const disabled = data.score.total === 0 && !data.fullPractice ? ' disabled' : '';
  return `<button data-action="resetScore"${disabled}>Réinitialiser le score</button>`;
}

function favoriteButton(question) {
  const starred = data.favorites.includes(question.id);
  return `<button class="favorite-star" data-action="favorite" data-index="${question.id}"
    aria-label="Favori" aria-pressed="${starred}">${starred ? '★' : '☆'}</button>`;
}

function favoritesView() {
  const favorites = data.favorites.map(id => questionsById.get(id));
  const count = favorites.length;
  return `<section class="card"><h2>Favoris <span class="meta">(${count})</span></h2>
    ${count ? `<button class="primary" data-action="trainFavorites">S’entraîner sur les favoris</button>
    <details class="favorites-list"><summary>Voir les questions favorites</summary>
    <ul>${favorites.map(question => `<li class="favorite-item">
      <span>${escape(question.prompt)}</span>
      <button data-action="favorite" data-index="${question.id}"
        aria-label="Retirer des favoris : ${escape(question.prompt)}">Retirer</button>
    </li>`).join('')}</ul></details>` : '<p>Ajoutez une question à vos favoris en touchant son étoile.</p>'}
    </section>`;
}

function fullPracticeComplete() {
  return data.fullPractice?.answered.length === bank.length;
}

function fullPracticeStatus() {
  const answered = data.fullPractice?.answered.length ?? 0;
  if (fullPracticeComplete()) {
    return 'Entraînement complet terminé. Réinitialisez le score pour recommencer.';
  }
  return `Entraînement complet · ${answered} / ${bank.length} questions traitées`;
}

function home() {
  const examLabel = !data.exam ? 'Commencer' : data.exam.finished ? 'Nouvel examen' : 'Reprendre l’examen';
  return `<h1>Préparez l’examen civique</h1>
    <p>${bank.filter(question => question.official).length} questions officielles de connaissance · ${bank.filter(isScenario).length} mises en situation d’entraînement</p>
    <div class="grid">
    <section class="card"><h2>Entraînement</h2><p>Correction immédiate, sans limite de temps.</p>
    <div class="row"><p><strong>${scoreText()}</strong></p>${resetScoreButton()}</div>
    <label for="theme">Thème ou type de question</label><select id="theme"><option value="all" ${filter === 'all' ? 'selected' : ''}>Tous les thèmes (entraînement complet)</option>
    <option value="cases" ${filter === 'cases' ? 'selected' : ''}>Mises en situation</option>
    ${groups.map((group, index) => `<option value="${index}" ${filter === String(index) ? 'selected' : ''}>${group.title}</option>`).join('')}
    </select><button class="primary" data-action="practice"
    ${filter === 'all' && fullPracticeComplete() ? 'disabled' : ''}>S’entraîner</button>
    <p class="meta">${fullPracticeStatus()}</p></section>
    <section class="card"><h2>Examen blanc</h2><p>40 questions · 45 minutes · seuil de réussite 32/40.</p>
    <p>28 questions de connaissance et 12 mises en situation d’entraînement.</p>
    <button class="primary" data-action="exam">${examLabel}</button>
    ${data.exam?.finished ? '<button data-action="review">Dernier résultat</button>' : ''}
    </section></div>${favoritesView()}`;
}

function questionMarkup(question, practice) {
  return `<div class="question-heading"><h2>${escape(question.prompt)}</h2>${favoriteButton(question)}</div><div class="answers">${question.options.map((option, index) => {
    const locked = practice && question.answer !== null;
    const style = locked && option.correct ? 'good' :
      question.answer === index ? (locked ? 'bad' : 'selected') : '';
    return `<button class="option ${style}" data-action="answer" data-index="${index}"
      aria-pressed="${question.answer === index}" ${locked ? 'disabled' : ''}>
      <strong>${'ABCD'[index]}.</strong> ${escape(option.text)}</button>`;
  }).join('')}</div>`;
}

function explanationMarkup(question) {
  const explanation = question.explanation ? `<p>${escape(question.explanation)}</p>` : '';
  const source = question.source?.startsWith('https://')
    ? `<p><a href="${escape(question.source)}" target="_blank" rel="noopener noreferrer">En savoir plus</a></p>`
    : '';
  return explanation + source;
}

function practiceView() {
  const question = activePractice.question;
  const answered = question.answer !== null;
  const favoritesOnly = activePractice.filter === 'favorites';
  const fullPractice = activePractice.filter === 'all';
  const score = favoritesOnly
    ? '<p class="meta">Entraînement des favoris · Hors score</p>'
    : `<p class="meta">${scoreText()}</p>${resetScoreButton()}`;
  return `<section class="card"><div class="row"><button data-action="home">Accueil</button>
    ${score}</div><p class="meta">${theme(question)}${isScenario(question) ? ' · Mise en situation' : ''}</p>
    ${fullPractice ? `<p class="meta">${fullPracticeStatus()}</p>` : ''}
    ${questionMarkup(question, true)}
    ${answered ? `<p role="status"><strong>${question.options[question.answer].correct ? 'Bonne réponse.' : 'Réponse incorrecte.'}</strong>
      ${escape(question.options.find(option => option.correct).text)}</p>${explanationMarkup(question)}` : ''}
    ${fullPractice && fullPracticeComplete() ? '' : `<button class="primary" data-action="nextPractice"
    ${answered || (favoritesOnly && !data.favorites.includes(question.id)) ? '' : 'disabled'}>Question suivante</button>`}</section>`;
}

function examView() {
  const { questions, index } = data.exam;
  const question = questions[index];
  const answered = questions.filter(item => item.answer !== null).length;
  return `<section class="card"><div class="row"><button data-action="home">Accueil</button><span id="timer"></span></div>
    <p class="meta">Question ${index + 1} / 40 · ${answered} faites · ${theme(question)}${isScenario(question) ? ' · Mise en situation' : ''}</p>
    ${questionMarkup(question, false)}
    <div class="row"><button data-action="jump" data-index="${index - 1}" ${index === 0 ? 'disabled' : ''}>Précédente</button>
    <button data-action="jump" data-index="${index + 1}" ${index === 39 ? 'disabled' : ''}>Suivante</button>
    <button class="primary" data-action="finish">Terminer</button></div>
    <nav class="jump" aria-label="Questions">${questions.map((item, position) =>
      `<button aria-label="Question ${position + 1}, ${item.answer === null ? 'sans réponse' : 'répondue'}"
      ${position === index ? 'aria-current="step"' : ''} class="${position === index ? 'primary' : item.answer === null ? '' : 'selected'}"
      data-action="jump" data-index="${position}">${position + 1}</button>`).join('')}</nav></section>`;
}

function resultView() {
  const { questions, expired } = data.exam;
  const correct = questions.filter(question => question.options[question.answer]?.correct).length;
  return `<section class="card"><button data-action="home">Accueil</button>
    <h1 style="margin-top:16px">${correct}/40 · ${correct >= 32 ? 'Seuil atteint' : 'Seuil non atteint'}</h1>
    <p>${expired ? 'Temps écoulé. ' : ''}Seuil de réussite : 32 bonnes réponses.</p>
    <h2>Correction</h2>${questions.map((question, index) => {
      const choice = question.options[question.answer];
      const status = choice ? (choice.correct ? 'Correct' : 'Incorrect') : 'Sans réponse';
      return `<details><summary>${index + 1}. ${escape(question.prompt)} · ${status}</summary>
        ${favoriteButton(question)}
        <p>Votre réponse : ${escape(choice?.text ?? '—')}<br>Bonne réponse :
        ${escape(question.options.find(option => option.correct).text)}</p>${explanationMarkup(question)}</details>`;
    }).join('')}</section>`;
}

function render() {
  const favoritesOpen = app.querySelector('.favorites-list')?.open;
  app.innerHTML = { home, practice: practiceView, exam: examView, result: resultView }[screen]();
  if (screen === 'home' && favoritesOpen) {
    const list = app.querySelector('.favorites-list');
    if (list) list.open = true;
  }
  if (screen === 'exam') updateClock();
}

function startPractice(practiceFilter) {
  if (practiceFilter === 'all') {
    if (fullPracticeComplete()) return;
    data.fullPractice ??= {
      filter: 'all',
      remaining: shuffle(bank.map(question => question.id)),
      question: null,
      answered: []
    };
    activePractice = data.fullPractice;
  } else {
    if (practiceFilter === 'favorites' && !data.favorites.length) return;
    if (data.practice?.filter !== practiceFilter) {
      data.practice = { filter: practiceFilter, remaining: [], question: null };
    }
    activePractice = data.practice;
  }
  screen = 'practice';
  if (!activePractice.question || (practiceFilter === 'favorites' && !data.favorites.includes(activePractice.question.id))) {
    nextPractice();
  }
}

function nextPractice() {
  const practice = activePractice;
  if (practice.filter === 'all' && !practice.remaining.length) return;
  const filter = practice.filter;
  if (filter === 'favorites') {
    if (!data.favorites.length) {
      screen = 'home';
      return;
    }
    practice.remaining = practice.remaining.filter(id => data.favorites.includes(id));
  }
  if (!practice.remaining.length) {
    const eligible = bank.filter(question => {
      if (filter === 'favorites') return data.favorites.includes(question.id);
      if (filter === 'cases') return isScenario(question);
      return theme(question) === groups[Number(filter)].title;
    });
    practice.remaining = shuffle(eligible.map(question => question.id));
    if (practice.remaining.length > 1 && practice.remaining.at(-1) === practice.question?.id) {
      practice.remaining.unshift(practice.remaining.pop());
    }
  }
  const id = practice.remaining.pop();
  practice.question = createQuestion(questionsById.get(id));
}

function startExam() {
  if (!data.exam || data.exam.finished) {
    const questions = Object.entries(quotas).flatMap(([section, count]) =>
      shuffle(bank.filter(question => question.section === section)).slice(0, count));
    data.exam = { questions: shuffle(questions).map(createQuestion), index: 0, deadline: Date.now() + 45 * 60000 };
  }
  screen = 'exam';
}

function finishExam(expired) {
  data.exam.finished = true;
  data.exam.expired = expired;
  if (screen === 'exam') screen = 'result';
  save();
}

function updateClock() {
  if (!data.exam || data.exam.finished) return;
  const seconds = Math.ceil((data.exam.deadline - Date.now()) / 1000);
  if (seconds <= 0) {
    finishExam(true);
    render();
    return;
  }
  const timer = document.querySelector('#timer');
  if (timer) {
    timer.textContent = [Math.floor(seconds / 60), seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
  }
}

app.addEventListener('change', event => {
  if (event.target.id !== 'theme') return;
  filter = event.target.value;
  app.querySelector('[data-action="practice"]').disabled = filter === 'all' && fullPracticeComplete();
});

app.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  if (screen === 'exam' && Date.now() >= data.exam.deadline) {
    updateClock();
    return;
  }
  const index = Number(button.dataset.index);
  switch (button.dataset.action) {
    case 'home': screen = 'home'; break;
    case 'practice': startPractice(filter); break;
    case 'trainFavorites': startPractice('favorites'); break;
    case 'favorite': {
      if (!questionsById.has(index)) return;
      const starred = !data.favorites.includes(index);
      data.favorites = starred ? [...data.favorites, index] : data.favorites.filter(id => id !== index);
      if (screen !== 'home') {
        button.setAttribute('aria-pressed', starred);
        button.textContent = starred ? '★' : '☆';
        const next = app.querySelector('[data-action="nextPractice"]');
        if (screen === 'practice' && activePractice.filter === 'favorites' && next && activePractice.question.answer === null) {
          next.disabled = starred;
        }
        save();
        return;
      }
      break;
    }
    case 'nextPractice': nextPractice(); break;
    case 'exam': startExam(); break;
    case 'review': screen = 'result'; break;
    case 'resetScore':
      if ((!data.score.total && !data.fullPractice) ||
          !confirm('Réinitialiser le score et recommencer l’entraînement complet depuis le début ?')) return;
      data.score = { correct: 0, total: 0 };
      data.fullPractice = null;
      if (screen === 'practice' && activePractice.filter === 'all') startPractice('all');
      break;
    case 'jump': data.exam.index = index; break;
    case 'finish':
      if (!confirm('Terminer l’examen et afficher la correction ?')) return;
      finishExam(Date.now() >= data.exam.deadline);
      break;
    case 'answer': {
      if (screen === 'exam') {
        data.exam.questions[data.exam.index].answer = index;
      } else if (activePractice.question.answer === null) {
        const question = activePractice.question;
        question.answer = index;
        if (activePractice.filter === 'all') activePractice.answered.push(question.id);
        if (activePractice.filter !== 'favorites') {
          data.score.total++;
          if (question.options[index].correct) data.score.correct++;
        }
      }
      break;
    }
  }
  save();
  render();
});

fetch('questions.json').then(response => {
  if (!response.ok) throw new Error('Question bank could not be loaded');
  return response.json();
}).then(questions => {
  bank = questions;
  for (const [section, count] of Object.entries(quotas)) {
    if (bank.filter(question => question.section === section).length < count) {
      throw new Error(`Insufficient questions for ${section}`);
    }
  }
  questionsById = new Map(bank.map(question => [question.id, question]));
  data.favorites = data.favorites.filter(id => questionsById.has(id));
  if (data.practice?.filter === 'all') {
    const previous = data.practice;
    if (questionsById.has(previous.question?.id) && previous.remaining.every(id => questionsById.has(id))) {
      const pending = new Set(previous.remaining);
      if (previous.question.answer === null) pending.add(previous.question.id);
      data.fullPractice ??= { ...previous, answered: bank.map(question => question.id).filter(id => !pending.has(id)) };
    }
    data.practice = null;
  }
  for (const practice of [data.practice, data.fullPractice]) {
    if (!practice) continue;
    const current = practice.question;
    if (current) {
      const updated = questionsById.get(current.id);
      practice.question = updated ? { ...updated, options: current.options, answer: current.answer } : null;
    }
    practice.remaining = practice.remaining.filter(id => questionsById.has(id));
  }
  if (data.fullPractice) {
    const full = data.fullPractice;
    full.answered = full.answered.filter(id => questionsById.has(id));
    const known = new Set([...full.answered, ...full.remaining, full.question?.id]);
    full.remaining.unshift(...shuffle(bank.map(question => question.id).filter(id => !known.has(id))));
  }
  if (data.exam) {
    for (const question of data.exam.questions) {
      const updated = questionsById.get(question.id);
      if (updated?.explanation) question.explanation = updated.explanation;
    }
  }
  save();
  filter = data.practice?.filter === 'favorites' ? 'all' : data.practice?.filter ?? 'all';
  if (data.exam && !data.exam.finished && Date.now() >= data.exam.deadline) finishExam(true);
  render();
  setInterval(updateClock, 250);
}).catch(error => {
  console.error(error);
  app.textContent = 'Impossible de charger les questions. Ouvrez le quiz via un serveur HTTP local.';
});
