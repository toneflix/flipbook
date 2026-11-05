---
title: Playground
layout: page
---

<div class="playground-page">

# Playground

Change any option and the book updates as you go. The **Code** tab has the props and book data to reproduce what you see.

<ReactIsland name="playground" />

</div>

<style>
.playground-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}
.playground-page h1 {
  font-size: 32px;
  font-weight: 600;
  line-height: 1.2;
}
.playground-page > p {
  margin: 8px 0 24px;
  color: var(--vp-c-text-2);
}
@media (max-width: 640px) {
  .playground-page {
    padding: 24px 12px 48px;
  }
}
</style>
