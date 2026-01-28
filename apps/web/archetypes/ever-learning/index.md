---
title: '{{ replace .File.ContentBaseName "-" " " | title }}'
date: '{{ .Date }}'
learning_source: "https://example.com"            # the "live" URL you read
learning_source_archive: "https://example.com"    # the archive.is (or similar) URL
learning_date: ""
draft: true
---

**[🔗 Original source]({{< param "learning_source" >}})** | **[🗄️ Archived copy]({{< param "learning_source_archive" >}})**
