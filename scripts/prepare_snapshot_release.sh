#!/usr/bin/env bash
set -euo pipefail

: "${RELEASE_ID:?RELEASE_ID is required}"
: "${RELEASE_TARGET:?RELEASE_TARGET must name the current default branch}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

# The run SHA may no longer match the workflow files on the default branch.
# Using it as target_commitish can require workflows:write, which the built-in
# Actions token cannot have. Resolve the current default branch on the server.
# Do not delete or retag a previously published snapshot on retries.
release=$(gh release view "$RELEASE_ID" --repo "$GITHUB_REPOSITORY" --json isDraft 2>/dev/null) || release=""
if [[ -z "$release" ]]; then
    gh release create "$RELEASE_ID" --repo "$GITHUB_REPOSITORY" --target "$RELEASE_TARGET" \
        --draft --prerelease --title "$RELEASE_ID" \
        --notes "Archived world snapshot; concatenate tiles.tar.gz.part.* before extracting."
elif [[ $(printf '%s' "$release" | node -pe 'JSON.parse(require("node:fs").readFileSync(0, "utf8")).isDraft') == true ]]; then
    # Repair target_commitish for draft releases created by older workflow versions.
    gh release edit "$RELEASE_ID" --repo "$GITHUB_REPOSITORY" --target "$RELEASE_TARGET"
else
    echo "Release $RELEASE_ID is already published; retaining its tag and target."
fi
