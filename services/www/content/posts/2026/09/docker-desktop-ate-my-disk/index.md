---
title: 'Docker Desktop Ate My Disk: The Setting That Was Never Set'
date: '2026-09-08T19:20:00Z'
description: "Docker Desktop's VM died with 'no space left on device' and took every container with it. The root cause was a default disk limit of 1 TB — and a VS Code cache nothing prunes."
ShowToc: true
TocOpen: true
draft: false
---

**TL;DR:** Docker Desktop ships with a **1 TB** virtual disk limit by default. On a 460 GB Mac that means Docker's real limit is your entire machine, so a full disk doesn't produce a Docker error — it kills the VM. Set a real limit (Settings → Resources → Advanced → Disk usage limit). If you just want commands, jump to the **[Quick Reference](#quick-reference)**.

This is the third time macOS has warned me about low disk space and the answer turned out to be Docker. The first two times I pruned some images, felt clever, and moved on. This time Docker didn't give me the chance — it died first.

What follows is the whole debugging session, including the parts where I was wrong, because the wrong turns were more instructive than the fix.

## The Symptom: Docker Doesn't Error, It Hangs

I noticed something was off when a `docker ps` in my terminal just… sat there. No error, no output, no prompt. VS Code's own `docker ps` had been stuck for nine minutes.

My first instinct was that the daemon was down. But it wasn't — not exactly:

```bash
pgrep -x "Docker Desktop"     # running
pgrep -f "com.docker.backend" # running
```

Everything looked alive. That's the confusing part, and it has a specific cause: `com.docker.backend` is a **host-side macOS process** that holds the Unix socket, while the actual Docker engine runs inside a Linux VM. When the VM dies, the backend keeps accepting connections on the socket and simply never answers them.

So instead of "cannot connect to the Docker daemon", you get an infinite hang.

The real error was in the host log the whole time:

```bash
grep -iE 'no space|GET /error' \
  ~/Library/Containers/com.docker.docker/Data/log/host/com.docker.backend.log | tail
```

```
[com.docker.backend.engines][E] engine linux/virtualization-framework run error:
  write <HOME>/Library/Containers/com.docker.docker/Data/log/vm/init.log: no space left on device
```

There it was. Docker Desktop had been sitting on a "Disk full" dialog whose only button was **Quit**, for three and a half hours, while I was doing something else.

⚠️ **Note:** If `docker` commands hang instead of failing, don't waste time on the CLI. Go straight to `com.docker.backend.log`.

## 🚨 Problem #1: macOS Lies About Free Space

Naturally I checked how much disk I had left:

```bash
df -h /
```

```
Filesystem      Size   Used  Avail Capacity  Mounted on
/dev/disk3s1s1  460Gi   17Gi   16Gi    53%   /
```

53% used! Plenty of room. Except that's completely wrong.

On modern macOS, `/` is a **sealed, read-only system snapshot**. Your actual files live on a separate APFS volume, and that's the number you want:

```bash
df -h /System/Volumes/Data
```

```
Filesystem      Size   Used  Avail Capacity  Mounted on
/dev/disk3s5   460Gi  404Gi   16Gi    97%   /System/Volumes/Data
```

97%. All APFS volumes share one storage pool, so the "Avail" figure is the same — but the capacity percentage from `df -h /` is meaningless and will happily convince you nothing is wrong.

## 🚨 Problem #2: The Sparse File Trap

Next, how big is Docker actually?

```bash
ls -lh ~/Library/Containers/com.docker.docker/Data/vms/0/data/Docker.raw
```

```
-rw-r--r--@ 1 sergii staff 1.0T Sep 7 16:36 Docker.raw
```

One terabyte. On a 460 GB drive. That is not a typo, and it's not corruption either — `Docker.raw` is a **sparse file**. `ls` reports its virtual maximum size; only the blocks actually written consume disk.

For the real number you need `du`:

```bash
du -sh ~/Library/Containers/com.docker.docker/Data/vms/0/data/Docker.raw
```

```
80G
```

So: 80 GB real, out of a 1 TB ceiling. Hold that thought, because that ceiling turned out to be the actual bug.

## Getting Docker Back

You can't prune anything while the daemon is dead, so the usual playbook runs in reverse: revive Docker first, clean up second.

```bash
osascript -e 'quit app "Docker Desktop"'
pgrep -f 'com\.docker\.back[e]nd'   # note the PID, then kill -9 it
open -a Docker
until docker info >/dev/null 2>&1; do sleep 5; done; echo "daemon up"
```

Note the odd-looking `back[e]nd` in that pattern. My first attempt was the obvious one:

```bash
pkill -f "com.docker.backend"
```

…which killed my own shell. `pkill -f` matches against the **full command line**, and the shell running that command has `com.docker.backend` right there in its own arguments. So it matches itself first. The bracket trick breaks the literal match while still matching the target process.

The VM came back in about 90 seconds.

## Where 53 GB Actually Went

With the daemon alive again, `docker system df` finally talked:

| Type | Size | Reclaimable |
|---|---|---|
| Images | 26.3 GB | 9.3 GB |
| Containers | 16.8 GB | 16.0 GB (95%) |
| Local Volumes | 31.2 GB | 0.9 GB |
| Build Cache | 10.0 GB | 5.3 GB |

The safe stuff came off easily — `docker image prune -a -f` and `docker builder prune -f` gave back 12.9 GB, and removing devcontainers that had been idle for over three weeks freed another 10.5 GB.

But the volumes column bothered me. 31 GB, almost nothing reclaimable. So I looked closer:

```bash
docker system df -v
```

One volume was **23.5 GB**. It's called `vscode`, and I never created it.

### The `vscode` Volume

If you use Dev Containers, you have this volume. The extension creates it automatically to cache the VS Code Server across container rebuilds — nothing in your `devcontainer.json` mounts it, it just appears.

Here's what was inside mine:

```
11.1 GB  vscode-server/bin/              17 server installs
11.0 GB  vscode-server/extensionsCache/  275 entries
```

**Seventeen** copies of the VS Code Server. One directory per VS Code release, 470 MB–1.3 GB each, going back about nine months. Nothing ever deletes the old ones.

Why seventeen and not nine? Because I run both Debian-based and Alpine-based devcontainers, and every VS Code release gets installed **twice** — once as `linux-arm64`, once as `alpine-arm64`. Mixing base image families silently doubles this cache.

Then the extensions cache, which was the real surprise:

```
6.7 GB  anthropic.claude-code    84 cached versions
3.5 GB  openai.chatgpt           26 cached versions
```

Eighty-four versions of one extension. This isn't a bug so much as an unlucky collision: the cache was designed when extensions updated monthly, and AI coding extensions now ship **several releases per week**. Every version is kept forever, per platform.

There were also 109 orphaned `.vsix` files (819 MB) with UUID names — interrupted downloads that VS Code never cleaned up.

## 🚨 Problem #3: The Freed Space Didn't Come Back

I cleaned up 23 GB. `Docker.raw` shrank from 80 GB to 51 GB — Docker auto-TRIMs after a prune these days, so no manual `fstrim` needed.

Then I checked free space on the Mac: **16.8 GB → 15 GB**. It went *down*.

The culprit is APFS local Time Machine snapshots:

```bash
tmutil listlocalsnapshots /
```

```
com.apple.TimeMachine.2026-09-07-172805.local
com.apple.TimeMachine.2026-09-07-195926.local
```

APFS is copy-on-write. Deleting data inside `Docker.raw` frees blocks *within the disk image*, but if a snapshot still references those blocks, they cannot return to the storage pool. macOS marks that space "purgeable" and reclaims it under pressure — which is exactly what failed to happen before the crash.

These snapshots expire on their own within roughly 24 hours, and sure enough, the next day my 17 GB showed up. If you need it sooner, this is what macOS itself runs under pressure:

```bash
tmutil thinlocalsnapshots / 30000000000 4
```

⚠️ **Note:** This only removes *local* snapshots. Time Machine backups on an external or network disk are untouched.

## 🚨 Problem #4: After a Crash, `container prune` Is a Trap

Standard advice for reclaiming space is `docker container prune -f` — it only removes stopped containers, so it's safe.

It is not safe after a crash.

When the VM dies, every container that was **running** comes back as `Exited (255)`. By status alone they're indistinguishable from containers you stopped weeks ago. A blind prune would have deleted two devcontainers I'd been working in that morning.

The way to tell them apart is the stop timestamp:

```bash
docker inspect -f '{{.State.Status}}|{{.State.FinishedAt}}|{{.Name}}' $(docker ps -aq) | sort -t'|' -k2
```

```
exited|2026-07-31T05:41:27Z|justright-systems-devcontainer-1   <- idle 5 weeks
exited|2026-08-13T04:07:00Z|utili-dev-devcontainer-1           <- idle 3 weeks
exited|2026-09-08T02:11:48Z|domo-bricks-devcontainer-1         <- crash-killed
exited|2026-09-08T02:11:48Z|omnigence-website-devcontainer-1   <- crash-killed
```

Crash-killed containers all share the exact daemon-boot timestamp. Remove the genuinely idle ones **by name**, not with a blanket prune.

## The Detour: I Wrote a Cleanup Script

Here's where I went down a rabbit hole, and I'm including it because the ending is the useful part.

Since nothing prunes that `vscode` volume, I decided to write something that would: keep the two newest server installs per platform, keep the two newest versions of each extension, delete orphaned downloads older than a week, run weekly from a launchd agent.

It worked in a dry run on the first try. It was also badly broken, and it took four review passes to find out:

- **It deleted the newest server install.** A directory named with spaces got word-split by `for d in $(ls -1t)`, and the junk tokens consumed the "keep newest 2" slots.
- **It kept the oldest extension versions.** BusyBox `ls -t` sorts at whole-second granularity, so entries created in the same second fall back to alphabetical order.
- **`shellcheck` passed a script `bash -n` rejected.** A heredoc inside a process substitution can't parse — the entire cleanup section silently never ran.
- **The safety check failed open.** If `docker top` errored, the "don't delete in-use servers" guard protected nothing and reported success.

That last one deserves emphasis, because I only understood how dangerous it was later:

```bash
$ ls -la ~/.vscode-server/bin/
lrwxrwxrwx  a44adf7f... -> /vscode/vscode-server/bin/linux-arm64/a44adf7f...
```

`~/.vscode-server/bin/<commit>` inside the container is a **symlink into the shared volume**. Deleting a server directory doesn't just clear a cache — it breaks the running server behind a live devcontainer's symlink.

I eventually got the script correct, verified against a scratch volume seeded with adversarial names, a symlink pointing at a canary file, and a live devcontainer caught mid-update.

Then I deleted the script.

## What I Should Have Done Instead

Two things, both of which existed the whole time.

**First**, there's an official setting. The Dev Containers extension ships `dev.containers.cacheVolume`, default `true`: *"Controls whether a Docker volume should be used to cache the VS Code server and extensions."* Set it to `false` and the shared volume doesn't exist at all — the server lives in each container's writable layer, which `docker container prune` reclaims.

I don't recommend it for my setup, since my devcontainers pull `:latest` on open and get recreated often, so each recreation would re-download the server. But it's there, and I built a cleaner for a cache that has an off switch.

**Second**, and far more embarrassing:

```bash
docker volume rm vscode
```

That's it. The extension recreates the volume containing only the current server. One stock command reclaims the same ~23 GB my 200-line script did surgically. The script's only advantage was avoiding a one-time re-download.

⚠️ **Note:** Verified against the docs and the extension manifest — VS Code ships **no** automatic cleanup for this cache and no setting to bound its size. There's nothing you're failing to enable. It just needs occasional emptying.

### 🚨 Problem #5: "Volume Is in Use"

Closing VS Code isn't enough:

```
Error response from daemon: remove vscode: volume is in use -
[fc84e54f5be6..., 4cfc194a9ed7..., 7bc52795baa3..., 74a45f1ee2e0...]
```

`docker volume rm` blocks on any container that **references** the volume, running or not. Stopped containers still hold it. They have to be removed:

```bash
docker ps -a --filter volume=vscode --format '{{.Names}}\t{{.State}}'
docker stop <names>
docker rm <names>          # NEVER add -v
docker volume rm vscode
```

One of mine was still *running* despite VS Code being closed — it had `restart: unless-stopped`, so it had come back by itself after the crash and didn't care whether an editor was attached.

**Never add `-v` to `docker rm`.** That takes the named volumes with it, which is where your credentials and databases live. Removing the containers themselves is cheap: source code is bind-mounted from the host, state lives in named volumes, and both survive. You lose the writable layer and rebuild on next "Reopen in Container".

That took `Docker.raw` from 53 GB to 24 GB.

## The Actual Root Cause

Everything above is housekeeping. Here's the bug.

```bash
cat ~/Library/Group\ Containers/group.com.docker/settings-store.json
```

```json
{
  "MemoryMiB": 16384,
  "UseVirtualizationFramework": true
}
```

No `DiskSizeMiB` key. None. Docker Desktop had never been given a disk limit, so it used the default — the 1 TB virtual maximum from earlier.

On a 460 GB Mac, a 1 TB ceiling means Docker's effective limit is **the entire machine**. That's why the failure was so violent. Instead of Docker hitting its own wall and returning a normal `no space left on device` to whatever was writing, it kept growing until macOS itself ran out — and the VM died mid-write.

The limit isn't there to save space. It's there to make the failure survivable and local to Docker.

## Shrinking the Disk Wipes Everything

Docker Desktop is refreshingly blunt about this:

{{< cfimage src="images/Shrink disk image warning.png" alt="Docker Desktop dialog: Shrink disk image? Resizing to a smaller size will delete the disk image; all Docker images, containers and volumes will be lost." caption="Docker Desktop's warning when reducing the disk limit. Note the status bar: **limit 1006.85 GB** — the 1 TB default, in plain sight the whole time." >}}

> Resizing to a smaller size will delete the disk image; all Docker images, containers and volumes will be lost.

I'd hoped it might apply cleanly since my actual usage (24 GB) was already well under the new 64 GB limit. It does not care. It deletes the disk image regardless of how much data is in it.

Afterwards: `0 containers, 0 images, 0 volumes`.

So back up your volumes first. The pattern is a throwaway container that mounts the volume, because the data isn't reachable from macOS:

```bash
# Back up
docker run --rm -v <volume>:/data:ro -v "$PWD":/backup alpine \
  tar czf "/backup/<volume>.tar.gz" -C /data .

# Restore
docker volume create <volume>
docker run --rm -v <volume>:/data -v "$PWD":/backup alpine \
  tar xzf "/backup/<volume>.tar.gz" -C /data
```

The `:ro` on the backup mount guarantees the pass can't modify the source. Ownership and permissions survive the round trip — my `.credentials.json` came back as `-rw-------` owned by uid 1000, and a Postgres data directory restored with the same 2,353 files it went in with.

Two things worth knowing:

- **Back up cold.** Tarring a live Postgres data directory gives you an inconsistent snapshot. Stop the containers first; everything was already stopped in my case, which was convenient.
- **Don't back up what regenerates.** Images re-pull, `node_modules` volumes reinstall, container layers rebuild. I only archived credentials, shell history, and databases — 29 volumes, **683 MB total**. The stuff that mattered was less than 1 GB out of 53.

Restore was 29 of 29, no failures.

## Bonus Round: Your Container Logs Never Rotate

While I was in `~/.docker/daemon.json` anyway, one more thing worth fixing.

Every line your containers write to stdout goes to a log file on disk. The default `json-file` driver has `max-size` set to `-1` — **unlimited**, with no rotation at all. A chatty dev server or a database logging every query grows that file forever, and it appears nowhere in `docker system df`.

| | `json-file` (default) | `local` |
|---|---|---|
| Rotation | none | 20 MB × 5 files |
| Compression | no | yes |
| Cap per container | unbounded | ~100 MB |

```json
{
  "builder": { "gc": { "enabled": true, "defaultKeepStorage": "5GB" } },
  "log-driver": "local"
}
```

`docker logs` works exactly the same. This only affects **newly created** containers, so right after a reset — when you have none — is the cheapest moment to change it.

## Quick Reference

### 1. Check whether you have this problem

```bash
df -h /System/Volumes/Data          # NOT df -h /
du -sh ~/Library/Containers/com.docker.docker/Data/vms/0/data/Docker.raw
docker system df -v | grep -i vscode
```

### 2. Safe reclaim, in order

```bash
docker image prune -f       # dangling only
docker builder prune -f
docker container prune -f   # NOT right after a crash - see Problem #4
```

### 3. Empty the VS Code cache volume

```bash
docker ps -a --filter volume=vscode --format '{{.Names}}\t{{.State}}'
docker stop <names> && docker rm <names>   # never -v
docker volume rm vscode
```

### 4. Set a real disk limit (destroys everything — back up first)

Settings → Resources → Advanced → **Disk usage limit**. Pick a number *below* your typical free space; mine is 64 GB against a steady-state need of ~25 GB.

### 5. If freed space doesn't appear

```bash
tmutil listlocalsnapshots /
tmutil thinlocalsnapshots / 30000000000 4
```

### Never run these

```bash
docker system prune -a --volumes    # destroys databases and credential volumes
docker volume prune -a              # same
```

## Final Thoughts

The thing that actually fixed this was a single number in a settings file. Everything else — the seventeen server installs, the eighty-four cached extension versions, the orphaned downloads — is just growth, and growth is fine as long as it hits a wall that isn't your whole computer.

What I keep coming back to is how much time I spent building the wrong solution. I wrote, debugged, hardened and adversarially tested a cleanup script across four review passes, and the correct answer was one `docker volume rm` and a setting I hadn't read. The script wasn't useless — finding those bugs taught me how the cache actually works — but it was solving the symptom with impressive thoroughness while the cause sat one settings panel away.

Where I landed:

- ✅ Docker's ceiling is 64 GB instead of my entire disk
- ✅ Container logs are capped at ~100 MB each instead of unbounded
- ✅ `Docker.raw` went from 80 GB at its peak to 2.5 GB
- ✅ Volume backups verified with checksums, because I'll need them next time I resize
- ✅ No custom scripts, no scheduled jobs, nothing to maintain

If you use devcontainers on a Mac, go and check two things right now: your disk usage limit, and the size of your `vscode` volume. It takes thirty seconds and it's the difference between an annoying afternoon and losing every container you have.

---

_Have questions or run into different issues? Let me know in the comments!_
