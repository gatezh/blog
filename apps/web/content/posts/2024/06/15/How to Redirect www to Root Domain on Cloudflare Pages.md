---
title: "How to Redirect www to Root Domain on Cloudflare Pages"
date: 2024-06-15T16:35:02-06:00
lastmod: 2025-08-13T18:26:02-06:00
aliases:
  - /posts/2024/06/15/posts/fixing-www-issue-for-cloudflare-pages-website
draft: false
---

**Prerequisites:**

1. Your website is hosted on Cloudflare Pages.
2. Your website is not accessible when there is `www` in front of your apex domain.
3. You kind of know what you're doing.

Recently, I was talking to people and at some point, I mentioned having my website. What stumbled me was that first, some people are still using `www` when typing the name of the website. And second, it turns out my website didn't work with `www` in front of it. I was pretty sure it was set up a long time ago, but apparently, when I was moving my website and DNS records to Cloudflare, something went wrong.

![Connection timed out](/images/post-fixing-www/1-Connection-timed-out.png)

When I started to look into how to fix it, I didn't find anything useful. So I decided that the Internet deserves yet another tutorial on how to fix the `www` DNS record for your website using Cloudflare.

Essentially, I came across two different ways to solve this issue. By issue, I mean the website is not opening when you have `www` in front of it. The first solution is to just "enable" your website to work with `www`. It means that if you have a domain name `gatezh.com` and your user opens `www.gatezh.com` and follows any link within the website, it will be just `www.gatezh.com/blog`.

That's fine, but I prefer to use a shorter non-www version, so I started to look for a way to make a redirect: when a user goes to `www.gatezh.com`, it opens `gatezh.com` instead.

Let's start with the first scenario.

## Step 1: "Activate" `www` Subdomain

> ⚠️ **Disclaimer**: Unfortunately, it's not enough to just add a CNAME record for `www` to redirect to your Cloudflare Pages domain at YOUR-WEBSITE-NAME.pages.dev

If you want visitors to access your site with www in front of the domain — and keep www visible in the address bar instead of redirecting to the root domain — open your Cloudflare dashboard > select **Workers & Pages** on the left panel > select your website.

Then select **Custom domains** at the top. Here you press the **Set up a custom domain** button and enter your domain with `www` (like `www.gatezh.com`).

If you already had a CNAME record in your DNS settings pointing to your Cloudflare pages.dev website, it will just show you that record, notifying you that it will replace it with... exactly the same record.

![Adding www custom subdomain](/images/post-fixing-www/2-Adding-www-custom-subdomain.png)

The only difference is that it is going to work now. Hit the **Activate domain** button and it will work pretty much immediately.

![Custom domain verification](/images/post-fixing-www/3-Custom-domain-verification.png)

## Step 2: Redirect to a Root Domain

I want to redirect users to `gatezh.com` when they try to access `www.gatezh.com`.

There are many posts out there about how to make it happen with Cloudflare, but it seems like all of the posts out there are outdated. They suggest using **Page Rules**, but if you locate it in your website's settings panel to the left, there will be a nice red **Legacy** label next to it.

![Page Rules (legacy)](</images/post-fixing-www/4-Page-Rules-(legacy).png>)

Not to worry. Cloudflare has very useful documentation describing how to make this change in a new way. There is even an example exactly for the case we need to [Migrate Forwarding URL: Example #1: Redirect `www` to root domain](https://developers.cloudflare.com/rules/reference/page-rules-migration/#migrate-forwarding-url). There is even a _Visual guide_ on how settings should look for your website.

![Setting up redirect](/images/post-fixing-www/5-Setting-up-redirect.png)

Just follow along and deploy your changes. Works as expected!

![Successful redirect](/images/post-fixing-www/6-Successful-redirect.png)

> **Note** that if you made the `www` version of your website work by following the first part of this tutorial, it won't be opening anymore since, well... it now redirects to your non-www version.

## Conclusion

I hope this short tutorial helped you set up a `www` redirect for your Cloudflare Pages website. Feel free to share in the comments if you found it useful — or if you happen to know why simply adding a `CNAME` record for the `www` subdomain doesn’t do the trick. Thanks in advance!
