# Phones and landscape

A photo book opens across two pages, so phones read it sideways by default.

## On the web

When a phone or tablet is held upright, the viewer covers the book with a prompt to turn the device. It offers:

- **Open full screen**, which also locks the screen to landscape where the browser allows it (Chrome on Android).
- **Read one page at a time**, which switches to single pages for the rest of the visit.

Pass `landscape={false}` to skip the prompt, or `layout="single"` to always show one page. With `layout="auto"` (the default) the viewer also falls back to single pages whenever its box is taller than it is wide.

## On React Native

With [`expo-screen-orientation`](https://docs.expo.dev/versions/latest/sdk/screen-orientation/) installed, the viewer locks the screen to landscape while the book is open and puts the previous lock back when it closes. Without it, phones held upright see the same prompt as on the web, with the single-page option.

Pass `landscape={false}` to leave orientation alone.
