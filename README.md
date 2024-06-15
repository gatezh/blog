# Serge Gatezh's personal blog

[![Cloudflare Pages Build Status](https://img.shields.io/github/deployments/gatezh/blog/Production?label=Cloudflare%20Pages&logo=cloudflare&logoColor=white&style=for-the-badge)](https://gatezh-com.pages.dev)


Built with [Hugo](https://gohugo.io/).

## Development

### Clone

This repository contains theme submodule. To clone repository with all its submodules:

```sh
git clone --recursive
```

If you have already cloned the repository with `git clone` you need to download submodules before starting dev server:

```sh
git submodule update --init
```

### Start

> [Install Hugo](https://gohugo.io/getting-started/installing/) if you still don't have it.

To start Hugo development server with drafts enabled:

```sh
hugo server -D
```
