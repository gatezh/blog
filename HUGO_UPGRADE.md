# Hugo Version Upgrade Guide

## Current Setup

**Current Version:** Hugo v0.118.2
**Issue:** The `css.TailwindCSS` pipe requires Hugo v0.121.0+

## Workaround (Current)

The contact form currently uses a static CSS approach that works with Hugo v0.118.2:
- Tailwind CSS is built separately via `npx @tailwindcss/cli`
- Generated file: `static/css/tailwind.css`
- The shortcode links to the static CSS file

## Upgrading Hugo

### For Cloudflare Pages Deployment

Set the `HUGO_VERSION` environment variable in your Cloudflare Pages project:

1. Go to your Cloudflare Dashboard
2. Navigate to **Workers & Pages** → Your Pages project
3. Go to **Settings** → **Environment variables**
4. Add a new variable:
   - **Variable name:** `HUGO_VERSION`
   - **Value:** `0.138.0` (or latest from [Hugo Releases](https://github.com/gohugoio/hugo/releases))
5. Redeploy your site

### For Local Development (Linux/macOS)

**Option 1: Using Snap (Recommended for Linux)**
```bash
sudo snap install hugo
```

**Option 2: Download Binary**
```bash
# Download latest Hugo extended
HUGO_VERSION="0.138.0"
wget https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz

# Extract
tar -xzf hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz

# Move to PATH
sudo mv hugo /usr/local/bin/

# Verify
hugo version
```

**Option 3: Using Homebrew (macOS)**
```bash
brew install hugo
```

## After Upgrading to Hugo 0.121.0+

Once Hugo is upgraded, you can optionally switch to Hugo's built-in Tailwind processing:

1. Update `layouts/shortcodes/contact-form.html`:
```html
{{ $css := resources.Get "css/input.css" | css.TailwindCSS }}
{{ if hugo.IsProduction }}
  {{ $css = $css | minify | fingerprint }}
{{ end }}
<link rel="stylesheet" href="{{ $css.RelPermalink }}"{{ with $css.Data.Integrity }} integrity="{{ . }}"{{ end }}>
```

2. Update `package.json` - remove build scripts:
```json
{
  "scripts": {
    "dev": "hugo server -D",
    "build": "hugo"
  }
}
```

3. Hugo will process Tailwind automatically - no separate build step needed!

## Benefits of Upgrading

- ✅ Native Tailwind CSS processing (no separate build step)
- ✅ Automatic CSS minification and fingerprinting in production
- ✅ Better development experience with hot reload
- ✅ Cleaner build process
- ✅ Latest Hugo features and security fixes

## Current State

The current setup works fine with Hugo v0.118.2 - upgrading is optional but recommended for better developer experience.
