---
layout: post
title:  "Getting started with Jekyll"
date:   2017-04-04 19:54:55 -0400
permalink: /getting-started-with-jekyll.html
categories: angular github
published: true
---

## Install ruby

> Here I assume that you have `brew` already installed on your Mac machine. [Install it](https://brew.sh) first if you don't have it.

[I had to do the following](https://github.com/rbenv/rbenv/issues/938#issuecomment-285342541)

1. `sudo xcode-select --install`
2. Install rbenv with `brew install rbenv`
3. Add `eval "$(rbenv init -)"` to the end of `~/.zshrc` or `~/.bash_profile`
4. Install a ruby version `rbenv install 2.4.1`
5. Select a ruby version by rbenv `rbenv global 2.4.1`
6. Open a new terminal window
7. Verify that the right gem folder is being used with `gem env home` (should report something in your user folder not system wide)

> If you are on Windows then just [install Ruby 2.1.0 or higher](https://www.ruby-lang.org/en/downloads/)[^1]

[^1]: [Setting up your GitHub Pages site locally with Jekyll](https://help.github.com/articles/setting-up-your-github-pages-site-locally-with-jekyll/#requirements)

### Install Jekyll

Moving on according to [Jekyll documentation](https://jekyllrb.com/docs/quickstart/).

Install Jekyll and Bundler gems through RubyGems. This may take some time.

```bash
gem install jekyll bundler
```

After everything is installed go to the foler where you want to locate source files for you website and generate a new one

```
jekyll new myblog
```

Change into your new directory

```
cd myblog
```

Build the site on the preview server

```
bundle exec jekyll serve
```

Now open `http://localhost:4000` to see results.


> For some reason after jekyll installation I wasn't able to generate new project with `jekyll new projectName`. Bundler was giving me an error in terminal saying: "An error occurred while installing jekyll-feed (0.9.1), and Bundler cannot continue. Make sure that `gem install jekyll-feed -v '0.9.1'` succeeds before bundling".
So I did run that command `gem install jekyll-feed -v '0.9.1'` and problem was fixed.


### Upload your blog to GitHub

Beeing in your blog's folder instantiate a new repository and commit everything what is in it.

```bash
git init
git add .
git commit -m "Initial commit"
```

Head over to GitHub and create a new repository named `username.github.io`, where username is your username on GitHub.

You will see instructions how to push your existing repository to GitHub. Just copy and paste into your terminal. In my case it was

```
git remote add origin https://github.com/gatezh/gatezh.github.io.git
git push -u origin master
```

Now when you go to http://*username*.github.io you will see your newly created blog.


### Add custom domain

If you have your own domain name go to your newly created repository settings and find there GitHub Pages section. There is a `Custom domain` field.

After that you need to [configure A records with your DNS provider](https://help.github.com/articles/setting-up-an-apex-domain/#configuring-a-records-with-your-dns-provider).
It may take couple of hours for your blog to be accessible using your own domain name.

Create `CNAME` file (without any extension) into your blog's repository. It should contain only one line – your blog's domain name with your domain address. For example gatezh.com.

