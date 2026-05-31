#!/usr/bin/env bash
#
# clone_repos.sh — shallow-clone open-source repos as local, read-only
# bug-report test targets for AgentGuard.
#
# Safety notes:
#   * Pure read-only copies. Nothing here forks, opens issues, or pushes.
#   * After each clone we DISABLE the push URL so an accidental `git push`
#     fails loudly instead of ever reaching an upstream project.
#   * Clones land in ./repos/ which is .gitignore'd out of AgentGuard.
#
# Usage:  bash clone_repos.sh
#
set -uo pipefail

DEST="repos"
mkdir -p "$DEST"

# 40 repos with rich, well-labeled public bug histories across languages.
REPOS=(
  # --- Python ---
  https://github.com/psf/requests.git
  https://github.com/pallets/flask.git
  https://github.com/pandas-dev/pandas.git
  https://github.com/numpy/numpy.git
  https://github.com/django/django.git
  https://github.com/scikit-learn/scikit-learn.git
  https://github.com/pytest-dev/pytest.git
  https://github.com/psf/black.git
  https://github.com/tiangolo/fastapi.git
  https://github.com/pydantic/pydantic.git
  https://github.com/python-pillow/Pillow.git
  https://github.com/sqlalchemy/sqlalchemy.git
  https://github.com/urllib3/urllib3.git
  https://github.com/yaml/pyyaml.git
  # --- JavaScript / TypeScript ---
  https://github.com/lodash/lodash.git
  https://github.com/expressjs/express.git
  https://github.com/sindresorhus/got.git
  https://github.com/sveltejs/svelte.git
  https://github.com/vuejs/core.git
  https://github.com/facebook/react.git
  https://github.com/vercel/next.js.git
  https://github.com/webpack/webpack.git
  https://github.com/babel/babel.git
  https://github.com/prettier/prettier.git
  https://github.com/date-fns/date-fns.git
  https://github.com/chartjs/Chart.js.git
  https://github.com/moment/moment.git
  # --- Go ---
  https://github.com/gin-gonic/gin.git
  https://github.com/spf13/cobra.git
  https://github.com/sirupsen/logrus.git
  https://github.com/gorilla/mux.git
  # --- Rust ---
  https://github.com/serde-rs/serde.git
  https://github.com/clap-rs/clap.git
  https://github.com/tokio-rs/tokio.git
  https://github.com/BurntSushi/ripgrep.git
  https://github.com/sharkdp/bat.git
  # --- C / C++ ---
  https://github.com/nlohmann/json.git
  https://github.com/fmtlib/fmt.git
  https://github.com/jqlang/jq.git
  # --- extra ---
  https://github.com/pallets/click.git
)

total=${#REPOS[@]}
cloned=0; skipped=0; failed=0
i=0

echo "Cloning $total repos into ./$DEST/ (shallow, push-disabled)..."
echo

for url in "${REPOS[@]}"; do
  i=$((i + 1))
  name="$(basename "$url" .git)"
  target="$DEST/$name"
  printf "[%2d/%2d] %-16s " "$i" "$total" "$name"

  if [ -d "$target/.git" ]; then
    # Already cloned — still (re)assert the push guardrail in case it
    # was cloned outside this script.
    git -C "$target" remote set-url --push origin DISABLED 2>/dev/null
    echo "skip (already present, push disabled)"
    skipped=$((skipped + 1))
    continue
  fi

  if git clone --depth 1 --quiet "$url" "$target" 2>/dev/null; then
    # Disable pushing so this copy can never reach upstream.
    git -C "$target" remote set-url --push origin DISABLED 2>/dev/null
    echo "ok"
    cloned=$((cloned + 1))
  else
    echo "FAILED"
    failed=$((failed + 1))
  fi
done

echo
echo "Done. cloned=$cloned  skipped=$skipped  failed=$failed  (total=$total)"
[ "$failed" -gt 0 ] && echo "Re-run the script to retry any failed clones."
exit 0
