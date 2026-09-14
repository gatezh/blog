{{- /* Agent-facing Markdown mirror of this page.

       .RawContent is the unprocessed source, so shortcodes would otherwise
       leak as literal `{{< cfimage ... >}}`. The cfimage alt and caption text
       carries real descriptive content, so it is converted to Markdown image
       syntax rather than stripped. src is page-relative, which resolves
       correctly from this file's own URL. Any other shortcode is dropped. */ -}}
{{- $c := .RawContent -}}
{{- $c = replaceRE `(?s)\{\{<\s*cfimage\s+src="([^"]*)"\s+alt="([^"]*)"\s+caption="([^"]*)"[^>]*>\}\}` "![$2]($1)\n\n*$3*" $c -}}
{{- $c = replaceRE `(?s)\{\{<\s*cfimage\s+src="([^"]*)"\s+alt="([^"]*)"[^>]*>\}\}` "![$2]($1)" $c -}}
{{- $c = replaceRE `(?s)\{\{[<%].*?[>%]\}\}` "" $c -}}
# {{ .Title }}
{{ with .Params.description }}
> {{ . }}
{{ end -}}
{{ with .Date }}{{ if not .IsZero }}
*Published: {{ .Format "January 2, 2006" }}*
{{ end }}{{ end }}
{{ $c }}
