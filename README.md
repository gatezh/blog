# Sergii Gatezh's personal blog

[![Netlify Status](https://api.netlify.com/api/v1/badges/2d11f6b1-6693-4f77-aaa3-bbb1d1b0a36d/deploy-status)](https://app.netlify.com/sites/gatezh/deploys)

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

### Test updates
