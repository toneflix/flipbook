# Phones and landscape

A photo book opens across two pages, so phones read it sideways by default.

## On the web

When a phone or tablet is held upright, the viewer covers the book with a prompt to turn the device. It offers:

- **Open full screen**, which also locks the screen to landscape where the browser allows it (Chrome on Android).
- **Read one page at a time**, which switches to single pages for the rest of the visit.

Pass `landscape={false}` to skip the prompt, or `layout="single"` to always show one page. With `layout="auto"` (the default) the viewer also falls back to single pages whenever its box is taller than it is wide.

## Full screen on open

Browsers only let a page go full screen after the reader taps or presses a key. For a link that should open straight into the book, pass `fullscreenPrompt`:

```tsx
<Flipbook book={book} fullscreenPrompt />
```

The book opens under a **Tap to open full screen** prompt. The first tap or key press takes it full screen and locks landscape where the browser allows it; <kbd>Esc</kbd> closes the prompt and stays in the page. Browsers that can't put a page full screen (Safari on iPhone) never see the prompt, and phones held upright get the rotate prompt above, which offers full screen itself.

Change the text with the `fullscreenPrompt` [label](/api/options#labels).

## On React Native

With [`expo-screen-orientation`](https://docs.expo.dev/versions/latest/sdk/screen-orientation/) installed, the viewer locks the screen to landscape while the book is open and puts the previous lock back when it closes. Without it, phones held upright see the same prompt as on the web, with the single-page option.

Pass `landscape={false}` to leave orientation alone.
