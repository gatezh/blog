{{- /* Markdown mirror of the cfimage shortcode.

       Resolving the page resource rather than echoing the raw `src` attribute
       matters: RelPermalink is absolute and percent-encoded, so a filename
       containing spaces still yields a valid CommonMark link destination.
       No Cloudflare /cdn-cgi/image prefix here — that is an HTML rendering
       concern, and agents should get the canonical asset URL.

       Emitted text stays on one line with its action: this is a plain-text
       output format, so a tab gotmplfmt adds inside a block would land in the
       output and make the line an indented code block. */ -}}
{{- $alt := .Get "alt" | default "" -}}
{{- with .Page.Resources.GetMatch (.Get "src") }}{{ printf "\n![%s](%s)\n" $alt .RelPermalink }}{{ end -}}
{{- with .Get "caption" }}{{ printf "\n*%s*\n" . }}{{ end -}}
