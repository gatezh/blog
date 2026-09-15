{{- /* Markdown mirror of the home page. An agent negotiating Accept:
       text/markdown at / is the most likely first request the site sees, so
       this is a map of the site rather than a copy of the home page's markup:
       the same entries llms.txt carries, plus a pointer to the full corpus. */ -}}
{{- $listable := partial "agent-listable.html" site.RegularPages -}}
# {{ site.Title }}

> {{ site.Params.description }}
{{ with .Content | plainify | strings.TrimSpace }}
{{ . }}
{{ end }}
## Sections
{{ range site.Sections }}{{ printf "\n- [%s](%s)" .Title .Permalink }}{{ end }}

## Pages
{{ range $listable }}{{ printf "\n- [%s](%s)" .Title .Permalink }}{{ end }}

---

Full text of every page: {{ "llms-full.txt" | absURL }}
