---
title: "GraphQL schema: use it in a sentence"
date: 2020-06-22T19:53:28-04:00
description: "Best practices for naming fields in GraphQL schemas. Avoid redundant prefixes and write queries that read like natural sentences."
aliases:
  - /posts/2020/06/22/graphql-schema-use-it-in-a-sentence
---

## TL;DR

**Bad idea**

```js
query getCompanyInfo($id: Int!) {
  company(id: $id) {
    companyId
    companyName
    companyConditionValue
    companyConditionComment
  }
}
```

**Good idea**

```js
query getCompanyInfo($id: Int!) {
  company(id: $id) {
    id
    name
    specialWarning {
      triggered
      reason
    }
  }
}
```

There are a few very simple rules to follow to create an easy to read GraphQL schema. Easy reading schema helps you to reduce the number of visits to your documentation. Especially it helps if your GraphQL schema is not accompanied by any documentation.

## The issue

It takes zero effort to pollute GraphQL schema.

You may come across schema that looks like this:

```js
query getCompanyInfo($id: Int!) {
  company(id: $id) {
    companyId
    companyHotConditionStatus
    companyHotConditionData
  }
}
```

Let's work with this piece of code.

The idea is to use GraphQL schema properties in a sentence.

It is pretty much an extension of ideas of Literate programming by Donald Knuth.

Here are a few rules to make it happen.

### Do not include parts of parent name into a property

Let's say we need to implement a `company` query. A company that is being described with `company` query has a name. You can implement schema like this:

```js
query getCompanyInfo($id: Int!) {
  company(id: $id) {
    companyName
  }
}
```

It does the job, but when you read it...

> Company companyName.

Sounds like stammering. Just as FYI – stammering is not as cute as a British accent.

It is much cleaner without duplication:

```js
query getCompanyInfo($id: Int!) {
  company(id: $id) {
    name
  }
}
```

So it reads

> Company name

### Boolean properties

Boolean properties when included in your GraphQL "sentence" should sound like a statement that you agree/disagree with.

From what you see it may not be obvious to you that `companyConditionValue` in the first example is a _boolean_ type property. But it is!

Let's compare two snippets in a sentence:

```js
query getCompanyInfo($id: Int!) {
  company(id: $id) {
    companyConditionValue
  }
}
```

vs.

```js
query getCompanyInfo($id: Int!) {
  company(id: $id) {
    specialWarning {
      triggered
    }
  }
}
```

Becomes

> Company companyConditionValue

vs.

> Company specialWarning triggered

### 2+ words property names

If you concatenate more than 3 words in a property name it is a sign you may want to create a new level of nesting. Don't put more than 2 words together.

Let's look at the example:

```js
query getCompanyInfo($id: Int!) {
  company(id: $id) {
    companyConditionValue
    companyConditionComment
  }
}
```

Both `companyConditionValue` and `companyConditionComment` describe two different aspects of `company` property. To make it cleaner just create a new layer of nesting:

```js
query getCompanyInfo($id: Int!) {
  company(id: $id) {
    specialWarning {
      triggered
      reason
    }
  }
}
```

This way it reads like:

> Company specialWarning triggered
>
> Company cpecianlWarning reason

### `id`: Leave it alone

Even if you feel very creative, it is better to keep `id` as `id`.

[According to GraphQL specs](http://spec.graphql.org/June2018/#sec-ID), it is used to be a unique identifier and used for caching in many tools (like in Apollo GraphQL Client InMemoryCache)

```js
query getCompanyInfo($id: Int!) {
  company(id: $id) {
    companyId
}
```

vs.

```js
query getCompanyInfo($id: Int!) {
  company(id: $id) {
    id
}
```

Becomes

> Company companyId

vs.

> Company id

---

I hope it will help you to create self-explanatory and easy to use GraphQL schema. Until next time!
