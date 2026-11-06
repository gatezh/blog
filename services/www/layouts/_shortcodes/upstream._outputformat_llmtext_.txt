{{- /* The Upstream entries as plain Markdown, grouped by project. Every line
       is one printf so gotmplfmt cannot indent it into a code block (see
       layouts/llms._outputformat_llmtext_.txt). */ -}}
{{- $g := partial "upstream-log.html" .Page -}}
{{- range $g.groups -}}
	{{- printf "\n## [%s](https://github.com/%s)\n" .project .project -}}
	{{- range .entries }}{{ printf "\n- [%s #%d: %s](%s). %s. %s" .kindName .number .title .url .outcome .note }}{{ end -}}
	{{- printf "\n" -}}
{{- end -}}
