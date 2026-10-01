# Image Quiz

A full-screen guessing game for the iPad. The image starts heavily zoomed in and/or pixelated, and each tap reveals a bit more, on a plain white background. Built with Vite + React + TypeScript.

## Run it

```sh
npm install
npm run dev
```

Vite prints a `Local` URL for the Mac and a `Network` URL (`http://<your-mac-ip>:5173`) for the iPad on the same Wi-Fi.
For a true full-screen experience without Safari's toolbar, use **Share → Add to Home Screen** and launch it from the icon.

`npm run build` type-checks and writes a static site to `dist/`; `npm run preview` serves that build locally.

## Deploy to Vercel

Push the repo to GitHub and import it in Vercel. It detects Vite automatically (build command `npm run build`, output directory `dist`), so no extra config is needed. Or deploy from the terminal with `npx vercel`.

The site asks search engines and bots not to index it: a `noindex` `X-Robots-Tag` header on every response (`vercel.json`), a matching `<meta name="robots">` tag, and a `robots.txt` that disallows everything.

## Controls

| Action | Touch | Keyboard |
|---|---|---|
| Next level (4 levels; the last is the plain image) | Tap | Space |
| Show the answer (on the plain image) | Tap | Space |
| Next question (on the answer) | **Next →** button | — |
| Jump to the plain image | Swipe up | Enter |
| Back to menu | Swipe down | Esc |

The **Next →** button is the only way to move to another question, and there's no way back to a previous one.

The whole screen is the tap target, so you can control it blind while holding the iPad facing the players.

## Question order and repeats

Questions play in the order they appear in `src/images.ts`, filtered by the selected category. Once a question's answer is shown, it's remembered in that browser (per device and per URL), **Start** picks up at the first question that hasn't been answered yet and **Next** skips answered ones, so separate videos never repeat a question. The counter shows the position in the whole category (e.g. `7/30`). After the last question, **Next** loops back to question 1 and the category's used questions are cleared. Use **Reset used questions in …** in the menu to start the selected category over; other categories keep their used questions.

## Adding images

Drop files into `public/images/<category>/` and add a line to `src/images.ts` (paths start with `/images/...`). SVG, PNG and JPG all work.
Tweak the difficulty of each level (`LEVELS`) and the transition speed at the top of `src/engine.ts`. You can also pin the zoom spot for an image with `focus: { x: 0.5, y: 0.3 }` (0–1 across/down the image).

Logos come from [gilbarbara/logos](https://github.com/gilbarbara/logos), [Simple Icons](https://simpleicons.org) and Wikimedia Commons (brand trademarks belong to their owners); photos come from Wikimedia Commons.
