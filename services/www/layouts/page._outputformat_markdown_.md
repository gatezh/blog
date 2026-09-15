{{- /* Agent-facing Markdown mirror of this page.

       .RenderShortcodes expands each shortcode through its own template for
       THIS output format (see _shortcodes/*._outputformat_markdown_.md) and
       leaves the surrounding Markdown as authored.

       It replaced a set of regexes over .RawContent. Those could not work:
       .RawContent is unprocessed source, so a shortcode had to be either
       pattern-matched or deleted, and deletion destroyed the content the
       shortcode supplied — `[text]({{< param "url" >}})` became `[text]()`.
       Matching fared no better: the patterns hard-coded attribute order, broke
       on a `>` inside any attribute, and blanked shortcode syntax quoted inside
       code spans. A shortcode with no Markdown template now falls back to its
       HTML one instead of vanishing. */ -}}
# {{ .Title }}
{{ with .Params.description }}
> {{ . }}
{{ end -}}
{{ with .Date }}{{ if not .IsZero }}
*Published: {{ .Format "January 2, 2006" }}*
{{ end }}{{ end }}
{{ .RenderShortcodes }}
