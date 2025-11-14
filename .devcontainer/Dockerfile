FROM alpine:3.22

# Install git and glibc compatibility (required for Hugo)
RUN apk add --no-cache git gcompat

ARG BUN_VERSION=1.3.2
ARG HUGO_VERSION=0.118.2

# Install bun (musl build for Alpine)
RUN wget -q https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-linux-x64-musl.zip && \
    unzip -q bun-linux-x64-musl.zip && \
    mv bun-linux-x64-musl/bun /usr/local/bin/bun && \
    rm -rf bun-linux-x64-musl.zip bun-linux-x64-musl

# Install Hugo Extended
RUN wget -q https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz && \
    tar -xzf hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz && \
    mv hugo /usr/local/bin/ && \
    rm hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz
