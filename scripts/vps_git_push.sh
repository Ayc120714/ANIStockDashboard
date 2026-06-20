#!/usr/bin/env bash
# Push stockdashboard (ANIStockDashboard) to GitHub from the VPS.
# Fixes SSH passphrase prompts when the key is loaded into ssh-agent.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

unset GIT_ASKPASS SSH_ASKPASS GIT_ASKPASS_MAIN 2>/dev/null || true

if ! git remote get-url origin | grep -q 'github.com.*ANIStockDashboard'; then
  git remote set-url origin git@github.com:Ayc120714/ANIStockDashboard.git
fi

if [[ ! -f "$HOME/.ssh/config" ]] && [[ -f "$HOME/.ssh/.config" ]]; then
  cp "$HOME/.ssh/.config" "$HOME/.ssh/config"
  chmod 600 "$HOME/.ssh/config"
fi

if ! ssh-add -l 2>/dev/null | grep -q ed25519; then
  if [[ -z "${SSH_AUTH_SOCK:-}" ]] || ! ssh-add -l >/dev/null 2>&1; then
    eval "$(ssh-agent -s)" >/dev/null
  fi
  echo "Loading SSH key (enter passphrase if prompted)..."
  ssh-add "$HOME/.ssh/id_ed25519"
fi

echo "Testing GitHub SSH..."
# ssh -T exits 1 even on success; capture output instead of pipefail on the pipeline.
ssh_out="$(ssh -T git@github.com 2>&1)" || true
echo "$ssh_out"
if ! echo "$ssh_out" | grep -qE 'successfully authenticated|Hi '; then
  echo "ERROR: GitHub SSH auth failed."
  echo "  1. Add this public key to GitHub → Settings → SSH keys (or repo Deploy keys):"
  cat "$HOME/.ssh/id_ed25519.pub"
  echo "  2. Or use HTTPS with a Personal Access Token:"
  echo "     git remote set-url origin https://github.com/Ayc120714/ANIStockDashboard.git"
  echo "     git push origin main   # username: Ayc120714, password: ghp_... token"
  exit 1
fi

echo "Commits to push:"
git log origin/main..HEAD --oneline 2>/dev/null || git log -3 --oneline

echo "Pushing to origin main..."
git push origin main
echo "Done."
