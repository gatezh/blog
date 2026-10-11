// @ts-nocheck -- the loader line below is PostHog's minified snippet, copied
// verbatim from https://posthog.com/docs/libraries/js (Option 1,
// "Recommended"). Typing it would mean editing it, so this file is not
// type-checked. Do not edit the loader line; replace it wholesale from the docs
// when updating.
//
// Moved out of an inline <script> so the CSP needs no 'unsafe-inline'; the
// project token comes from the data-posthog-key attribute on this script's tag
// (posthog.html). The hosts the loader and SDK reach are allowed in
// layouts/home._outputformat_headers_.txt.
//
// `defaults` is PostHog's dated snapshot of SDK option defaults (pageview
// capture, rage clicks, storage). It does not switch features on: autocapture,
// session replay and web vitals have their own options and project settings.
// Pinned deliberately — see "Updating" in docs/posthog.md before changing the
// date.

const key = document.currentScript?.dataset.posthogKey;

if (key) {
  // oxlint-disable-next-line -- vendor code, kept verbatim
  // prettier-ignore
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],Object.defineProperty(u,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e}}),Object.defineProperty(u.people,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(){return u.toString(1)+".people (stub)"}}),o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
  posthog.init(key, {
    api_host: "https://us.i.posthog.com",
    defaults: "2026-05-30",
  });
}

export {};
