# Python review checklist

- Is the chosen Python sub-domain/framework appropriate?
- Is configuration centralized and environment-driven?
- Are types present for new/edited public functions?
- Is I/O separated from core logic?
- Are tests close to the changed behavior?
- For web: are handlers thin and boundaries clear?
- For desktop: is background work off the UI thread?
- For CLI: are exit codes and output deterministic?
- For ML: is preprocessing shared safely between train and inference?
- Were Ruff, pytest, and mypy or equivalent checks run?
