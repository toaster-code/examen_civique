# Quiz civique CR

Extract the archive and run this command inside the quiz folder:

```bash
python -m http.server 8000
```

Open http://localhost:8000. On Windows, use `py -m http.server 8000` if needed.
All files can also be served by any static web host.

The French demo bank is in `questions.json`. Each entry has a unique numeric ID,
a section from the quotas in `app.js`, one prompt, an array of equivalent
correct formulations, and at least three groups of distinct wrong answers.
Each group can contain alternative phrasings of the same wrong answer.
The browser keeps the practice score and the last mock exam locally.

The demo bank follows the distribution in Article 3 of the order of
10 October 2025. It contains original practice material and does not cover
the full official list. Training scenarios are authored for this quiz.
