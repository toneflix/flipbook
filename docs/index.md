---
layout: home

hero:
  name: Toneflix Flipbook
  text: An expressive flipbook
  tagline: For creating personalised and interactive reading and photo viewing experiences.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Open the playground
      link: /playground
    - theme: alt
      text: GitHub
      link: https://github.com/toneflix/flipbook

features:
  - title: A page that answers your hand
    details: Grab any corner or edge and the page folds exactly where your finger bends it. Let go and it drifts open or shut with the weight of your flick, never a canned animation.
  - title: Printed, not pasted
    details: Photos take on the paper's ink, its grain and the curve into the spine. Fourteen frames from a hairline rule to gilt, twelve layouts from full bleed to loose prints, on ivory, white, kraft or charcoal stock.
  - title: Opens like a book on phones
    details: Turn the phone sideways and the album lies open across two pages, the way it would in your hands. One page at a time is a tap away.
  - title: One book, every screen
    details: The same book data and the same physics in plain JavaScript, Vue, React and React Native, on a framework-free core you can drive yourself.
---

<div class="home-demo vp-raw">
  <ReactIsland name="demo" />
  <p>Drag a corner, flick a page, tap the edges or use the arrow keys.</p>
</div>

<section class="home-story">

## Why this exists

For years, [turn.js](https://github.com/blasten/turn.js) was how the web turned pages. It showed what a flipbook in the browser could feel like, and then it stopped moving: no maintenance, no touch-first rethink, and no React or React Native.

When I needed a flipbook for [Toneflix Photos](https://photos.toneflix.net), I tried the modern route and asked coding agents to build one. Agents are good at plumbing and poor at craft. Prompted by a junior developer, or anyone who doesn't already know what a good page turn looks like, they produce a page that slides instead of folds, a shadow in the wrong place, photos pasted on top of the paper, a book that falls apart on a phone held upright. Getting from there to something that feels like a real album is hundreds of small decisions, and nobody should have to make them again.

So this library makes them once. The fold follows the finger. The spring carries the weight of the flick. Prints sink into the paper's grain and curve into the spine. Phones open the book sideways. Pass it a list of photos and you get all of that, whether you're a person or an agent writing the integration.

Everyone, and every agent, should be able to build something beautiful with a flipbook in it, without sweating the details. These ones are figured out.

<p class="home-story-sign">— Obi, Toneflix</p>

</section>
