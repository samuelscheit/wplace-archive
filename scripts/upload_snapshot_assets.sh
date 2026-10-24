#!/usr/bin/env bash
set -euo pipefail

: "${RELEASE_ID:?RELEASE_ID is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${STATE_DIR:?STATE_DIR is required}"

# The release-by-tag REST endpoint does not resolve unpublished draft tags.
# gh release view finds drafts through the releases list; use its API ID URL.
release_api=$(gh release view "$RELEASE_ID" --repo "$GITHUB_REPOSITORY" --json apiUrl --jq .apiUrl)
[[ -n "$release_api" ]]
for asset in "$STATE_DIR"/tiles.tar.gz.part.* "$STATE_DIR/tiles.sha256"; do
    test -f "$asset"
    name=$(basename "$asset")
    size=$(stat -c %s "$asset")
    for attempt in 1 2 3; do
        remote_size=$(gh api "$release_api" \
            --jq ".assets[] | select(.name == \"$name\" and .state == \"uploaded\") | .size")
        if [[ "$remote_size" == "$size" ]]; then
            echo "Already uploaded: $name ($size bytes)"
            break
        fi
        echo "Uploading $name ($size bytes), attempt $attempt/3"
        if gh release upload "$RELEASE_ID" "$asset" --clobber --repo "$GITHUB_REPOSITORY"; then
            break
        fi
        if [[ "$attempt" == 3 ]]; then
            echo "Failed to upload $name after $attempt attempts" >&2
            exit 1
        fi
        sleep "$((attempt * 10))"
    done
    # Do not proceed to S3/publication based on upload exit status alone.
    remote_size=$(gh api "$release_api" \
        --jq ".assets[] | select(.name == \"$name\" and .state == \"uploaded\") | .size")
    if [[ "$remote_size" != "$size" ]]; then
        echo "Release asset verification failed: $name (local $size, remote $remote_size)" >&2
        exit 1
    fi
done
