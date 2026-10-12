#!/bin/bash
# Arranque de las sesiones en la nube: plugins de Claude Code y dependencias de la investigación de la Mesa Radar.
set -euo pipefail
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then exit 0; fi

# Plugins (scope user: disponibles en toda la sesión, también fuera del repo). Idempotente.
MK=anthropic-plugin-directory
for p in claude-code-setup task-observer-learn-your-preferences headroom-large-file-and-log-reader; do
  claude plugin install "$p@$MK" --scope user >/dev/null 2>&1 || echo "aviso: no se pudo instalar $p" >&2
done

# Dependencias de research/ (backtests, walk-forward con LightGBM).
python3 -c "import numpy, lightgbm, sklearn" 2>/dev/null || pip install -q numpy lightgbm scikit-learn >/dev/null 2>&1 || echo "aviso: pip falló" >&2
exit 0
