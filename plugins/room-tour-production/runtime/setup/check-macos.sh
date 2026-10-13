#!/bin/bash
# Read-only bootstrap check. Compatible with the system Bash 3.2 on macOS.
# Installer commands below are printed for the user; none are executed.
# Sources: https://nodejs.org/en/download
# https://docs.blender.org/manual/en/latest/getting_started/installing/macos.html
# https://git-scm.com/downloads/
set -u

shell_quote() {
  local quoted_value="$1"
  quoted_value=${quoted_value//\'/\'\\\'\'}
  printf "'%s'" "$quoted_value"
}

blender_override=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --blender)
      if [ "$#" -lt 2 ] || [ -z "$2" ]; then
        printf 'ERROR: --blender requires an executable path.\n' >&2
        exit 2
      fi
      blender_override="$2"
      shift 2
      ;;
    --help|-h)
      printf 'Usage: bash setup/check-macos.sh [--blender "/path/to/Blender"]\n'
      printf 'Read-only: checks macOS, Node >=22, npm, Blender 5.1.x and optional Git.\n'
      printf 'BLENDER_BIN is also accepted. Exit 0=ready, 1=missing, 2=usage/OS.\n'
      exit 0
      ;;
    *)
      printf 'ERROR: unknown argument: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

if [ "$(uname -s)" != 'Darwin' ]; then
  printf 'ERROR: macOS用です。Windowsでは setup/check-windows.ps1 を実行してください。\n' >&2
  exit 2
fi

runtime_dir="$(cd "$(dirname "$0")/.." && pwd)"
required_missing=0
node_ok=0
npm_ok=0
blender_ok=0
git_ok=0
printf 'Room Tour Production: 読み取り専用の生成環境チェック\n'
printf 'OS: macOS %s (%s)\n' "$(sw_vers -productVersion)" "$(uname -m)"

node_path="$(command -v node 2>/dev/null || true)"
node_version=""
if [ -n "$node_path" ]; then
  node_version="$("$node_path" --version 2>/dev/null)" || node_version=""
  if [[ "$node_version" =~ ^v([0-9]+)\.([0-9]+)\.([0-9]+)$ ]] && [ "${BASH_REMATCH[1]}" -ge 22 ]; then
    node_ok=1
    printf 'OK Node: %s (%s)\n' "$node_version" "$node_path"
  else
    printf '不足 Node: 22以上の安定版が必要です。検出=%s (%s)\n' "${node_version:-実行失敗}" "$node_path"
  fi
else
  printf '不足 Node: 未検出。22以上の安定版が必要です。\n'
fi
[ "$node_ok" -eq 1 ] || required_missing=$((required_missing + 1))

npm_path="$(command -v npm 2>/dev/null || true)"
npm_version=""
if [ -n "$npm_path" ] && [ -n "$node_path" ]; then
  npm_version="$(npm_config_update_notifier=false "$npm_path" --version 2>/dev/null)" || npm_version=""
  if [[ "$npm_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    npm_ok=1
    printf 'OK npm: %s (%s)\n' "$npm_version" "$npm_path"
  fi
fi
if [ "$npm_ok" -ne 1 ]; then
  printf '不足 npm: 未検出または実行失敗。Node公式インストーラーのnpm同梱版を使用してください。\n'
  required_missing=$((required_missing + 1))
fi

blender_candidates=()
if [ -n "$blender_override" ]; then
  blender_candidates=("$blender_override")
elif [ -n "${BLENDER_BIN:-}" ]; then
  blender_candidates=("$BLENDER_BIN")
else
  blender_candidates=(
    '/Applications/Blender.app/Contents/MacOS/Blender'
    '/Applications/Blender 5.1.app/Contents/MacOS/Blender'
    "${HOME}/Applications/Blender.app/Contents/MacOS/Blender"
    "${HOME}/Applications/Blender 5.1.app/Contents/MacOS/Blender"
  )
  path_blender="$(command -v blender 2>/dev/null || true)"
  [ -z "$path_blender" ] || blender_candidates+=("$path_blender")
  for installed in /Applications/Blender*.app/Contents/MacOS/Blender "${HOME}"/Applications/Blender*.app/Contents/MacOS/Blender; do
    [ ! -x "$installed" ] || blender_candidates+=("$installed")
  done
fi
blender_path=""
for candidate in "${blender_candidates[@]}"; do
  case "$candidate" in
    *.app) candidate="$candidate/Contents/MacOS/Blender" ;;
  esac
  [ -x "$candidate" ] || continue
  blender_version="$("$candidate" --version 2>/dev/null)" || blender_version=""
  first_line="${blender_version%%$'\n'*}"
  if [[ "$first_line" =~ ^Blender[[:space:]]+5\.1\.[0-9]+([[:space:]].*)?$ ]]; then
    blender_path="$candidate"
    blender_ok=1
    printf 'OK Blender: %s\nBlender executable: %s\n' "$first_line" "$blender_path"
    break
  fi
  printf '参考 Blender: %s (%s) は5.1系として検証できませんでした。\n' "${first_line:-実行失敗}" "$candidate"
done
if [ "$blender_ok" -ne 1 ]; then
  printf '不足 Blender: 5.1.xが必要です。指定path、標準appまたはPATHを確認してください。\n'
  required_missing=$((required_missing + 1))
fi

git_path="$(command -v git 2>/dev/null || true)"
if [ -n "$git_path" ]; then
  # Apple's /usr/bin/git can otherwise trigger an installation dialog on a new Mac.
  if [ "$git_path" != '/usr/bin/git' ] || /usr/bin/xcode-select -p >/dev/null 2>&1; then
    git_version="$("$git_path" --version 2>/dev/null)" || git_version=""
    if [ -n "$git_version" ]; then
      git_ok=1
      printf 'OK Git (任意): %s (%s)\n' "$git_version" "$git_path"
    fi
  fi
fi
if [ "$git_ok" -ne 1 ]; then
  printf '任意 Git: 未検出。GitHubからZIPを取得した場合は不要です。\n'
fi

if [ "$node_ok" -ne 1 ] || [ "$npm_ok" -ne 1 ]; then
  printf '\nNode/npm導入: https://nodejs.org/en/download\n'
  printf '  Node 22以上のLTS、macOS Installer (.pkg)を選びます。\n'
  printf "  open 'https://nodejs.org/en/download'\n"
  printf '  ダウンロードした.pkgを開いてインストールし、ターミナルを開き直してください。\n'
fi
if [ "$blender_ok" -ne 1 ]; then
  printf '\nBlender導入: https://www.blender.org/download/\n'
  printf '  本プラグイン用の5.1系: https://download.blender.org/release/Blender5.1/\n'
  printf "  open 'https://download.blender.org/release/Blender5.1/'\n"
  printf '  CPUに対応する.dmgを開き、Blender.appをApplicationsへドラッグしてください。\n'
  printf '  初回起動のmacOS確認を済ませてから再チェックしてください。\n'
  printf '  別名で共存する場合: bash setup/check-macos.sh --blender "/path/Blender.app/Contents/MacOS/Blender"\n'
fi
if [ "$git_ok" -ne 1 ]; then
  printf '\nGit導入 (任意): https://git-scm.com/downloads/\n'
  printf '  Apple Command Line Toolsで導入する場合、人が次を実行します: xcode-select --install\n'
fi

printf '\nCodexプラグインの導入はREADMEの手順で確認してください。ここでは導入済みか判定しません。\n'
if [ "$node_ok" -eq 1 ] && [ "$npm_ok" -eq 1 ]; then
  printf 'OSごとにnpm依存を導入し、その後に全依存チェックを実行します:\n  cd '
  shell_quote "$runtime_dir"
  printf '\n'
  printf '  npm ci --ignore-scripts\n  node scripts/doctor.mjs'
  if [ "$blender_ok" -eq 1 ]; then
    printf ' --blender '
    shell_quote "$blender_path"
  fi
  printf '\n'
fi
if [ "$required_missing" -gt 0 ]; then
  printf '\nRESULT: MISSING (%s required checks). 導入後にこのチェックを再実行してください。\n' "$required_missing"
  exit 1
fi
printf '\nRESULT: READY (生成用ソフト)。npm依存の確認はdoctor.mjsで行います。\n'
exit 0
