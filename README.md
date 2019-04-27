# Sergii Gatezh's personal blog

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

>[Install Hugo](https://gohugo.io/getting-started/installing/) if you still don't have it.

To start Hugo development server with drafts enabled:

```sh
hugo server -D
```
