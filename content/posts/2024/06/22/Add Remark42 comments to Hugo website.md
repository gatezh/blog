---
title: "Add Remark42 comments to Hugo website"
date: 2024-06-22T21:00:06-06:00
draft: false
---

## Intro

I've been looking to replace Disqus comments engine for my blog for a long time now. Additionally, I started working on another project where I would like to have people leave their opinions. So, it was a good motivation to finally do some research and get to action.

To make it short, I won't go into all the reasons why I was looking into alternatives to Disqus. But it's about respecting my visitors' privacy and having more control over my own platform (my blog).

Having that in mind, I came across this beautiful privacy-focused, lightweight commenting engine - [remark42](https://remark42.com). And it's open source.

[The creator](https://github.com/umputun) (and contributors) of remark42 did a fantastic job packing it into a Docker container, so the only few things you need to do to make it work are to:

Find where to spin those Docker containers (a server)
Configure it on your server
Configure it in your blog
Looks easy, but I had a lot of questions on how exactly to accomplish the above. Googling gave me a lot of articles on the topic, but I found many of them skipping important steps (like how to actually add it to my Hugo website), or including unnecessary steps (like installing nginx and serving your comments through it). Hence, I decided that the internet needs yet another tutorial on how to add remark42 comments to your Hugo website.

First things first - you need a server.

## Coming across Vultr

I was shopping around for the cheapest VM out there and came across Vultr. The cheapest VM they have costs $2.50 per month, but it is IPv6 only. At first, I thought, "Well, it is 2024! There should not be any issues with IPv6. And if there are some users that won't be able to see comments on my blog - oh well." So, I went ahead and created the cheapest VM they had. It's only after I had issues connecting to my newly created VM that I decided to check whether my own ISP supports IPv6. And the answer was:

> We currently do not support IPv6 and do not have any plans to implement it in the near future.

Thank you very much.

That's why I would suggest you stick to their $3.50 per month VM offer, which is still the cheapest option I have found (among kind of reputable providers, IMHO).

## Create a Vultr Account

Since you are reading this tutorial, you might be interested in getting a cheap VM too! If so, you can use [this limited time referral link](https://www.vultr.com/?ref=9622544-8H) to get $100 to test Vultr platform. Or when the above promo expires, use [this referral link](https://www.vultr.com/?ref=9622543) as a "thank you" for this tutorial. Thank you in advance.

## Pick the Right VM

Even though there is this $3.50/mo IPv4 VM in their pricing, you may experience some difficulty figuring out how to get the VM for that price. To create a VM, select **Products** > **Compute** > **Deploy Server**. In the **Choose Type** section, select **Cloud Compute - Shared CPU**.

![Choose Type](https://gatezh-com.pages.dev/cdn-cgi/image/format=auto/https://gatezh-com.pages.dev/images/post-add-remark42-comments-to-hugo-website/1-Choose-Type.png)

Keep **New York** as your location in the Choose Location option. As per my communication with support:

> We currently offer the $2.50 per month plans exclusively at our NJ and Atlanta locations. Additionally, the plans starting at $3.50 per month are available only in NJ.

![Choose Location](/images/post-add-remark42-comments-to-hugo-website/2-Choose-Location.png)

When you get to the **Choose Image** section, there is again a caveat. I initially chose Ubuntu, but Ubuntu requires at least 1GB of RAM, so it's not an option for the cheapest VM. I had to go with Debian since that's the other Linux distribution I'm familiar with. Alpine Linux or Fedora CoreOS are better suited for what I was trying to accomplish here, but again, since I wasn't familiar working with those, I decided to go with Debian. I may try to use Alpine Linux next time.

![Choose Image](/images/post-add-remark42-comments-to-hugo-website/3-Choose-Image.png)

In the **Choose Plan** section, switch to the **Regular Cloud Compute** tab, and you should be able to locate the $3.50/month option second in the list.

![Choose Plan](/images/post-add-remark42-comments-to-hugo-website/4-Choose-Plan.png)

I haven't picked the $2.50 per month option because, again, my ISP does not support IPv6.

In **Additional Features**, I've decided to skip the **Auto Backups** option since I'm planning to set up my own backup system. Feel free to keep it, though, if you are not planning to have your own backups. You can also enable it later in the VM's settings if needed.

In **Server Settings**, you can upload your public SSH key for easy access. I won't provide many details on SSH key authentication since it's a separate topic. If you would like me to elaborate on this, feel free to mention it in the comments, and I'll add more details on how it works and how to set it up. But if you want to keep it simple (and less secure) - you can skip this setting.

Hit **Deploy Now**, and you should get your VM created.

Server added successfully! Yay!

![Server added successfully](/images/post-add-remark42-comments-to-hugo-website/5-Server-added-successfully.png)

You can now open your terminal and establish an SSH connection by using the credentials available in your Server Details.

![Server details](/images/post-add-remark42-comments-to-hugo-website/6-Server-Details.png)

Just type in your terminal:

```
ssh root@your-server-ip
```

If you've provided an SSH key, you won't even need to use a password!

## Secure Your VM

I won't go too deep into this, but you should make at least some effort to secure your VM. It is for your own good, as well as for the people who spent time leaving comments on your blog - you don't want to lose those comments.

### Adding Firewall Rules

Vultr has a firewall called `Vultr Firewall`. They have pretty good [documentation](https://docs.vultr.com/vultr-firewall) on it. Please, spare a few minutes to create a few rules to limit access to your VM for ports that you will actually use.

You can create a new Firewall Group in **Products** > **Network** > **Firewall**. Here's how it may look:

![Firewall rules](/images/post-add-remark42-comments-to-hugo-website/7-Firewall-rules.png)

Don't forget to link those rules to your VM in the **Linked Instances** tab (or in your VM's settings) to apply them.

![Link firewall](/images/post-add-remark42-comments-to-hugo-website/8-Link-firewall.png)

### Add fail2ban

Here is a good [video](https://www.youtube.com/watch?v=kgdoVeyoO2E) on how it can be set up. It takes 5 minutes and is **strongly recommended**.

### Avoid Using `root` User

As you may already know, it is always advisable to use a non-root account. Apparently, there is already a non-root user created named `linuxuser`. To make SSH authentication work properly, you'll need to copy `authorized_keys` from `/root/.ssh/` to `/home/linuxuser/.ssh`.

```
cp /root/.ssh/authorized_keys /home/linuxuser/.ssh/authorized_keys
```

And while you are still logged in as `root`, it may be a good idea to set an account password for the user `linuxuser`. For that, run:

```
sudo passwd linuxuser
```

and provide a password for that user. You will be asked for that password every time you want to run something with the sudo command while being logged in as `linuxuser`.

And one more thing – add `linuxuser` to a special list to actually be able to run commands using `sudo`, aka the sudoers file:

```
usermod -aG sudo linuxuser
```

You can now disconnect (CTRL + d) and log in as `linuxuser`:

```
ssh linuxuser@your-server-ip
```

## Installing Docker

After you SSH to your VM, you can pretty much follow [the official Docker documentation on installing Docker on Debian](https://docs.docker.com/engine/install/debian/). Just enter the following commands one by one:

```
# Uninstall old versions
for pkg in docker.io docker-doc docker-compose podman-docker containerd runc; do sudo apt-get remove $pkg; done

# Add Docker's official GPG key:
sudo apt-get update
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update

sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

After installing Docker, you can test if it works with the `sudo docker run hello-world` command. The output should look similar to this:

![Docker hello-world](/images/post-add-remark42-comments-to-hugo-website/9-Docker-hello-world.png)

Configure Docker to run containers as `linuxuser`:

```
sudo nano /etc/systemd/system/sockets.target.wants/docker.socket
```

You may need to reboot for the above changes to take effect:

```
sudo reboot
```

## Install Remark42

After following a few tutorials and experimenting with different ways to do it, I've landed on the [Reproxy configuration option](https://remark42.com/docs/manuals/reproxy/). I found it the easiest to install and maintain.

> Fun fact: the author of `remark42` is the author of `reproxy` as well.

First, let's create a directory where your `docker-compose.yml` file will be located (and eventually the comments database as well).

```
mkdir remark42
```

Navigate into the newly created directory:

```
cd remark42
```

Create the `docker-compose.yml` file:

```
sudo nano docker-compose.yml
```

You can take the configuration from the [Configure with Reproxy](https://remark42.com/docs/manuals/reproxy/) page from the official remark42 documentation. For my blog, I've decided to only have GitHub authentication and avoid the complexities of setting up email authentication for users. My blog is developer-focused anyway! And what is a developer without a GitHub account, right? 😉

If you (like me) want to only have GitHub user authentication, you can check how to set it up in the [Authorization](https://remark42.com/docs/configuration/authorization/) section of the official remark42 documentation, scroll to the GitHub section.

And here is my configuration:

> ⚠️ Obviously, replace the following parameters with your own:
>
> - `SSL_ACME_EMAIL`
> - `SSL_ACME_FQDN`
> - `SECRET`
> - `REMARK_URL`
> - `AUTH_GITHUB_CID`
> - `AUTH_GITHUB_CSEC`
> - `reproxy.server` More details on each of the values can be found in the [Command-Line Interface parameters](https://remark42.com/docs/configuration/parameters/) section of the remark42 documentation.

`docker-compose.yml`

```
version: "3.4"

services:
  reproxy:
    image: umputun/reproxy:master
    restart: always
    hostname: reproxy
    container_name: reproxy
    ports:
      - "80:8080"
      - "443:8443"
    environment:
      - DOCKER_ENABLED=true
      - SSL_TYPE=auto
      - SSL_ACME_EMAIL=your-email-here
      - SSL_ACME_FQDN=comments.gatezh.com
      - SSL_ACME_LOCATION=/srv/var/ssl
      - GZIP=true
      - LOGGER_ENABLED=true
      - LOGGER_FILE=/srv/var/logs/access.log
      - LOGGER_STDOUT=true
      - ASSETS_CACHE=30d,text/html:30s
      - HEADER=X-XSS-Protection:1;mode=block;,X-Content-Type-Options:nosniff

    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./var/ssl:/srv/var/ssl
      - ./var/logs:/srv/var/logs

  remark42:
    image: umputun/remark42:master
    container_name: "remark42"
    hostname: "remark42"
    restart: always
    environment:
      - MHOST
      - SECRET=your-secret-key
      - USER=app
      - REMARK_URL=https://comments.gatezh.com
      - CACHE_MAX_VALUE=10000000
      - IMAGE_PROXY_HTTP2HTTPS=true
      - AVATAR_RESIZE=48
      - IMAGE_MAX_SIZE=5000000
      - EMOJI=true
      - AUTH_ANON=false # Forbid anonymous commenting
      # GitHub
      - AUTH_GITHUB_CID=your-value-here
      - AUTH_GITHUB_CSEC=your-value-here
    ports:
      - "8080"
    volumes:
      - ./var/remark42:/srv/var
    labels:
      reproxy.server: comments.gatezh.com
      reproxy.port: "8080"
      reproxy.route: "^/(.*)"
      reproxy.dest: "/$$1"
      reproxy.ping: "/ping"
```

Save and exit.

Now you are ready to start the Remark42 containers:

```
docker compose pull && docker compose up -d
```

## Adjust your DNS records

Now you need to add an **A** record to your DNS settings, essentially creating a third-level domain name. In my case, I've created a sub-domain _comments_ and pointed it to my Vultr VM IP address.

![DNS A record](/images/post-add-remark42-comments-to-hugo-website/10-DNS-A-record.png)

If you visit your newly created sub-domain name with `/web`, you should see your Remark42 comments demo page. In my case, it is `comments.gatezh.com/web`.

![Remark42 demo page](/images/post-add-remark42-comments-to-hugo-website/11-Comments-demo-page.png)

Great! We're almost there. The only thing left is to add comments to your blog posts.

## Adding comments section to Hugo blog

Interestingly enough, it was pretty hard to find a good (any) article about Remark42 comments integration that actually covers this step. It reminded me of that famous "[how to draw an owl](https://knowyourmeme.com/photos/572078-how-to-draw-an-owl)" meme.

Anyway, let's jump into business.

You need 3 things to accomplish this integration.

### Create configuration

First, we need to create a configuration for our comments and place it into the `head` section of our blog. I have a separate partial for my blog head, so I had to amend that file with the following config:

`layouts/partials/head.html`

```
...
<!-- Remark42 comments -->
<script>
  var remark_config = {
    host: 'https://comments.gatezh.com',
    site_id: 'remark',
    components: ['embed'],
    max_shown_comments: 100,
    theme: 'light',
    page_title: '{{ .Title }}',
    show_email_subscription: false,
    simple_view: false,
    no_footer: true,
    locale: 'en',
  };
</script>
<!-- End Remark42 comments -->
...
```

You can find details about which parameter does what in the [Frontend Configuration](https://remark42.com/docs/configuration/frontend/) section of the Remark42 documentation.

> ⚠️ Even though `site_id` is optional according to the documentation, it didn't work for me without that property for some reason.

### Create `comments` partial

Depending on how you have structured your project, you may need to create this partial in a different place, but for me it is in `layouts/partials/comments.html` and it looks like this:

```
<script>!function(e,n){for(var o=0;o<e.length;o++){var r=n.createElement("script"),c=".js",d=n.head||n.body;"noModule"in r?(r.type="module",c=".mjs"):r.async=!0,r.defer=!0,r.src=remark_config.host+"/web/"+e[o]+c,d.appendChild(r)}}(remark_config.components||["embed"],document);</script>
<div id="remark42"></div>
<noscript>Please enable JavaScript to view the comments.</noscript>
```

You can find this code in [the Remark42 documentation](https://remark42.com/docs/configuration/frontend/) under the **Basic configuration** and **Comments** sections.

### Adding to a page

Now the simplest part – you just need to use your newly created `comments` partial. Most likely, you want to use it in `layouts/_default/single.html`. Just paste this code wherever you want your comments to appear (usually it is below your post body and before the footer):

```
{{ partial "comments.html" }}
```

And that's it! Commit, push, deploy!

## Conclusion

With this tutorial, I was trying to find a balanced approach to provide details on how to do each of the steps, but also to not go too deep into the woods. Obviously, there is more to securing your Linux VM, managing your SSH connections, and backing up your comments engine data. If you want more details on any part of this tutorial, please let me know.

If you find this tutorial useful, feel free to use my Vultr referral links. Again, you can use [this limited time referral link](https://www.vultr.com/?ref=9622544-8H) to get $100 to test the Vultr platform. Or when the above promo expires, use [this referral link](https://www.vultr.com/?ref=9622543) as a "thank you" for this tutorial.

I hope you found it useful.

Thank you for reading.

Leave a comment below!
