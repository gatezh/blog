{{- /* The talks from the page's `talks:` front matter as plain Markdown. Every
       line is one printf so gotmplfmt cannot indent it into a code block (see
       layouts/llms._outputformat_llmtext_.txt). */ -}}
{{- range .Page.Params.talks -}}
	{{- printf "\n## %s\n\n*%s · %s, %s*\n\n%s\n" .title ((time.AsTime .start).Format "January 2, 2006") .event .venue .abstract -}}
	{{- with .slides }}{{ printf "\n- [Slides (PDF)](%s)" . }}{{ end -}}
	{{- with .recording }}{{ printf "\n- [Recording](%s)" . }}{{ end -}}
	{{- with .eventUrl }}{{ printf "\n- [Event page](%s)" . }}{{ end -}}
	{{- with .code }}{{ printf "\n- [Code](%s)" . }}{{ end -}}
	{{- printf "\n" -}}
{{- end -}}
