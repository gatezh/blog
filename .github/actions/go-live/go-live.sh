#!/usr/bin/env bash
# The steps go-live shares between deploy-staging.yml and release.yml. Run
# through action.yml beside it (`uses: $/.github/actions/go-live`), which loads
# this file from the workflow's own commit: release.yml checks out the tag it
# deploys, and an older tag has no copy of it. Tested by go-live.test.ts
# (`bun run test:deploy`), against stubbed bunx, curl and sleep.
#
# Commands:
#   stage    Read the version each Worker serves at 100%, apply triggers, then
#            deploy each new version at 0% beside it, api first. Outputs
#            api_live and www_live.
#   wait     Send the version override until www's build-commit and the api's
#            Worker-Version name the new versions: an override that is not
#            applied falls back to the live version without an error. Outputs
#            headers, a `curl -H @file` with what it sent, for the checks.
#   promote  Deploy both new versions at 100%, api first, then wait until
#            plain requests reach them.
#   restore  The run summary after a failure: what may be live, and the
#            commands that put back what was live before.
#
# Environment, set by the calling job:
#   WRANGLER_ENV            the wrangler env: "staging", or "" for the top level
#   API_WORKER, WWW_WORKER  deployed Worker names, the override's keys
#   API_VERSION_ID, WWW_VERSION_ID  the versions `upload` made
#   WWW_URL                 the site, without a trailing slash
#   API_URL                 the api; empty skips the api's identity check
#   EXPECT_COMMIT           the commit www's build-commit must name
#   DEPLOY_LABEL            "staging" or "production", for messages
#   DEPLOY_MESSAGE          the deployment message
#   CLOUDFLARE_ZERO_CLIENT_ID, CLOUDFLARE_ZERO_CLIENT_SECRET  optional Access
#   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID  stage and promote only
#   PROMOTE, WWW_LIVE, API_LIVE  restore only: the promote step's outcome and
#                           stage's outputs
set -eo pipefail

env_arg="--env=${WRANGLER_ENV}"

# A curl `-H @file` for every request: the Access service token when there is
# one, plus the version override for $1 = override.
headers_file() {
  local file="${RUNNER_TEMP}/go-live-$1.headers"
  (
    umask 077
    {
      if [ -n "${CLOUDFLARE_ZERO_CLIENT_ID}" ] && [ -n "${CLOUDFLARE_ZERO_CLIENT_SECRET}" ]; then
        echo "CF-Access-Client-Id: ${CLOUDFLARE_ZERO_CLIENT_ID}"
        echo "CF-Access-Client-Secret: ${CLOUDFLARE_ZERO_CLIENT_SECRET}"
      fi
      if [ "$1" = override ]; then
        echo "Cloudflare-Workers-Version-Overrides: ${API_WORKER}=\"${API_VERSION_ID}\", ${WWW_WORKER}=\"${WWW_VERSION_ID}\""
      fi
    } > "${file}"
  )
  echo "${file}"
}

# The version at 100%. A failed earlier run can leave its own at 0% beside it.
live() {
  bunx wrangler deployments status --cwd "services/$1" "${env_arg}" --json \
    | jq -r '[.versions[] | select(.percentage == 100) | .version_id] | first // empty'
}

stage_one() {
  if [ "$2" = "$3" ]; then
    echo "$1 already serves $2."
    return
  fi
  bunx wrangler versions deploy --cwd "services/$1" "${env_arg}" "$2@0%" "$3@100%" \
    --message "${DEPLOY_MESSAGE} (staged)" --yes
  echo "Staged $1 $2 at 0%; $3 still serves all traffic."
}

cmd_stage() {
  local api_now www_now
  api_now=$(live api)
  www_now=$(live www)
  if [ -z "${api_now}" ] || [ -z "${www_now}" ]; then
    echo "::error::a Worker has no version at 100% (api '${api_now}', www '${www_now}'); finish or roll back that deployment first"
    exit 1
  fi
  echo "api_live=${api_now}" >> "$GITHUB_OUTPUT"
  echo "www_live=${www_now}" >> "$GITHUB_OUTPUT"

  # A version upload skips triggers (routes, custom domains, workers.dev);
  # `triggers deploy` (experimental) applies them first, so the hostnames the
  # checks use exist. It uploads no assets, but fails unless www's
  # assets.directory exists.
  bunx wrangler triggers deploy --cwd services/api "${env_arg}"
  mkdir -p services/www/public
  bunx wrangler triggers deploy --cwd services/www "${env_arg}"

  stage_one api "${API_VERSION_ID}" "${api_now}"
  stage_one www "${WWW_VERSION_ID}" "${www_now}"
}

# $1: override (before promoting) or plain (after). An override takes a few
# seconds to reach every edge location, so an early miss is expected: plain
# curl, no error until the last attempt.
wait_for() {
  local headers www api attempt
  local want_api="${API_URL:+${API_VERSION_ID}}"
  local what="${DEPLOY_LABEL} serves"
  [ "$1" = override ] && what="the override reaches"
  headers=$(headers_file "$1")
  for attempt in $(seq 1 12); do
    www=$(curl -sf --max-time 20 -H @"${headers}" "${WWW_URL}/" | grep -o 'build-commit[^>]*' | grep -oE '[0-9a-f]{40}' | head -1 || true)
    api=""
    [ -z "${API_URL}" ] || api=$(curl -sf -o /dev/null -D - --max-time 20 -H @"${headers}" "${API_URL}" | tr -d '\r' | grep -i '^worker-version:' | cut -d' ' -f2 || true)
    if [ "${www}" = "${EXPECT_COMMIT}" ] && [ "${api}" = "${want_api}" ]; then
      echo "headers=${headers}" >> "$GITHUB_OUTPUT"
      echo "Now ${what} www ${www::7} and api ${api:-(not checked)}."
      return 0
    fi
    echo "Attempt ${attempt}: ${what} www '${www::7}' and api '${api}'; waiting for ${EXPECT_COMMIT::7} and '${want_api}'."
    sleep 5
  done
  echo "::error::${what} www build-commit '${www}' and api version '${api}', expected ${EXPECT_COMMIT} and '${want_api}'"
  return 1
}

# api first: the new site may post to an api change, never the reverse.
cmd_promote() {
  bunx wrangler versions deploy --cwd services/api "${env_arg}" "${API_VERSION_ID}@100%" --message "${DEPLOY_MESSAGE}" --yes
  bunx wrangler versions deploy --cwd services/www "${env_arg}" "${WWW_VERSION_ID}@100%" --message "${DEPLOY_MESSAGE}" --yes
  # The checks ran on these versions; this only confirms plain requests reach them.
  wait_for plain
}

# Nothing rolls back on its own, and only a failed or cancelled promote can
# leave something to restore: a failed check never promoted. The restore goes
# www first, so a new site never meets an old api.
cmd_restore() {
  {
    case "${PROMOTE}" in
      failure | cancelled)
        echo "## promote ${PROMOTE/failure/failed} — the new versions may be live, nothing was rolled back"
        echo ""
        echo "They passed every check at 0%. If both \`versions deploy\` commands in the log succeeded and only the wait after them timed out, they are live and still spreading. Re-running \`go-live\` finishes the promotion, if no later run has deployed since. Or put both Workers back on what they served before this run:"
        echo ""
        echo '```sh'
        echo "bunx wrangler versions deploy --cwd services/www --env=\"${WRANGLER_ENV}\" ${WWW_LIVE}@100% --yes"
        echo "bunx wrangler versions deploy --cwd services/api --env=\"${WRANGLER_ENV}\" ${API_LIVE}@100% --yes"
        echo '```'
        ;;
      *)
        echo "## go-live stopped before promoting — ${DEPLOY_LABEL} still serves what it served before"
        echo ""
        echo "The new versions may be staged at 0%: no visitor reaches them without the override, and the next deploy replaces them."
        ;;
    esac
  } >> "$GITHUB_STEP_SUMMARY"
}

case "$1" in
  stage) cmd_stage ;;
  wait) wait_for override ;;
  promote) cmd_promote ;;
  restore) cmd_restore ;;
  *)
    echo "::error::go-live.sh: unknown command '$1' (stage, wait, promote, restore)"
    exit 2
    ;;
esac
