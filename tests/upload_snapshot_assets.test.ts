import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, chmod, rm, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

async function setup(t: { after: (fn: () => Promise<void>) => void }) {
    const root = await mkdtemp(join(tmpdir(), "wplace-assets-test-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const state = join(root, "archive");
    await mkdir(state);
    await writeFile(join(state, "tiles.tar.gz.part.000"), "abc");
    await writeFile(join(state, "tiles.sha256"), "hash");
    const fake = join(root, "gh");
    await writeFile(fake, `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$GH_TEST_LOG"
case "$1 $2" in
    "release view") echo "https://api.github.com/repos/owner/repo/releases/123" ;;
    "api https://api.github.com/repos/owner/repo/releases/123")
        if [[ "$4" == *tiles.tar.gz.part.000* ]]; then name=tiles.tar.gz.part.000; size=3; else name=tiles.sha256; size=4; fi
        if [[ -f "$GH_TEST_ROOT/$name" || ( "$name" == tiles.tar.gz.part.000 && "\${GH_TEST_SKIP_PART:-false}" == true ) ]]; then
            if [[ "\${GH_TEST_BAD_SIZE:-false}" == true ]]; then echo 999; else echo "$size"; fi
        fi
        ;;
    "release upload")
        count=$(cat "$GH_TEST_ROOT/attempts" 2>/dev/null || echo 0)
        count=$((count + 1)); echo "$count" > "$GH_TEST_ROOT/attempts"
        if (( count <= \${GH_TEST_UPLOAD_FAILURES:-0} )); then exit 1; fi
        touch "$GH_TEST_ROOT/$(basename "$4")"
        ;;
    *) echo "Unexpected gh command: $*" >&2; exit 99 ;;
esac
`);
    await chmod(fake, 0o755);
    await writeFile(join(root, "sleep"), "#!/usr/bin/env bash\nexit 0\n");
    await chmod(join(root, "sleep"), 0o755);
    const log = join(root, "gh.log");
    const run = (extra: NodeJS.ProcessEnv = {}) => spawnSync("bash", [resolve("scripts/upload_snapshot_assets.sh")], {
        encoding: "utf8",
        env: { ...process.env, PATH: `${root}:${process.env.PATH}`, GH_TEST_LOG: log, GH_TEST_ROOT: root,
            STATE_DIR: state, GITHUB_REPOSITORY: "owner/repo", RELEASE_ID: "world-2026-10-19T22-38-26.284Z", ...extra },
    });
    return { run, log, root };
}

test("draft assets are looked up by release ID, not an unpublished tag", async (t) => {
    const { run, log } = await setup(t);
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    const commands = await readFile(log, "utf8");
    assert.match(commands, /api https:\/\/api.github.com\/repos\/owner\/repo\/releases\/123/);
    assert.ok(!commands.includes("releases/tags/"));
    assert.equal(commands.split("\n").filter((line) => line.startsWith("release upload")).length, 2);
});

test("confirmed existing assets are skipped on resume", async (t) => {
    const { run, log } = await setup(t);
    const result = run({ GH_TEST_SKIP_PART: "true" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Already uploaded: tiles.tar.gz.part.000/);
    const uploads = (await readFile(log, "utf8")).split("\n").filter((line) => line.startsWith("release upload"));
    assert.equal(uploads.length, 1);
    assert.match(uploads[0], /tiles.sha256/);
});

test("transient uploads are retried, permanent failures stop publication", async (t) => {
    const first = await setup(t);
    assert.equal(first.run({ GH_TEST_UPLOAD_FAILURES: "1" }).status, 0);
    assert.equal(await readFile(join(first.root, "attempts"), "utf8"), "3\n");
    const second = await setup(t);
    assert.equal(second.run({ GH_TEST_UPLOAD_FAILURES: "10" }).status, 1);
    assert.equal(await readFile(join(second.root, "attempts"), "utf8"), "3\n");
});

test("a successful upload with a wrong remote size is fatal", async (t) => {
    const { run } = await setup(t);
    const result = run({ GH_TEST_BAD_SIZE: "true" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Release asset verification failed/);
});
