#!/usr/bin/env bash
set -euo pipefail

tag=${1:?Expected Alpha tag}
expected=${2:?Expected commit SHA}
if [[ ! "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+-alpha\.[0-9]+$ || ! "$expected" =~ ^[0-9a-f]{40}$ ]]; then
  echo 'Invalid release tag or commit SHA' >&2
  exit 1
fi

status=0
refs=$(git ls-remote --exit-code --tags origin "refs/tags/$tag" "refs/tags/$tag^{}") || status=$?
if [[ "$status" == 2 ]]; then
  echo 'Release tag does not exist yet.'
  exit 0
fi
if [[ "$status" != 0 ]]; then
  echo 'Could not verify the remote release tag.' >&2
  exit 1
fi
actual=$(printf '%s\n' "$refs" | awk 'NR == 1 { first=$1 } /\^\{\}$/ { peeled=$1 } END { print peeled ? peeled : first }')
if [[ "$actual" != "$expected" ]]; then
  echo "Release tag $tag points to $actual, expected $expected. Refusing to publish." >&2
  exit 1
fi
echo 'Existing release tag matches the build commit.'
