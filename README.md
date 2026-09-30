# Image Quiz

A full-screen guessing game for the iPad. The image starts heavily zoomed in and/or pixelated, then slowly reveals itself on a plain white background.

## Run it

```sh
python3 -m http.server 8000
```

On the iPad (same Wi-Fi), open `http://<your-mac-ip>:8000`. Find the IP with `ipconfig getifaddr en0`.
For a true full-screen experience without Safari's toolbar, use **Share → Add to Home Screen** and launch it from the icon.

## Controls

| Action | Touch | Keyboard |
|---|---|---|
| Next level (4 levels; the last is the plain image) | Tap | Space |
| Next question (on the plain image) | Tap | Space |
| Next / previous question | Swipe left / right | → / ← |
| Jump to the plain image | Swipe up | Enter |
| Back to menu | Swipe down | Esc |

The whole screen is the tap target, so you can control it blind while holding the iPad facing the players.

## Question order and repeats

Questions play in the order they appear in `images.js`, filtered by the selected categories. Every question that's shown is remembered on that device and skipped in later sessions, so separate videos never repeat a question. Use **Reset used questions** in the menu to start over.

## Adding images

Drop files into `images/<category>/` and add a line to `images.js`. SVG, PNG and JPG all work.
Tweak the difficulty of each level (`LEVELS`) and the transition speed at the top of `app.js`. You can also pin the zoom spot for an image with `focus: { x: 0.5, y: 0.3 }` (0–1 across/down the image).

Logos come from [Simple Icons](https://simpleicons.org) (brand trademarks belong to their owners); photos come from Wikimedia Commons.
