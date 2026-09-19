---
name: frontend-slides-presenter
description: Add per-slide speaker notes and a dual-window Presenter Mode to frontend-slides HTML presentations, with synchronized laser pointer and pen annotations. Use for creating slides, creating PPTs, presenter view, speaker scripts, rehearsal, or extended-desktop presenting.
---

# Frontend Slides Presenter

Extend [frontend-slides](https://github.com/zarazhangrui/frontend-slides) with a local presenter window and a clean audience window. Keep its current design workflow, single-file output, slide controller, animations, and export behavior.

1. **Create or inspect the deck.** For a new deck or PPTX conversion, use the available frontend-slides skill (or read upstream `SKILL.md` and its relevant references). For an existing deck, preserve its design. Do not copy or pin a fork of upstream into this skill.
2. **Add notes to each slide.** Use `<template data-presenter-notes>HTML-escaped plain text</template>` inside the slide, preferably with a stable slide `id`. Preserve the user's script and PPTX `notes`; migrate legacy speaker-note comments into templates. Draft missing notes from the supplied content when appropriate. Notes support paragraphs and Unicode; they are not executable HTML or Markdown. Do not put scripts on the visible slide.
3. **Connect the controller.** Read [references/integration.md](references/integration.md). Supply `slides`, `getIndex`, `goTo`, and `stage` through the small adapter. Embed the shipped runtime with `python3 scripts/embed.py input.html output.html` using this skill's absolute script path. Do not regenerate the runtime or introduce a second navigation controller.
4. **Verify in a browser.** Open Presenter by click or P. Check navigation in both windows, current/next previews, first/last page, long-note editing and save/reopen, timer, blackout, audience-only fullscreen, blue laser and pen in both windows, and clearing only the current page’s ink. Check the audience at 1280×720 and one phone viewport. Notes/UI must stay out of the audience image and print. Keep pre-existing editing and export usable. See the focused acceptance checklist in the integration reference.
5. **Deliver.** Provide the ready HTML and explain: use **extended desktop**, keep Presenter on the laptop, move the original slides window to the projector, click slides and press F. Presenter supports arrows/Space, Home/End, jump list, B blackout, notes size, timer, and export. V2 adds L blue laser, D pen, Esc/mouse to stop marking, and Clear page annotations. Draw on the current preview or audience slide; coordinates and ink synchronize. Ink stays per slide in the running session, is excluded from HTML/print, and resets when the audience reloads; clearing ink never clears speaker notes. Browser storage keeps drafts; **Save HTML** embeds edited notes into a portable file. When sharing a screen, select only the audience window.

Automatic display selection/fullscreen depends on browser permission and support; manual dragging is the baseline. Previews are static; live animations/media stay in the audience window. Notes are hidden from presentation and print, but remain in the HTML source. Do not claim physical dual-monitor verification unless actually performed.

# Using original frontend-slides skill

If the deck is not yet created, you should first use the `frontend-slides` skill to create one. If you don't have original access to `frontend-slides` skill, use `references/frontend-slides/SKILL.md` for a local version.
