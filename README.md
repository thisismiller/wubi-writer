# HSK Writer · 汉字练习

A Progressive Web App for practising Chinese reading and writing. Select a story, then type each sentence line-by-line — your input is aligned directly beneath the target so every character lands in place.

## Features

- **Story-based practice** — stories are plain `.txt` files, one sentence per line
- **Character-by-character feedback** — correct characters turn green, wrong ones red, as you type
- **Chinese IME support** — composition events are guarded so pinyin input works correctly
- **Offline-first PWA** — installable, works without a network after first load
- **HSK-1 vocabulary** — starts with a simple greetings story; easy to add more

## Adding stories

Drop a `.txt` file in `public/stories/` (one sentence per line) and add an entry to `public/stories/index.json`:

```json
{
  "id": "my-story",
  "title": "故事标题",
  "titleEn": "Story Title",
  "level": "HSK 1",
  "file": "my-story.txt",
  "description": "Short description"
}
```

## Development

```bash
npm install
npm run dev      # dev server at localhost:5173/hsk-writer/
npm run build    # production build → dist/
npm run preview  # preview the production build locally
```

## Deployment

Pushes to `main` trigger a GitHub Actions workflow that builds the app and deploys it to **GitHub Pages**.

To enable deployment, go to **Settings → Pages → Source** and select **GitHub Actions**.

The live app is served at `https://thisismiller.github.io/hsk-writer/`.
