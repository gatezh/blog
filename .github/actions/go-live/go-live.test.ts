// Runs go-live.sh against stubbed `bunx` (wrangler), `curl` and `sleep`, with
// each workflow's own go-live environment read from its YAML. The stubbed
// Cloudflare applies a version override only when it names the Worker by its
// deployed name, derived from wrangler.jsonc as Cloudflare derives it (a
// wrangler env appends "-<env>"), so a wrong name in a workflow fails here.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../../..");
const SCRIPT = join(import.meta.dir, "go-live.sh");

const COMMIT = "b".repeat(40);
// upload's build_id: `<run id>-<run attempt>`.
const OLD_BUILD = "41964656268-1";
const NEW_BUILD = "42320493291-2";

// The deployed name of a Worker: wrangler.jsonc's `name`, plus "-<env>".
function deployedName(service: "api" | "www", wranglerEnv: string): string {
  const config = Bun.JSONC.parse(
    readFileSync(join(ROOT, "services", service, "wrangler.jsonc"), "utf8"),
  ) as {
    name: string;
  };
  return wranglerEnv ? `${config.name}-${wranglerEnv}` : config.name;
}

// The static part of a workflow's go-live env; expressions are replaced per test.
function workflowEnv(file: string): Record<string, string> {
  const yaml = Bun.YAML.parse(readFileSync(join(ROOT, ".github/workflows", file), "utf8")) as {
    jobs: Record<string, { env: Record<string, string> }>;
  };
  return yaml.jobs["go-live"].env;
}

// Stubs. `bunx wrangler` keeps each Worker's deployment in $STATE/<worker>.json;
// `curl` serves the version at 100%, or the one an override names if it is in
// the deployment, after $STATE/misses requests that the override has not
// reached yet.
const BUNX = `#!/usr/bin/env bash
echo "$*" >> "$STATE/calls.log"
shift
cwd=""; args=()
while [ $# -gt 0 ]; do
  case "$1" in --cwd) cwd="$2"; shift 2 ;; *) args+=("$1"); shift ;; esac
done
w=\${cwd#services/}
case "\${args[0]} \${args[1]}" in
  "deployments status")
    [ -f "$STATE/$w.json" ] || { echo "The Worker has no deployments." >&2; exit 1; }
    jq '{versions: .}' "$STATE/$w.json" ;;
  "triggers deploy") ;;
  "versions deploy")
    specs=()
    for a in "\${args[@]:2}"; do case "$a" in *@*%) specs+=("$a") ;; esac; done
    [ \${#specs[@]} = 1 ] && [ -f "$STATE/fail-promote-$w" ] && { echo "API error" >&2; exit 1; }
    printf '%s\\n' "\${specs[@]}" \\
      | jq -R 'capture("(?<version_id>.*)@(?<p>[0-9]+)%") | {version_id, percentage: (.p | tonumber)}' \\
      | jq -s . > "$STATE/$w.json" ;;
  *) echo "unexpected wrangler call: $*" >&2; exit 1 ;;
esac
`;

const CURL = `#!/usr/bin/env bash
headers=(); url=""; dump=""; out=""
while [ $# -gt 0 ]; do
  case "$1" in
    -H) if [[ "$2" == @* ]]; then while IFS= read -r l; do headers+=("$l"); done < "\${2#@}"; else headers+=("$2"); fi; shift 2 ;;
    -D) dump="$2"; shift 2 ;;
    -o) out="$2"; shift 2 ;;
    --max-time | --retry | --retry-delay | -w | -A | -X) shift 2 ;;
    -*) shift ;;
    *) url="$1"; shift ;;
  esac
done
case "$url" in
  "$WWW_URL"*) w=www; name="$STUB_WWW_NAME" ;;
  "$API_URL"*) w=api; name="$STUB_API_NAME" ;;
  *) echo "unexpected url: $url" >&2; exit 6 ;;
esac
override=""
for h in "\${headers[@]}"; do
  case "$h" in Cloudflare-Workers-Version-Overrides:*) override="\${h#*: }" ;; esac
done
printf '%s\\n' "\${headers[@]}" > "$STATE/last-headers"
dep="$STATE/$w.json"
version=$(jq -r '.[] | select(.percentage == 100) | .version_id' "$dep")
if [ -n "$override" ]; then
  want=$(grep -oE "(^|, )$name=\\"[^\\"]+\\"" <<< "$override" | sed -E 's/.*="([^"]+)"/\\1/' || true)
  misses=$(cat "$STATE/misses" 2>/dev/null || echo 0)
  if [ "$misses" -gt 0 ]; then
    echo $((misses - 1)) > "$STATE/misses"
  elif [ -n "$want" ] && jq -e --arg v "$want" 'any(.[]; .version_id == $v)' "$dep" > /dev/null; then
    version="$want"
  fi
fi
echo "$w $version \${override:+override}" >> "$STATE/served.log"
if [ "$w" = www ]; then
  printf '<meta name=build-commit content="%s"><meta name=build-id content="%s">' "$COMMIT" "$(cat "$STATE/build-$version")"
else
  [ "$dump" = - ] && printf 'HTTP/2 200\\r\\nworker-version: %s\\r\\n\\r\\n' "$version"
  [ "$out" = /dev/null ] || printf '{}'
fi
exit 0
`;

const SLEEP = `#!/usr/bin/env bash
echo 1 >> "$STATE/sleeps"
`;

type Harness = {
  state: string;
  run: (command: string, env?: Record<string, string>) => { code: number; out: string };
  read: (name: string) => string;
  deployment: (worker: "api" | "www") => { version_id: string; percentage: number }[];
  setDeployment: (
    worker: "api" | "www",
    versions: { version_id: string; percentage: number }[],
  ) => void;
  output: () => Record<string, string>;
  summary: () => string;
};

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "go-live-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function harness(workflow: string, overrides: Record<string, string> = {}): Harness {
  const state = join(dir, "state");
  const bin = join(dir, "bin");
  const workspace = join(dir, "workspace");
  const temp = join(dir, "runner-temp");
  for (const d of [state, bin, workspace, temp]) mkdirSync(d, { recursive: true });
  for (const [name, body] of [
    ["bunx", BUNX],
    ["curl", CURL],
    ["sleep", SLEEP],
  ]) {
    writeFileSync(join(bin, name), body);
    chmodSync(join(bin, name), 0o755);
  }
  writeFileSync(join(state, "build-www-old"), OLD_BUILD);
  writeFileSync(join(state, "build-www-new"), NEW_BUILD);
  writeFileSync(
    join(state, "www.json"),
    JSON.stringify([{ version_id: "www-old", percentage: 100 }]),
  );
  writeFileSync(
    join(state, "api.json"),
    JSON.stringify([{ version_id: "api-old", percentage: 100 }]),
  );

  const yamlEnv = workflowEnv(workflow);
  const wranglerEnv = yamlEnv.WRANGLER_ENV;
  const env: Record<string, string> = {
    ...yamlEnv,
    API_VERSION_ID: "api-new",
    WWW_VERSION_ID: "www-new",
    API_URL: "https://api.example.test",
    EXPECT_BUILD: NEW_BUILD,
    // Both versions come from one commit (a redeploy of the live one): only
    // the build id tells them apart.
    COMMIT,
    DEPLOY_MESSAGE: "deploy message",
    CLOUDFLARE_ZERO_CLIENT_ID: "",
    CLOUDFLARE_ZERO_CLIENT_SECRET: "",
    ...overrides,
    PATH: `${bin}:${process.env.PATH}`,
    STATE: state,
    STUB_API_NAME: deployedName("api", wranglerEnv),
    STUB_WWW_NAME: deployedName("www", wranglerEnv),
    RUNNER_TEMP: temp,
    GITHUB_OUTPUT: join(dir, "output"),
    GITHUB_STEP_SUMMARY: join(dir, "summary"),
  };
  writeFileSync(env.GITHUB_OUTPUT, "");
  writeFileSync(env.GITHUB_STEP_SUMMARY, "");

  const read = (name: string) =>
    existsSync(join(state, name)) ? readFileSync(join(state, name), "utf8") : "";
  return {
    state,
    read,
    run(command, extra = {}) {
      const proc = Bun.spawnSync(["bash", SCRIPT, command], {
        cwd: workspace,
        env: { ...env, ...extra },
      });
      return { code: proc.exitCode, out: proc.stdout.toString() + proc.stderr.toString() };
    },
    deployment: (worker) => JSON.parse(read(`${worker}.json`)),
    setDeployment: (worker, versions) =>
      writeFileSync(join(state, `${worker}.json`), JSON.stringify(versions)),
    output: () =>
      Object.fromEntries(
        readFileSync(env.GITHUB_OUTPUT, "utf8")
          .split("\n")
          .filter(Boolean)
          .map((line) => line.split(/=(.*)/s).slice(0, 2) as [string, string]),
      ),
    summary: () => readFileSync(env.GITHUB_STEP_SUMMARY, "utf8"),
  };
}

const sleeps = (h: Harness) => h.read("sleeps").split("\n").filter(Boolean).length;
const wranglerCalls = (h: Harness) => h.read("calls.log").split("\n").filter(Boolean);

for (const [workflow, envArg] of [
  ["deploy-staging.yml", "--env=staging"],
  ["release.yml", "--env="],
] as const) {
  describe(workflow, () => {
    test("stage deploys each new version at 0% beside the live one, triggers and api first", () => {
      const h = harness(workflow);
      const { code } = h.run("stage");

      expect(code).toBe(0);
      expect(h.output()).toMatchObject({ api_live: "api-old", www_live: "www-old" });
      expect(h.deployment("api")).toEqual([
        { version_id: "api-new", percentage: 0 },
        { version_id: "api-old", percentage: 100 },
      ]);
      expect(h.deployment("www")).toEqual([
        { version_id: "www-new", percentage: 0 },
        { version_id: "www-old", percentage: 100 },
      ]);
      const calls = wranglerCalls(h).filter((c) => !c.includes("deployments status"));
      expect(calls.map((c) => c.split(" ").slice(1, 5).join(" "))).toEqual([
        `triggers deploy --cwd services/api`,
        `triggers deploy --cwd services/www`,
        `versions deploy --cwd services/api`,
        `versions deploy --cwd services/www`,
      ]);
      expect(calls.every((c) => c.includes(` ${envArg} `) || c.endsWith(` ${envArg}`))).toBe(true);
    });

    test("stage replaces a stale 0% version a failed run left, and reads only the 100% one as live", () => {
      const h = harness(workflow);
      h.setDeployment("api", [
        { version_id: "api-stale", percentage: 0 },
        { version_id: "api-old", percentage: 100 },
      ]);

      expect(h.run("stage").code).toBe(0);
      expect(h.output().api_live).toBe("api-old");
      expect(h.deployment("api")).toEqual([
        { version_id: "api-new", percentage: 0 },
        { version_id: "api-old", percentage: 100 },
      ]);
    });

    test("stage leaves a Worker that already serves its new version alone (a re-run)", () => {
      const h = harness(workflow);
      h.setDeployment("api", [{ version_id: "api-new", percentage: 100 }]);

      const { code, out } = h.run("stage");

      expect(code).toBe(0);
      expect(out).toContain("api already serves api-new.");
      expect(wranglerCalls(h).some((c) => c.includes("versions deploy --cwd services/api"))).toBe(
        false,
      );
      expect(h.deployment("api")).toEqual([{ version_id: "api-new", percentage: 100 }]);
    });

    test("stage stops before changing anything when a Worker has no version at 100%", () => {
      const h = harness(workflow);
      h.setDeployment("www", [
        { version_id: "www-a", percentage: 50 },
        { version_id: "www-b", percentage: 50 },
      ]);

      const { code, out } = h.run("stage");

      expect(code).not.toBe(0);
      expect(out).toContain("a Worker has no version at 100%");
      expect(wranglerCalls(h).filter((c) => !c.includes("deployments status"))).toEqual([]);
    });

    test("stage fails when a Worker has no deployment at all", () => {
      const h = harness(workflow);
      rmSync(join(h.state, "api.json"));

      expect(h.run("stage").code).not.toBe(0);
      expect(wranglerCalls(h).filter((c) => !c.includes("deployments status"))).toEqual([]);
    });

    test("wait reaches both staged versions through the override, by their deployed names", () => {
      const h = harness(workflow);
      h.run("stage");

      const { code } = h.run("wait");

      expect(code).toBe(0);
      expect(sleeps(h)).toBe(0);
      expect(h.read("served.log")).toBe("www www-new override\napi api-new override\n");
      const headers = readFileSync(h.output().headers, "utf8");
      expect(headers).toContain("Cloudflare-Workers-Version-Overrides: ");
    });

    test("wait keeps trying while the override spreads", () => {
      const h = harness(workflow);
      h.run("stage");
      writeFileSync(join(h.state, "misses"), "3");

      expect(h.run("wait").code).toBe(0);
      expect(sleeps(h)).toBe(2);
    });

    test("wait fails after 12 attempts when the override never applies", () => {
      const h = harness(workflow);
      h.run("stage");
      writeFileSync(join(h.state, "misses"), "1000");

      const { code, out } = h.run("wait");

      expect(code).not.toBe(0);
      expect(sleeps(h)).toBe(12);
      expect(out).toContain("::error::the override reaches www build-id");
      expect(h.output().headers).toBeUndefined();
    });

    test("wait does not take the live version for the staged one when both come from the same commit", () => {
      const h = harness(workflow);
      h.run("stage");
      writeFileSync(join(h.state, "misses"), "1000");

      const { code, out } = h.run("wait");

      expect(code).not.toBe(0);
      expect(out).toContain(`www build '${OLD_BUILD}'`);
    });

    test("wait fails when the override names a Worker that is not deployed under that name", () => {
      const h = harness(workflow, { API_WORKER: "gatezh-com-email-worker-typo" });
      h.run("stage");

      expect(h.run("wait").code).not.toBe(0);
    });

    test("wait checks only www when there is no API_URL", () => {
      const h = harness(workflow, { API_URL: "" });
      h.run("stage");

      expect(h.run("wait").code).toBe(0);
      expect(h.read("served.log")).toBe("www www-new override\n");
    });

    test("wait sends the Access service token when one is set", () => {
      const h = harness(workflow, {
        CLOUDFLARE_ZERO_CLIENT_ID: "id",
        CLOUDFLARE_ZERO_CLIENT_SECRET: "secret",
      });
      h.run("stage");

      expect(h.run("wait").code).toBe(0);
      expect(h.read("last-headers")).toContain(
        "CF-Access-Client-Id: id\nCF-Access-Client-Secret: secret\n",
      );
    });

    test("promote moves api, then www, to 100%, then confirms plain requests reach them", () => {
      const h = harness(workflow);
      h.run("stage");
      h.run("wait");
      writeFileSync(join(h.state, "served.log"), "");

      expect(h.run("promote").code).toBe(0);
      const deploys = wranglerCalls(h).filter((c) => c.includes("@100%") && !c.includes("@0%"));
      expect(deploys.map((c) => /--cwd (\S+)/.exec(c)?.[1])).toEqual([
        "services/api",
        "services/www",
      ]);
      expect(h.deployment("api")).toEqual([{ version_id: "api-new", percentage: 100 }]);
      expect(h.deployment("www")).toEqual([{ version_id: "www-new", percentage: 100 }]);
      expect(h.read("served.log")).toBe("www www-new \napi api-new \n");
    });

    test("promote fails when a deploy fails, after the api went first", () => {
      const h = harness(workflow);
      h.run("stage");
      writeFileSync(join(h.state, "fail-promote-www"), "");

      expect(h.run("promote").code).not.toBe(0);
      expect(h.deployment("api")).toEqual([{ version_id: "api-new", percentage: 100 }]);
    });

    test("restore after a failed promote prints the restore commands, www first", () => {
      const h = harness(workflow);

      h.run("restore", { PROMOTE: "failure", WWW_LIVE: "www-old", API_LIVE: "api-old" });

      const summary = h.summary();
      expect(summary).toContain("## promote failed");
      const www = summary.indexOf(
        `--cwd services/www ${envArg.replace("=", '="')}" www-old@100% --yes`,
      );
      const api = summary.indexOf(
        `--cwd services/api ${envArg.replace("=", '="')}" api-old@100% --yes`,
      );
      expect(www).toBeGreaterThan(-1);
      expect(api).toBeGreaterThan(www);
    });

    test("restore after a failed check takes the staged versions out, www first", () => {
      for (const outcome of ["skipped", ""]) {
        const h = harness(workflow);
        h.run("stage");
        expect(h.run("wait").code).toBe(0);
        writeFileSync(join(h.state, "calls.log"), "");

        const restore = h.run("restore", {
          PROMOTE: outcome,
          WWW_LIVE: "www-old",
          API_LIVE: "api-old",
        });

        expect(restore.code).toBe(0);
        expect(h.deployment("www")).toEqual([{ version_id: "www-old", percentage: 100 }]);
        expect(h.deployment("api")).toEqual([{ version_id: "api-old", percentage: 100 }]);
        const deploys = wranglerCalls(h).filter((c) => c.startsWith("wrangler versions deploy"));
        expect(deploys.map((c) => /--cwd (\S+)/.exec(c)?.[1])).toEqual([
          "services/www",
          "services/api",
        ]);
        expect(h.summary()).toContain("go-live stopped before promoting");
        expect(h.summary()).toContain("taken out again");
        // The override that reached them a moment ago now falls back to the live versions.
        expect(h.run("wait").code).not.toBe(0);
      }
    });

    test("restore after a failed stage takes out only what was staged", () => {
      const h = harness(workflow);
      h.setDeployment("api", [
        { version_id: "api-new", percentage: 0 },
        { version_id: "api-old", percentage: 100 },
      ]);

      expect(h.run("restore", { PROMOTE: "", WWW_LIVE: "www-old", API_LIVE: "api-old" }).code).toBe(
        0,
      );
      const deploys = wranglerCalls(h).filter((c) => c.startsWith("wrangler versions deploy"));
      expect(deploys.map((c) => /--cwd (\S+)/.exec(c)?.[1])).toEqual(["services/api"]);
      expect(h.deployment("api")).toEqual([{ version_id: "api-old", percentage: 100 }]);
    });

    test("restore after a promote that succeeded, then a cancel, says the new versions are live", () => {
      const h = harness(workflow);
      h.run("stage");
      expect(h.run("promote").code).toBe(0);
      writeFileSync(join(h.state, "calls.log"), "");

      const restore = h.run("restore", {
        PROMOTE: "success",
        WWW_LIVE: "www-old",
        API_LIVE: "api-old",
      });

      expect(restore.code).toBe(0);
      expect(wranglerCalls(h)).toEqual([]);
      expect(h.summary()).toContain("promoted both versions");
      expect(h.summary()).not.toContain("stopped before promoting");
    });

    test("restore changes nothing when stage never read what was live", () => {
      const h = harness(workflow);

      expect(h.run("restore", { PROMOTE: "", WWW_LIVE: "", API_LIVE: "" }).code).toBe(0);
      expect(wranglerCalls(h)).toEqual([]);
      expect(h.summary()).toContain("go-live stopped before promoting");
    });

    test("restore leaves a Worker alone that a later deploy moved on", () => {
      const h = harness(workflow);
      h.setDeployment("www", [
        { version_id: "www-new", percentage: 0 },
        { version_id: "www-later", percentage: 100 },
      ]);

      expect(h.run("restore", { PROMOTE: "", WWW_LIVE: "www-old", API_LIVE: "api-old" }).code).toBe(
        0,
      );
      expect(wranglerCalls(h).filter((c) => c.startsWith("wrangler versions deploy"))).toEqual([]);
      expect(h.deployment("www")).toEqual([
        { version_id: "www-new", percentage: 0 },
        { version_id: "www-later", percentage: 100 },
      ]);
    });

    test("restore fails, and prints the command, when taking a staged version out fails", () => {
      const h = harness(workflow);
      h.run("stage");
      writeFileSync(join(h.state, "fail-promote-www"), "");

      const restore = h.run("restore", { PROMOTE: "", WWW_LIVE: "www-old", API_LIVE: "api-old" });

      expect(restore.code).not.toBe(0);
      expect(restore.out).toContain("::error::could not take the staged versions out of: www");
      // api is still taken out.
      expect(h.deployment("api")).toEqual([{ version_id: "api-old", percentage: 100 }]);
      expect(h.summary()).toContain(
        `--cwd services/www ${envArg.replace("=", '="')}" www-old@100% --yes`,
      );
      expect(h.summary()).not.toContain("services/api");
    });
  });
}

test("an unknown command fails", () => {
  const h = harness("release.yml");
  expect(h.run("deploy").code).toBe(2);
});
