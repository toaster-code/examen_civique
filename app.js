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
let reportingQuestion;
let screen = 'home';
let filter = 'all';
let data = { score: { correct: 0, total: 0 }, exam: null };
try {
  data = JSON.parse(localStorage.getItem(key)) ?? data;
} catch {}
data.favorites ??= [];
data.practiceRuns ??= {};
data.reports ??= [];

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
  const disabled = data.score.total === 0 && !Object.keys(data.practiceRuns).length ? ' disabled' : '';
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
    ${count ? `<button class="primary" data-action="trainFavorites" ${practiceComplete(data.practiceRuns.favorites) ? 'disabled' : ''}>S’entraîner sur les favoris</button>
    ${practiceComplete(data.practiceRuns.favorites) ? `<p class="meta">${practiceEndMessage}</p>` : ''}
    <details class="favorites-list"><summary>Voir les questions favorites</summary>
    <ul>${favorites.map(question => `<li class="favorite-item">
      <span>${escape(question.prompt)}</span>
      <button data-action="favorite" data-index="${question.id}"
        aria-label="Retirer des favoris : ${escape(question.prompt)}">Retirer</button>
    </li>`).join('')}</ul></details>` : '<p>Ajoutez une question à vos favoris en touchant son étoile.</p>'}
    </section>`;
}

function reportButton(question) {
  return `<div class="report-control"><button data-action="report" data-index="${question.id}">Signaler</button>
    <span id="report-status-${question.id}" class="meta" role="status"></span></div>`;
}

function reportDialog() {
  return `<dialog id="report-dialog" aria-labelledby="report-title">
    <form id="report-form">
      <h2 id="report-title">Signaler une question</h2>
      <p>Les choix affichés seront enregistrés pour la révision.</p>
      <label for="report-note">Quel problème avez-vous remarqué ? (facultatif)</label>
      <textarea id="report-note" name="note" rows="3" maxlength="1000"></textarea>
      <div class="row">
        <button type="button" data-action="cancelReport">Annuler</button>
        <button class="primary" type="submit">Enregistrer</button>
      </div>
    </form>
    </dialog>`;
}

function reportsView() {
  return `<section class="card"><button data-action="home">Accueil</button>
    <h2>Signalements (${data.reports.length})</h2>
    ${data.reports.length ? data.reports.map((report, index) => `<details>
      <summary>${escape(report.prompt)}</summary>
      <p class="meta">Question n° ${report.questionId}</p>
      <ul>${report.options.map((option, position) => `<li>${'ABCD'[position]}. ${escape(option.text)}
        ${option.correct ? '<strong> · Indiquée comme correcte</strong>' : ''}
        ${position === report.answer ? ' · Votre choix' : ''}</li>`).join('')}</ul>
      ${report.explanation ? `<p><strong>Explication du quiz</strong><br>${escape(report.explanation)}</p>` : ''}
      ${report.note ? `<p><strong>Votre remarque</strong><br>${escape(report.note)}</p>` : ''}
      <button data-action="removeReport" data-index="${index}">Supprimer le signalement</button>
    </details>`).join('') : '<p>Aucune question signalée.</p>'}
    </section>`;
}

const practiceEndMessage = 'Entraînement terminé. Réinitialisez le score pour recommencer.';

function eligibleQuestions(practiceFilter) {
  if (practiceFilter === 'all') return bank;
  if (practiceFilter === 'favorites') return bank.filter(question => data.favorites.includes(question.id));
  if (practiceFilter === 'cases') return bank.filter(isScenario);
  if (practiceFilter === 'supplemental') return bank.filter(question => question.supplemental);
  return bank.filter(question => theme(question) === groups[Number(practiceFilter)]?.title);
}

function practiceComplete(practice) {
  return !!practice && !practice.remaining.length &&
    (practice.question?.answer !== null ||
      (practice.filter === 'favorites' && !data.favorites.includes(practice.question?.id)));
}

function fullPracticeStatus() {
  const answered = data.practiceRuns.all?.answered.length ?? 0;
  return `Entraînement complet · ${answered} / ${bank.length} questions traitées`;
}

function home() {
  const examLabel = !data.exam ? 'Commencer' : data.exam.finished ? 'Nouvel examen' : 'Reprendre l’examen';
  return `<h1>Préparez l’examen civique</h1>
    <p>${bank.filter(question => question.official).length} questions officielles de connaissance · ${bank.filter(isScenario).length} mises en situation d’entraînement · ${bank.filter(question => question.supplemental).length} questions complémentaires</p>
    <div class="grid">
    <section class="card"><h2>Entraînement</h2><p>Correction immédiate, sans limite de temps.</p>
    <div class="row"><p><strong>${scoreText()}</strong></p>${resetScoreButton()}</div>
    <label for="theme">Thème ou type de question</label><select id="theme"><option value="all" ${filter === 'all' ? 'selected' : ''}>Tous les thèmes (entraînement complet)</option>
    <option value="supplemental" ${filter === 'supplemental' ? 'selected' : ''}>Questions complémentaires</option>
    <option value="cases" ${filter === 'cases' ? 'selected' : ''}>Mises en situation</option>
    ${groups.map((group, index) => `<option value="${index}" ${filter === String(index) ? 'selected' : ''}>${group.title}</option>`).join('')}
    </select><button class="primary" data-action="practice"
    ${practiceComplete(data.practiceRuns[filter]) ? 'disabled' : ''}>S’entraîner</button>
    <p class="meta" id="practice-end" ${practiceComplete(data.practiceRuns[filter]) ? '' : 'hidden'}>${practiceEndMessage}</p>
    <p class="meta">${fullPracticeStatus()}</p></section>
    <section class="card"><h2>Examen blanc</h2><p>40 questions · 45 minutes · seuil de réussite 32/40.</p>
    <p>28 questions de connaissance et 12 mises en situation d’entraînement.</p>
    <button class="primary" data-action="exam">${examLabel}</button>
    ${data.exam?.finished ? '<button data-action="review">Dernier résultat</button>' : ''}
    </section></div>${favoritesView()}
    <section class="card"><h2>Signalements <span class="meta">(${data.reports.length})</span></h2>
    <button data-action="reports">Analyser les questions signalées</button></section>`;
}

function questionMarkup(question, practice) {
  return `<div class="question-heading"><h2>${escape(question.prompt)}</h2>${favoriteButton(question)}</div><div class="answers">${question.options.map((option, index) => {
    const locked = practice && question.answer !== null;
    const style = locked && option.correct ? 'good' :
      question.answer === index ? (locked ? 'bad' : 'selected') : '';
    return `<button class="option ${style}" data-action="answer" data-index="${index}"
      aria-pressed="${question.answer === index}" ${locked ? 'disabled' : ''}>
      <strong>${'ABCD'[index]}.</strong> ${escape(option.text)}</button>`;
  }).join('')}${reportButton(question)}</div>`;
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
    ${practiceComplete(activePractice) ? `<p class="meta" role="status">${practiceEndMessage}</p>` : `<button class="primary" data-action="nextPractice"
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
        ${favoriteButton(question)} ${reportButton(question)}
        <p>Votre réponse : ${escape(choice?.text ?? '—')}<br>Bonne réponse :
        ${escape(question.options.find(option => option.correct).text)}</p>${explanationMarkup(question)}</details>`;
    }).join('')}</section>`;
}

function render() {
  const favoritesOpen = app.querySelector('.favorites-list')?.open;
  const view = { home, practice: practiceView, exam: examView, result: resultView, reports: reportsView }[screen];
  const canReport = screen === 'practice' || screen === 'exam' || screen === 'result';
  app.innerHTML = view() + (canReport ? reportDialog() : '');
  if (screen === 'home' && favoritesOpen) {
    const list = app.querySelector('.favorites-list');
    if (list) list.open = true;
  }
  if (screen === 'exam') updateClock();
}

function refreshPractice(practice) {
  const eligible = new Set(eligibleQuestions(practice.filter).map(question => question.id));
  practice.remaining = practice.remaining.filter(id => eligible.has(id));
  const known = new Set([...practice.answered, ...practice.remaining, practice.question?.id]);
  const additions = [...eligible].filter(id => !known.has(id));
  practice.remaining.unshift(...additions.reverse());
}

function startPractice(practiceFilter) {
  const eligible = eligibleQuestions(practiceFilter);
  if (!eligible.length || practiceComplete(data.practiceRuns[practiceFilter])) return;
  data.practiceRuns[practiceFilter] ??= {
    filter: practiceFilter,
    remaining: shuffle(eligible.map(question => question.id)),
    question: null,
    answered: []
  };
  activePractice = data.practiceRuns[practiceFilter];
  screen = 'practice';
  if (!activePractice.question ||
      (practiceFilter === 'favorites' && !data.favorites.includes(activePractice.question.id))) {
    nextPractice();
  }
}

function nextPractice() {
  if (!activePractice.remaining.length) return;
  activePractice.question = createQuestion(questionsById.get(activePractice.remaining.pop()));
}

function startExam() {
  if (!data.exam || data.exam.finished) {
    const questions = Object.entries(quotas).flatMap(([section, count]) =>
      shuffle(bank.filter(question => question.section === section && !question.supplemental)).slice(0, count));
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
  data.practiceFilter = filter;
  const completed = practiceComplete(data.practiceRuns[filter]);
  app.querySelector('[data-action="practice"]').disabled = completed;
  app.querySelector('#practice-end').hidden = !completed;
  save();
});

app.addEventListener('submit', event => {
  if (event.target.id !== 'report-form') return;
  event.preventDefault();
  const { id, prompt, options, answer, explanation } = reportingQuestion;
  const note = event.target.elements.note.value.trim();
  data.reports.push({ questionId: id, prompt, options, answer, explanation, note });
  save();
  app.querySelector('#report-dialog').close();
  app.querySelector(`#report-status-${id}`).textContent = 'Signalement enregistré.';
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
    case 'reports': screen = 'reports'; break;
    case 'removeReport':
      if (!confirm('Supprimer ce signalement ?')) return;
      data.reports.splice(index, 1);
      break;
    case 'report': {
      reportingQuestion = screen === 'practice'
        ? activePractice.question
        : data.exam.questions.find(question => question.id === index);
      const dialog = app.querySelector('#report-dialog');
      dialog.querySelector('form').reset();
      app.querySelector(`#report-status-${index}`).textContent = '';
      dialog.showModal();
      return;
    }
    case 'cancelReport':
      app.querySelector('#report-dialog').close();
      return;
    case 'favorite': {
      if (!questionsById.has(index)) return;
      const starred = !data.favorites.includes(index);
      data.favorites = starred ? [...data.favorites, index] : data.favorites.filter(id => id !== index);
      if (data.practiceRuns.favorites) refreshPractice(data.practiceRuns.favorites);
      if (screen === 'practice' && activePractice.filter === 'favorites') {
        save();
        render();
        app.querySelector('.favorite-star')?.focus();
        return;
      }
      if (screen !== 'home') {
        button.setAttribute('aria-pressed', starred);
        button.textContent = starred ? '★' : '☆';
        save();
        return;
      }
      break;
    }
    case 'nextPractice': nextPractice(); break;
    case 'exam': startExam(); break;
    case 'review': screen = 'result'; break;
    case 'resetScore':
      if ((!data.score.total && !Object.keys(data.practiceRuns).length) ||
          !confirm('Réinitialiser le score et recommencer tous les entraînements depuis le début ?')) return;
      data.score = { correct: 0, total: 0 };
      data.practiceRuns = {};
      if (screen === 'practice') startPractice(activePractice.filter);
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
        if (activePractice.filter !== 'favorites' || data.favorites.includes(question.id)) {
          activePractice.answered.push(question.id);
        }
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
    if (bank.filter(question => question.section === section && !question.supplemental).length < count) {
      throw new Error(`Insufficient questions for ${section}`);
    }
  }
  questionsById = new Map(bank.map(question => [question.id, question]));
  data.favorites = data.favorites.filter(id => questionsById.has(id));
  if (data.practice) {
    const previous = data.practice;
    const pending = new Set(previous.remaining);
    if (previous.question?.answer === null) pending.add(previous.question.id);
    if (previous.question && questionsById.has(previous.question.id) &&
        previous.remaining.every(id => questionsById.has(id))) {
      data.practiceRuns[previous.filter] ??= {
        ...previous,
        answered: eligibleQuestions(previous.filter).map(question => question.id).filter(id => !pending.has(id))
      };
    }
    data.practiceFilter ??= previous.filter;
  }
  if (data.fullPractice) data.practiceRuns.all ??= data.fullPractice;
  delete data.practice;
  delete data.fullPractice;
  for (const practice of Object.values(data.practiceRuns)) {
    const current = practice.question;
    if (current) {
      const updated = questionsById.get(current.id);
      practice.question = updated ? { ...updated, options: current.options, answer: current.answer } : null;
    }
    practice.answered = practice.answered.filter(id => questionsById.has(id));
    refreshPractice(practice);
  }
  if (data.exam) {
    for (const question of data.exam.questions) {
      const updated = questionsById.get(question.id);
      if (updated?.explanation) question.explanation = updated.explanation;
    }
  }
  save();
  filter = data.practiceFilter === 'favorites' ? 'all' : data.practiceFilter ?? 'all';
  if (data.exam && !data.exam.finished && Date.now() >= data.exam.deadline) finishExam(true);
  render();
  setInterval(updateClock, 250);
}).catch(error => {
  console.error(error);
  app.textContent = 'Impossible de charger les questions. Ouvrez le quiz via un serveur HTTP local.';
});
