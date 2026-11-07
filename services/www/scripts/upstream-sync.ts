// Brings content/upstream/index.md up to date with GitHub: adds a stub for
// every issue or pull request the author filed on a repository that is not
// their own, and closes the entries GitHub has since closed. Anything
// filed before the page's oldest entry is left alone: the list starts where
// its author chose, and reaches further back only when an older entry is
// added by hand. Run by .github/workflows/upstream.yml once a month, or:
//
//   bun run upstream:sync   (needs `gh auth login`)
//
// A stub has an empty `note`, which fails the Hugo build until the line is
// written (layouts/_partials/upstream-log.html), so a stub cannot ship unread.
// Entries are matched on project, kind and number; the file is edited line by
// line so comments and the hand-written notes stay as they are.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const AUTHOR = "gatezh";
// A repository where GitHub reports the author as its owner, a member of its
// organization or a collaborator is the author's own, not upstream. GitHub
// says which per result, so no list of accounts lives here.
const OWN_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
const FILE = fileURLToPath(new URL("../content/upstream/index.md", import.meta.url));

type State = "open" | "fixed" | "merged" | "declined";
interface Entry {
  project: string;
  kind: "issue" | "pr";
  number: number;
  title: string;
  filed: string;
  state: State;
  closed?: string;
}

// The fields kept from each search result (the jq below drops the rest, such
// as bodies, so the output stays small).
interface SearchItem {
  repository_url: string;
  number: number;
  title: string;
  state: "open" | "closed";
  state_reason: string | null;
  author_association: string;
  created_at: string;
  closed_at: string | null;
  merged_at: string | null;
  is_pr: boolean;
}

function fromGitHub(): Entry[] {
  const q = `author:${AUTHOR} -user:${AUTHOR}`;
  const fields =
    "{repository_url, number, title, state, state_reason, author_association, created_at, closed_at, merged_at: .pull_request.merged_at, is_pr: (.pull_request != null)}";
  const out = execFileSync(
    "gh",
    [
      "api",
      "--paginate",
      "-X",
      "GET",
      "search/issues",
      "-f",
      `q=${q}`,
      "-f",
      "per_page=100",
      "--jq",
      `.items[] | ${fields}`,
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SearchItem)
    .filter((item) => !OWN_ASSOCIATIONS.has(item.author_association))
    .map((item) => {
      const day = (iso: string | null) => iso?.slice(0, 10);
      let state: State = "open";
      if (item.state === "closed") {
        if (item.is_pr) state = item.merged_at ? "merged" : "declined";
        else state = item.state_reason === "completed" ? "fixed" : "declined";
      }
      return {
        project: item.repository_url.replace("https://api.github.com/repos/", ""),
        kind: item.is_pr ? "pr" : "issue",
        number: item.number,
        title: item.title,
        filed: day(item.created_at)!,
        state,
        closed: state === "open" ? undefined : day(item.merged_at ?? item.closed_at),
      } satisfies Entry;
    });
}

const key = (e: Pick<Entry, "project" | "kind" | "number">) => `${e.project}#${e.kind}#${e.number}`;

function field(block: string, name: string): string {
  const m =
    block.match(new RegExp(`^ {4}${name}: (.*)$`, "m")) ??
    block.match(new RegExp(`^  - ${name}: (.*)$`, "m"));
  return m?.[1].trim() ?? "";
}

function stub(e: Entry): string {
  const lines = [
    `  - project: ${e.project}`,
    `    kind: ${e.kind}`,
    `    number: ${e.number}`,
    `    title: ${JSON.stringify(e.title)}`,
    `    filed: ${e.filed}`,
    `    state: ${e.state}`,
  ];
  if (e.closed) lines.push(`    closed: ${e.closed}`);
  lines.push(`    note: ""`);
  return lines.join("\n");
}

const source = readFileSync(FILE, "utf8");
const start = source.indexOf("\nupstream:\n") + "\nupstream:\n".length;
const rest = source.slice(start);
const end = rest.search(/^(?! )/m); // first line that is not indented: the next key or `---`
const head = source.slice(0, start);
const tail = rest.slice(end);
const blocks = rest
  .slice(0, end)
  .split(/^(?=  - project:)/m)
  .filter((b) => b.trim());

const onPage = new Map(
  blocks.map((b) => [`${field(b, "project")}#${field(b, "kind")}#${field(b, "number")}`, b]),
);
const added: Entry[] = [];
const closed: Entry[] = [];
const review: string[] = [];

const horizon = [...onPage.values()].map((b) => field(b, "filed")).sort()[0] ?? "";

for (const e of fromGitHub()) {
  const block = onPage.get(key(e));
  if (!block) {
    if (e.filed >= horizon) added.push(e);
    continue;
  }
  const pageState = field(block, "state");
  if (pageState === e.state) continue;
  if (pageState === "open" && e.closed) {
    onPage.set(
      key(e),
      block.replace(/^    state: open$/m, `    state: ${e.state}\n    closed: ${e.closed}`),
    );
    closed.push(e);
  } else {
    review.push(`${e.project}#${e.number} is ${e.state} on GitHub but ${pageState} on the page`);
  }
}

added.sort((a, b) => b.filed.localeCompare(a.filed));
const list =
  [...added.map(stub), ...[...onPage.values()].map((b) => b.trimEnd())].join("\n") + "\n";
writeFileSync(FILE, head + list + tail);

const link = (e: Entry) =>
  `[${e.project}#${e.number}](https://github.com/${e.project}/${e.kind === "pr" ? "pull" : "issues"}/${e.number})`;
const summary = [
  added.length
    ? `New, each with an empty \`note\` to write before merging:\n${added.map((e) => `- ${link(e)}: ${e.title}`).join("\n")}`
    : "",
  closed.length
    ? `Closed on GitHub:\n${closed.map((e) => `- ${link(e)}: ${e.state} ${e.closed}`).join("\n")}`
    : "",
  review.length ? `Check by hand:\n${review.map((r) => `- ${r}`).join("\n")}` : "",
].filter(Boolean);
console.log(summary.length ? summary.join("\n\n") : "The page is up to date.");
