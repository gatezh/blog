---
layout: post
title:  "How to host Angular application on GitHub Pages"
date:   2017-03-31 15:26:55 -0400
permalink: /how-to-host-angular-application-on-github-pages.html
categories: angular github
published: true
---
**[Last update 04-04-2017]**

To install the command run the following:

```
npm i -g angular-cli-ghpages
```

> Note: you have to create the **dist** folder in before (e.g. `ng build --prod`)

```
ng build --prod --base-href "https://USERNAME.github.io/REPOSITORY/"
ngh
```

In case you use a custom domain for one of your repositories (like I do for this blog), you should use `http` instead

```
ng build --prod --base-href "http://YOURDOMAIN.com/REPOSITORY/"
ngh
```

For more information check [angular-cli-ghpages](https://github.com/angular-buch/angular-cli-ghpages) GitHub Page.

There might be a problem with routing. If so check [this FAQ](https://github.com/angular-buch/angular-cli-ghpages/wiki/FAQ#why-is-the-routing-not-working-correctly-on-hard-reload-specific-to-github-pages-only)