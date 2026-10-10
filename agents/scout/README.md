# Scout

Scout is the docs assistant for Lumen, a fictional product analytics SaaS. It is the second agent
Night Shift watches, and it is wired the way a customer's agent would be:

- **neatlogs** traces every answer (workflow `scout-answers`, root span `scout_answer`, one span per tool call)
- the **Night Shift SDK** gives it its live release, model, step cap and kill switches, takes its deploy
  reports and graded outcomes, and runs verification replays
- nothing in Scout imports Night Shift's code

```bash
export NIGHTSHIFT_API_URL=https://<api>   NIGHTSHIFT_AGENT_TOKEN=nsa_...
uv run --project ../../backend python scout.py eval              # offline eval over questions.yaml
uv run --project ../../backend python scout.py deploy s1         # report a deploy
uv run --project ../../backend python scout.py serve --rate 6    # traffic + replay worker
```

Releases live in `releases/`. A release picks the model, retriever, `top_k`, step budget and prompt;
the code for every retriever ships together, so rolling back is a control-plane change.
