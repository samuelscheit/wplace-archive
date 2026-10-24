import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, chmod, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

async function setup(t: { after: (fn: () => Promise<void>) => void }) {
    const root = await mkdtemp(join(tmpdir(), "wplace-release-test-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const fake = join(root, "gh");
    await writeFile(fake, `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$GH_TEST_LOG"
if [[ "$1 $2" == "release view" ]]; then
    if [[ "\${GH_TEST_STATE:-missing}" == missing ]]; then exit 1; fi
    printf '{"isDraft":%s}\\n' "$GH_TEST_STATE"
else
    exit "\${GH_TEST_WRITE_STATUS:-0}"
fi
`);
    await chmod(fake, 0o755);
    const log = join(root, "gh.log");
    const run = (extra: NodeJS.ProcessEnv = {}) => spawnSync("bash", [resolve("scripts/prepare_snapshot_release.sh")], {
        encoding: "utf8",
        env: { ...process.env, PATH: `${root}:${process.env.PATH}`, GH_TEST_LOG: log,
            GITHUB_REPOSITORY: "owner/repo", RELEASE_ID: "world-2026-10-19T22-38-26.284Z",
            RELEASE_TARGET: "main", GITHUB_SHA: "outdated-sha-with-different-workflows", ...extra },
    });
    return { run, log };
}

test("new draft targets the current default branch rather than the run SHA", async (t) => {
    const { run, log } = await setup(t);
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    const commands = await readFile(log, "utf8");
    assert.match(commands, /release create .*--target main .*--draft --prerelease/);
    assert.ok(!commands.includes("outdated-sha"));
});

test("existing draft target is repaired, without creating a second release", async (t) => {
    const { run, log } = await setup(t);
    const result = run({ GH_TEST_STATE: "true" });
    assert.equal(result.status, 0, result.stderr);
    const commands = await readFile(log, "utf8");
    assert.match(commands, /release edit .*--target main/);
    assert.ok(!commands.includes("release create"));
});

test("published releases are not retagged or edited by preflight", async (t) => {
    const { run, log } = await setup(t);
    assert.equal(run({ GH_TEST_STATE: "false" }).status, 0);
    const commands = await readFile(log, "utf8");
    assert.ok(!commands.includes("release edit"));
    assert.ok(!commands.includes("release create"));
});

test("authorization errors fail before the pipeline continues", async (t) => {
    const { run } = await setup(t);
    assert.equal(run({ GH_TEST_WRITE_STATUS: "1" }).status, 1);
});
