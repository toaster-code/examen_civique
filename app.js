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
let screen = 'home';
let filter = 'all';
let data = { score: { correct: 0, total: 0 }, exam: null, practice: null };
try {
  data = JSON.parse(localStorage.getItem(key)) ?? data;
} catch {}

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

function theme(question) {
  return themeBySection.get(question.section);
}

function scoreText() {
  const label = data.score.correct === 1 ? 'bonne réponse' : 'bonnes réponses';
  return `${data.score.correct} ${label} sur ${data.score.total}`;
}

function home() {
  const examLabel = !data.exam ? 'Commencer' : data.exam.finished ? 'Nouvel examen' : 'Reprendre l’examen';
  return `<h1>Préparez l’examen civique</h1>
    <p>${bank.filter(question => question.official).length} questions officielles de connaissance · ${bank.filter(question => !question.official).length} mises en situation d’entraînement</p>
    <div class="grid">
    <section class="card"><h2>Entraînement</h2><p>Correction immédiate, sans limite de temps.</p>
    <p><strong>${scoreText()}</strong></p>
    <label for="theme">Thème</label><select id="theme"><option value="all">Tous les thèmes</option>
    ${groups.map((group, index) => `<option value="${index}" ${filter === String(index) ? 'selected' : ''}>${group.title}</option>`).join('')}
    </select><button class="primary" data-action="practice">S’entraîner</button></section>
    <section class="card"><h2>Examen blanc</h2><p>40 questions · 45 minutes · seuil de réussite 32/40.</p>
    <p>28 questions de connaissance et 12 mises en situation d’entraînement.</p>
    <button class="primary" data-action="exam">${examLabel}</button>
    ${data.exam?.finished ? '<button data-action="review">Dernier résultat</button>' : ''}
    </section></div>`;
}

function questionMarkup(question, practice) {
  return `<h2>${escape(question.prompt)}</h2><div class="answers">${question.options.map((option, index) => {
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
  const question = data.practice.question;
  const answered = question.answer !== null;
  return `<section class="card"><div class="row"><button data-action="home">Accueil</button>
    <p class="meta">${scoreText()}</p></div><p class="meta">${theme(question)}</p>
    ${questionMarkup(question, true)}
    ${answered ? `<p role="status"><strong>${question.options[question.answer].correct ? 'Bonne réponse.' : 'Réponse incorrecte.'}</strong>
      ${escape(question.options.find(option => option.correct).text)}</p>${explanationMarkup(question)}` : ''}
    <button class="primary" data-action="nextPractice" ${answered ? '' : 'disabled'}>Question suivante</button></section>`;
}

function examView() {
  const { questions, index } = data.exam;
  const question = questions[index];
  const answered = questions.filter(item => item.answer !== null).length;
  return `<section class="card"><div class="row"><button data-action="home">Accueil</button><span id="timer"></span></div>
    <p class="meta">Question ${index + 1} / 40 · ${answered} faites · ${theme(question)}</p>
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
        <p>Votre réponse : ${escape(choice?.text ?? '—')}<br>Bonne réponse :
        ${escape(question.options.find(option => option.correct).text)}</p>${explanationMarkup(question)}</details>`;
    }).join('')}</section>`;
}

function render() {
  app.innerHTML = { home, practice: practiceView, exam: examView, result: resultView }[screen]();
  if (screen === 'exam') updateClock();
}

function startPractice() {
  if (data.practice?.filter !== filter) data.practice = { filter, remaining: [], question: null };
  if (!data.practice.question) nextPractice();
  screen = 'practice';
}

function nextPractice() {
  const practice = data.practice;
  if (!practice.remaining.length) {
    const eligible = bank.filter(question => filter === 'all' || theme(question) === groups[Number(filter)].title);
    practice.remaining = shuffle(eligible.map(question => question.id));
    if (practice.remaining.length > 1 && practice.remaining.at(-1) === practice.question?.id) {
      practice.remaining.unshift(practice.remaining.pop());
    }
  }
  const id = practice.remaining.pop();
  practice.question = createQuestion(bank.find(question => question.id === id));
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
  if (event.target.id === 'theme') filter = event.target.value;
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
    case 'practice': startPractice(); break;
    case 'nextPractice': nextPractice(); break;
    case 'exam': startExam(); break;
    case 'review': screen = 'result'; break;
    case 'jump': data.exam.index = index; break;
    case 'finish':
      if (!confirm('Terminer l’examen et afficher la correction ?')) return;
      finishExam(Date.now() >= data.exam.deadline);
      break;
    case 'answer': {
      if (screen === 'exam') {
        data.exam.questions[data.exam.index].answer = index;
      } else if (data.practice.question.answer === null) {
        const question = data.practice.question;
        question.answer = index;
        data.score.total++;
        if (question.options[index].correct) data.score.correct++;
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
  const questionsById = new Map(bank.map(question => [question.id, question]));
  if (data.practice) {
    const current = data.practice.question;
    if (current) {
      const updated = questionsById.get(current.id);
      data.practice.question = updated ? { ...updated, options: current.options, answer: current.answer } : null;
    }
    data.practice.remaining = data.practice.remaining.filter(id => questionsById.has(id));
  }
  if (data.exam) {
    for (const question of data.exam.questions) {
      const updated = questionsById.get(question.id);
      if (updated?.explanation) question.explanation = updated.explanation;
    }
  }
  save();
  filter = data.practice?.filter ?? 'all';
  if (data.exam && !data.exam.finished && Date.now() >= data.exam.deadline) finishExam(true);
  render();
  setInterval(updateClock, 250);
}).catch(error => {
  console.error(error);
  app.textContent = 'Impossible de charger les questions. Ouvrez le quiz via un serveur HTTP local.';
});
