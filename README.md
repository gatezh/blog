# Serge Gatezh Blog

Personal blog built with Hugo, Tailwind CSS, and Cloudflare Workers.

## Development

### Local Development

Start the Hugo development server:

```sh
bun run dev
```

This runs `hugo server --appendPort=false --baseURL / --bind 0.0.0.0 -D` with special flags for GitHub Codespaces compatibility.

### GitHub Codespaces Configuration

The dev script uses specific Hugo server flags to work properly in GitHub Codespaces:

- `--appendPort=false` - Prevents Hugo from appending the port number to URLs, which breaks Codespaces port forwarding
- `--baseURL /` - Sets the base URL to root, ensuring assets and links work correctly with Codespaces' proxied URLs
- `--bind 0.0.0.0` - Binds the server to all network interfaces, allowing external access from Codespaces' port forwarding
- `-D` - Includes draft content during development

Without these flags, Hugo's default behavior causes issues in Codespaces:
- Links and assets would reference `localhost:1313` instead of the forwarded Codespaces URL
- The server wouldn't be accessible through Codespaces' port forwarding mechanism
- CSS and JavaScript resources would fail to load due to incorrect base URLs

## Adding posts

> To use a specific archetype (`default` in the example below) the following command can be used:
>
> ```sh
> hugo new --kind default ever-learning/name-of-a-post.md
> ```



There are two types of posts:

### Regular blog posts

`posts` slag. Uses `default.md` archetype. 

Create a regular blog post:

```sh
hugo new posts/name-of-a-post
```



### Learning log posts

`ever-learning` slag. Uses `ever-learning.md` archetype.

Create a learning log post:

```sh
hugo new ever-learning/name-of-a-post
```



