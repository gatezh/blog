{{- /* Markdown mirror of a section listing. */ -}}
{{- $listable := partial "agent-listable.html" .Pages -}}
# {{ .Title }}
{{ with .Params.description }}
> {{ . }}
{{ end }}
{{- with .Content | plainify | strings.TrimSpace }}
{{ . }}
{{ end }}
{{- range $listable }}{{ printf "\n- [%s](%s): %s" .Title .Permalink (.Description | default (.Summary | plainify | replaceRE "\\s+" " " | truncate 160)) }}{{ end }}
