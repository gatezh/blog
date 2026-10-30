{{- /* The projects from the page's `layers:` front matter as plain Markdown:
       each entry's before and after, what it runs on or is built in, and the
       talks that explain it. Built from _partials/project-graph.html like the
       HTML. Every line is one printf so gotmplfmt cannot indent it into a code
       block (see layouts/llms._outputformat_llmtext_.txt). */ -}}
{{- $g := partial "project-graph.html" .Page -}}
{{- $inverse := dict "runs on" "Runs" "built in" "Builds" -}}
{{- range .Page.Params.layers -}}
	{{- printf "\n## %s\n\n*%s*\n" .name .blurb -}}
	{{- range .projects -}}
		{{- $p := . -}}
		{{- $title := cond (isset $p "url") (printf "[%s](%s)" $p.name $p.url) $p.name -}}
		{{- printf "\n### %s (%s)\n\n- Before: %s\n- After: %s\n" $title $p.status $p.before $p.after -}}
		{{- range where $g.edges "from" $p.id }}{{ printf "- %s %s\n" (strings.FirstUpper .verb) (index $g.nodes .to).name }}{{ end -}}
		{{- range $verb, $label := $inverse -}}
			{{- $in := where (where $g.edges "to" $p.id) "verb" $verb -}}
			{{- $names := slice }}{{ range $in }}{{ $names = $names | append (index $g.nodes .from).name }}{{ end -}}
			{{- with $names }}{{ printf "- %s %s\n" $label (delimit . ", ") }}{{ end -}}
		{{- end -}}
		{{- range $p.talks }}{{ with index $g.talks . }}{{ printf "- Explained in [%s](%s)\n" .short .url }}{{ end }}{{ end -}}
	{{- end -}}
{{- end -}}
