#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 4 ]]; then
  echo "usage: deploy-server.sh <root> <old-commit> <new-commit> <release-dir>" >&2
  exit 64
fi

root=$1
old_commit=$2
new_commit=$3
release_dir=$4
patch_file="$release_dir/release.patch"
reverse_patch_file="$release_dir/reverse.patch"
objects_file="$release_dir/objects.pack"
short_commit=${new_commit:0:7}
timestamp=$(date +%Y%m%d-%H%M%S)
candidate_image="party-games-app:$short_commit"
rollback_image="party-games-app:pre-$short_commit-$timestamp"
backup_dir="$root/data-backups/pre-$short_commit-$timestamp"
source_applied=0
backup_ready=0
service_stopped=0
rollback_started=0
old_image_id=""

export GIT_NO_LAZY_FETCH=1
export DOCKER_BUILDKIT=1

fail() {
  echo "deploy error: $*" >&2
  return 1
}

audit_database() {
  local image=$1
  local directory=$2
  local file_name=$3
  docker run --rm \
    -v "$directory:/audit:ro" \
    "$image" \
    node --input-type=module -e '
      import { createHash } from "node:crypto";
      import { DatabaseSync } from "node:sqlite";
      const database = new DatabaseSync(`/audit/${process.argv[1]}`, { readOnly: true });
      const count = (sql) => Number(database.prepare(sql).get().count);
      const hash = (sql) => createHash("sha256")
        .update(JSON.stringify(database.prepare(sql).all(), (_key, value) =>
          typeof value === "bigint" ? value.toString() : value))
        .digest("hex");
      console.log(JSON.stringify({
        integrity: database.prepare("PRAGMA integrity_check").get().integrity_check,
        schema: count("SELECT COUNT(*) AS count FROM schema_migrations"),
        users: count("SELECT COUNT(*) AS count FROM users"),
        manorV7: count("SELECT COUNT(*) AS count FROM manor_v7_states"),
        usersHash: hash("SELECT * FROM users ORDER BY id"),
        manorV7Hash: hash("SELECT * FROM manor_v7_states ORDER BY user_id")
      }));
    ' "$file_name"
}

restore_source() {
  if [[ $source_applied -ne 1 ]]; then
    return
  fi
  echo "restoring source to $old_commit" >&2
  git apply --check --index "$reverse_patch_file"
  git apply --index "$reverse_patch_file"
  git update-ref refs/heads/main "$old_commit" "$new_commit"
  git update-ref refs/remotes/origin/main "$old_commit" "$new_commit"
  source_applied=0
}

rollback() {
  local exit_code=$?
  if [[ $rollback_started -eq 1 ]]; then
    echo "rollback encountered an additional error" >&2
    return 0
  fi
  rollback_started=1
  trap - ERR
  set +e
  echo "deployment failed; starting rollback" >&2

  if [[ $service_stopped -eq 1 && -n $old_image_id ]]; then
    docker compose stop app
    if [[ $backup_ready -eq 1 ]]; then
      cp --remove-destination "$backup_dir/party-games.sqlite" "$root/data/party-games.sqlite"
      rm -f "$root/data/party-games.sqlite-wal" "$root/data/party-games.sqlite-shm"
    fi
    docker tag "$old_image_id" party-games-app:latest
  fi

  restore_source
  if [[ $service_stopped -eq 1 && -n $old_image_id ]]; then
    docker compose up -d --no-build --force-recreate app
  fi
  echo "rollback finished; release files remain at $release_dir" >&2
  exit "$exit_code"
}

trap rollback ERR

[[ $root == /* ]] || fail "root must be absolute"
[[ $release_dir == /tmp/* ]] || fail "release directory must be under /tmp"
[[ $old_commit =~ ^[0-9a-f]{40}$ ]] || fail "invalid old commit"
[[ $new_commit =~ ^[0-9a-f]{40}$ ]] || fail "invalid new commit"
[[ -f $patch_file && -f $reverse_patch_file && -f $objects_file ]] || fail "release files missing"

cd "$root"
[[ $(git symbolic-ref --short HEAD) == main ]] || fail "server worktree is not on main"
[[ $(git rev-parse HEAD) == "$old_commit" ]] || fail "server HEAD does not match release base"
[[ $(git rev-parse refs/remotes/origin/main) == "$old_commit" ]] || fail "server origin/main does not match release base"

# Partial clones may have a complete worktree while older blob objects are still promisor-only.
# Materialize the current tracked files locally so validation and rollback never reach GitHub.
git -c core.quotepath=false ls-files | git hash-object -w --stdin-paths > /dev/null
git diff --quiet || fail "server worktree has unstaged tracked changes"
git diff --cached --quiet || fail "server index has staged changes"

data_mount=$(docker inspect party-games-app-1 --format '{{range .Mounts}}{{if eq .Destination "/app/data"}}{{.Type}}|{{.Source}}{{end}}{{end}}')
IFS='|' read -r data_mount_type data_mount_source <<< "$data_mount"
[[ $data_mount_type == bind ]] || fail "app data must use a bind mount"
[[ $(realpath "$data_mount_source") == $(realpath "$root/data") ]] || fail "app data mount does not match $root/data"

mkdir "$backup_dir"
cp .git/index "$backup_dir/git-index-$old_commit"
printf '%s\n' "$old_commit" > "$backup_dir/old-commit.txt"
printf '%s\n' "$new_commit" > "$backup_dir/new-commit.txt"

git index-pack --stdin < "$objects_file"
git cat-file -e "$new_commit^{commit}"
git apply --check --index "$patch_file"
git apply --index "$patch_file"
source_applied=1
git update-ref refs/heads/main "$new_commit" "$old_commit"
git update-ref refs/remotes/origin/main "$new_commit" "$old_commit"

expected_tree=$(git rev-parse "$new_commit^{tree}")
actual_tree=$(git write-tree)
[[ $actual_tree == "$expected_tree" ]] || fail "applied source tree does not match release commit"

node_image=node:24-bookworm-slim
if [[ -f .env ]]; then
  configured_node_image=$(sed -n 's/^NODE_IMAGE=//p' .env | tail -n 1)
  if [[ -n $configured_node_image ]]; then
    node_image=$configured_node_image
  fi
fi

docker build \
  --build-arg "NODE_IMAGE=$node_image" \
  --tag "$candidate_image" \
  .

old_image_id=$(docker inspect party-games-app-1 --format '{{.Image}}')
docker tag "$old_image_id" "$rollback_image"
printf '%s\n' "$old_image_id" > "$backup_dir/old-image-id.txt"
printf '%s\n' "$rollback_image" > "$backup_dir/old-image-tag.txt"

service_stopped=1
docker compose stop app

docker run --rm \
  -v "$root/data:/app/data:ro" \
  -v "$backup_dir:/backup" \
  "$candidate_image" \
  node --input-type=module -e '
    import { backup, DatabaseSync } from "node:sqlite";
    const database = new DatabaseSync("/app/data/party-games.sqlite", { readOnly: true });
    await backup(database, "/backup/party-games.sqlite");
  '

baseline=$(audit_database "$candidate_image" "$backup_dir" party-games.sqlite)
[[ $baseline == *'"integrity":"ok"'* ]] || fail "database backup integrity check failed"
printf '%s\n' "$baseline" > "$backup_dir/baseline.json"
sha256sum "$backup_dir/party-games.sqlite" > "$backup_dir/SHA256SUMS"
backup_ready=1

docker tag "$candidate_image" party-games-app:latest
docker compose up -d --no-build --force-recreate app

healthy=0
for _attempt in $(seq 1 18); do
  health=$(docker inspect party-games-app-1 --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null || true)
  if [[ $health == healthy ]]; then
    healthy=1
    break
  fi
  sleep 5
done
[[ $healthy -eq 1 ]] || fail "new container did not become healthy"
docker exec party-games-app-1 \
  node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

live=$(audit_database "$candidate_image" "$root/data" party-games.sqlite)
[[ $live == *'"integrity":"ok"'* ]] || fail "live database integrity check failed"
printf '%s\n' "$live" > "$backup_dir/after.json"

git diff --quiet
git diff --cached --quiet
[[ $(git rev-parse HEAD) == "$new_commit" ]] || fail "server HEAD changed during deployment"

trap - ERR
echo "deployment complete"
echo "commit=$new_commit"
echo "image=$candidate_image"
echo "backup=$backup_dir"
