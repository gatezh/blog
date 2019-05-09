---
layout: post
title:  "Using Anki to study programming"
date:   2017-07-16 20:04:19 -0400
permalink: /using-anki-to-study-programming.html
categories:
published: true
---

## Why it works

Anki is based on [spaced repetition](https://en.wikipedia.org/wiki/Spaced_repetition) learning technique.

I will try to explain it shortly. When you learn something new you have to repeat it to remember it. If you repeat that information too often - you just waste your time. But if you don't repeat it at the right time - you forget it. So the problem here is to figure out *the right interval* for repetitions. Anki is the tool to help with that task.


Before starting to use it there are some rules:

#### I. create **your own** cards

There are two reasons:

1) Flash-cards are made to remember information, but not study. Your cards are bread crumbs that allow you to get back to that room in your memory that has information you need.

Creating cards in Anki takes some time, but benefits from it are huge. Consider it as an investment: you spend some time now but will have a great return in the future.

2) You need to study things that you really need and going to use. It may be cool to know all the *npm* commands, but are you going to use them all? When you don't use them you don't even know when developers changed something and it doesn't work anymore. So it is better to make your own collection of things you want to memorize that you actually going to use.


#### II. open Anki **every day** for review

The key element of *spaced repetition* is... well, repetition. You should check your Anki decks every day to make sure that you go through all those cards that need to be repeated. I would recommend to put a reminder or create a task in a task manager and set it for every day repeat. This way you won't forget about it.


### Setting up Anki

After you have downloaded and installed Anki it needs some tune up to fit our needs.

1. Create a new deck
2. Click `Add` button to add a card
3. In the window that just appeared choose Type: Cloze
3. Click on `Cards...` button
4. Replace `Front Template` section with this:

	{% raw %}
	```
	{{cloze:Text}}<br>
	{{type:cloze:Text}}﻿
	```
	{% endraw %}

5. Replace `Styiling` section with:

	```
	.card {
	 font-family: arial;
	 font-size: 20px;
	 text-align: left;
	 color: black;
	 background-color: white;
	}
	
	.cloze {
	 font-family: monospace;
	 font-weight: bold;
	 color: blue;
	}
	```

6. Replace `Back Template` with:

	{% raw %}
	```
	{{cloze:Text}}<br>
	{{type:cloze:Text}}﻿<br>
	{{Extra}}
	```
	{% endraw %}

Now you are ready.


### How to use it

Let's say you are reading about JavaScript ES6 template literals and want to memorize the syntax, so you can use it if needed.

1. Create a new card of type *Cloze*
2. Add code snippet into *Text* area of your card to look like this:

	```
	ES6 template literals
	var customerName = "John Smith";
	console.log(`Hello ${customerName}`);
	```

3. Select *\`Hello ${customerName}\`* part and press *Cloze deletation* button (looks like this --> `[...]`). At the end your code will look like this:

	{% raw %}
	```
	ES6 template literals
	var customerName = "John Smith";
	{{c1::console.log(`Hello ${customerName}`);}}
	```
	{% endraw %}


4. You can add some additional information to *Extra* section. Reference link for example.

5. Press `Add` button and your new card will be saved.

When you open your deck and press `Study Now` button you will see your card with that part you just selected hidden. Below you will see an input field to type in the hidden part.

Now we have something like a code simulator. By constantly practicing new things this way you will memorize new syntax much faster. 