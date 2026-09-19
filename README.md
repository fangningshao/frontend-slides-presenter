# Frontend Slides Presenter

An agent skill that adds speaker notes and a dual-window Presenter Mode to
[Frontend Slides](https://github.com/zarazhangrui/frontend-slides) HTML
presentations—without replacing the deck's design, animations, or navigation.

## 📺 Watch the Walkthrough

<!-- Reserved for a walkthrough video. -->

## What This Does

**Frontend Slides Presenter** turns the original slides window into a clean
audience display and opens a separate presenter window for the speaker.
Everything remains local and can still be delivered as one portable HTML file.

<a href="demo/index.html" title="Open the multilingual Frontend Slides Presenter demo">
	<img src="demo/demo.png" alt="Frontend Slides Presenter audience and presenter windows" width="100%" />
</a>

> **[Open the multilingual HTML demo →](demo/index.html)** — switch the slides,
> presenter interface, and speaker notes among English, 中文, 日本語, 한국어,
> Español, Français, Deutsch, العربية, and Português.

### Key Features

- **Two synchronized windows** — Keep the audience view on the projector and
	Presenter Mode on the laptop.
- **Per-slide speaker notes** — Edit notes while presenting, retain drafts in
	browser storage, and save them into a portable HTML file.
- **Current and next previews** — See where the talk is and what comes next.
- **Presentation controls** — Navigate, jump to a slide, manage the timer,
	change note size, and temporarily black out the audience display.
- **Laser and pen tools** — Point or draw in either window with synchronized,
	per-slide annotations.
- **No web runtime dependency** — The presenter runtime is embedded directly
	into the deck.
- **Native deck behavior preserved** — The existing slide controller remains
	the source of truth for navigation, animations, editing, and export.

## Installation

Clone or copy this repository into the skills directory used by your coding
agent. For a standalone Claude Code installation:

```bash
git clone <repository-url> ~/.claude/skills/frontend-slides-presenter
```

Other coding agents can use the repository directly. Ask the agent to start
from `SKILL.md`; it will load `references/integration.md`,
`assets/presenter.js`, and `scripts/embed.py` when needed.

This is an extension for Frontend Slides. Install or otherwise make the
[Frontend Slides skill](https://github.com/zarazhangrui/frontend-slides)
available when creating a new deck. Existing compatible HTML decks can be
extended directly.

## Usage

### Ask an Agent

Invoke the installed skill and describe the deck to create or update:

```text
/frontend-slides-presenter

> "Add presenter mode and speaker notes to my presentation.html"
```

The agent will:

1. Create or inspect the Frontend Slides deck.
2. Add a notes template to each slide.
3. Connect Presenter Mode to the deck's existing controller.
4. Embed the shipped presenter runtime into the output HTML.
5. Open the result and verify navigation, notes, previews, and annotations.

### Integrate Manually

First, retain the deck's controller instance and expose the small adapter
described in `references/integration.md`:

```js
const presentation = new SlidePresentation();
window.frontendSlidesPresenterAdapter = {
	slides: () => Array.from(presentation.slides),
	getIndex: () => presentation.currentSlide,
	goTo: index => presentation.showSlide(index),
	stage: presentation.stage
};
```

Add plain-text notes inside each slide:

```html
<section class="slide" id="opening">
	<h1>Build for the room.</h1>
	<template data-presenter-notes>Pause, look at the audience, then begin.</template>
</section>
```

Then embed the presenter runtime:

```bash
python scripts/embed.py presentation.html presentation-with-presenter.html
```

The input and output paths may be the same for an intentional in-place update.
Running the command again updates the existing marked runtime block instead of
adding a duplicate.

## Presenting

1. Connect the projector and enable **extended desktop** rather than mirroring.
2. Open the generated HTML file in a browser.
3. Press **P** or click the Presenter control to open Presenter Mode.
4. Keep Presenter Mode on the laptop and move the original slides window to
	 the projector.
5. Click the audience window and press **F** to enter fullscreen.

> **Presenting online:** In Zoom, Microsoft Teams, Skype, Tencent Meeting, or
> similar apps, press **P** to open the separate Presenter view, then share
> only the original main slides window. Your audience sees the clean
> presentation while you privately see notes, previews, timing, and controls.

When presenting, use:

| Key or control | Action |
| --- | --- |
| Arrow keys / Space | Previous or next slide |
| Home / End | First or last slide |
| B | Toggle audience blackout |
| L | Use the blue laser |
| D | Use the pen |
| Escape | Return to mouse mode |
| Clear page annotations | Remove ink from the current slide only |
| Save HTML | Export a copy containing the edited notes |

<!-- Reserved for a Presenter Mode snapshot. -->

<!-- Reserved for a laser/pen demonstration video. -->

## How It Works

The original deck remains the audience window and the only owner of slide
state. A four-part adapter connects that controller to the embedded runtime:

| Resource | Purpose |
| --- | --- |
| `SKILL.md` | Agent workflow and delivery rules |
| `references/integration.md` | Adapter contract, notes format, and acceptance checks |
| `assets/presenter.js` | Presenter window, synchronization, notes, laser, and pen runtime |
| `scripts/embed.py` | Safely embeds or updates the runtime in a deck |

Presenter previews are static snapshots. Live animations, video, and other
interactive media continue to run in the audience window. Notes remain hidden
from the visible presentation and print output, but they are present in the
HTML source.

## Requirements

- A Frontend Slides presentation, or an agent capable of creating one
- A modern browser that allows same-origin popup communication
- Python 3 to run the embedding script
- An extended display for the intended two-screen presentation workflow

Automatic display selection and fullscreen depend on browser support and user
permission. Manually moving the audience window to the external display is the
reliable fallback.

## Citation

If this project helps your research work, please cite it using this
[BibTeX entry](#citation):

```bibtex
@misc{shao2026frontendslidespresenter,
	author       = {Fangning Shao and Zifei Shan},
	title        = {Frontend Slides Presenter},
	year         = {2026},
	howpublished = {GitHub repository},
	url          = {https://github.com/fangningshao/frontend-slides-presenter}
}
```

## Credits

Created by [@fangningshao](https://github.com/fangningshao) and [@zifeishan](https://github.com/zifeishan).

Built as an extension to
[Frontend Slides](https://github.com/zarazhangrui/frontend-slides) by Zara
Zhang.


## License

MIT — use it, modify it, and share it. See `LICENSE` for details.
