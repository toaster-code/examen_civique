# Quiz civique CR

[**Jouer au quiz en ligne**](https://toaster-code.github.io/examen_civique/)

Entraînement par thème et examen blanc pour la carte de résident. Le quiz contient
les 209 questions de connaissance publiées par le ministère de l’Intérieur et
12 mises en situation originales. Le ministère ne publie pas les mises en
situation de l’épreuve.

## Run locally

From the repository directory:

```bash
python -m http.server 8000
```

Open http://localhost:8000. On Windows, use `py -m http.server 8000` if needed.

## Question bank

The browser selects one correct formulation and three distinct distractors.
Exact quotations, fixed expressions and some short answers have a single
formulation. Explanations are shown after each practice answer or after submitting
the mock exam. Some official prompts, such as questions about euro adoption
or the ranking of languages, include a correction that explains the date or
definition used.

- Additional practice: [Prépa-Examen — Questions et corrigés CR](https://www.prepa-examen.fr/question/cr/).
- Official prompts: [Ministère de l’Intérieur — Liste officielle CR](https://formation-civique.interieur.gouv.fr/examen-civique/liste-officielle-des-questions-de-connaissance-cr/).
- Exam distribution: [Arrêté du 10 octobre 2025, article 3](https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000052382287).
- Adapted answers, distractors and explanations: [Prépa-Examen, dataset published on data.gouv.fr](https://www.data.gouv.fr/datasets/examen-civique-carte-de-resident-cr-questions-officielles-reponses-et-explications), updated 4 November 2026, [Licence Ouverte 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence/). The quiz reviews and supplements this third-party material. The answer choices are for practice.
