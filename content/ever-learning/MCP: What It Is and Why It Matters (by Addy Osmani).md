---
title: 'MCP: What It Is and Why It Matters (by Addy Osmani)'
date: '2025-07-08T10:59:31-06:00'
learning_source: "https://addyo.substack.com/p/mcp-what-it-is-and-why-it-matters"
learning_source_archive: "https://archive.ph/m5GH0"
learning_date: '2025-07-07T10:59:31-06:00'
draft: false
---

**[🔗 Original source]({{< param "learning_source" >}})** | **[🗄️ Archived copy]({{< param "learning_source_archive" >}})**

It’s a huge article. Took me a couple of takes over a few days to absorb it. But it’s worth reading if you want to understand the current state of MCP.

You may not need to read the entire thing — I’d skip the many examples in the middle since they mostly describe the same idea. Basically, it’s just a list of cool MCPs.

The article also highlights current growing pains of MCPs, such as non-standardized authentication methods and other immaturities that create hurdles for mass rollouts in enterprise environments.


## Highlights

All software should be intuitive to use, and this idea doesn’t get old in the age of AI. Those who create crappy UI/UX may be disappointed to learn that AI doesn’t solve that problem. No surprise that building a good MCP also requires it to be *intuitive* for AI to use:

> In terms of **difficulty**, building an MCP server is comparable to writing a small API service for your application. The tricky part is often deciding how to **model your app’s functions in a way that’s intuitive for AI to use**. A general guideline is to keep tools **high-level and goal-oriented** when possible, rather than exposing low-level functions. For instance, instead of making the AI click three different buttons via separate commands, you could have one MCP command “export report as PDF” which encapsulates those steps. The AI will figure out the rest if your abstraction is good.


Some ideas on what interacting with MCP might look like in the near future from a UI/UX perspective:

> **User Interface & Experience Innovations:** On the user side, as these AI agents become more capable, the interfaces might evolve. Instead of a simple chat window, you might have an AI “dashboard” showing which tools are in use, with toggles to enable/disable them. Users might be able to drag-and-drop connections (“attach” an MCP server to their agent like plugging in a device). Also, **feedback mechanisms** could be enhanced – e.g., if the AI does something via MCP, the UI could show a confirmation (like “AI created a file `report.xlsx` using Excel MCP”). This builds trust and also lets users correct course if needed. Some envision a future where interacting with an AI agent becomes like managing an employee: you give it access (MCP keys) to certain resources, review its outputs, and gradually increase responsibility.


## Links

There are also some useful links:

- [A repo with a list of cool MCP servers](https://github.com/punkpeye/awesome-mcp-servers)
- [MCP SDK repo](https://github.com/modelcontextprotocol) which is a standard for implementing MCP servers, and some boilerplates in different languages to help you get started with writing your own MCP server
- [The Ultimate Guide to Model Context Protocol, Part 3: Tying It All Together](https://www.siddharthbharath.com/the-ultimate-guide-to-model-context-protocol-part-3-tying-it-all-together/#:~:text=Quite%20similar%20to%20the%20way,repositories%20using%20the%20GitHub%20MCP) by Sid Bharath
- [List of Awesome MCP Servers](https://github.com/punkpeye/awesome-mcp-servers)

