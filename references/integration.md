# Integration contract (v1 adapter, v2 runtime)

## Wire an existing controller

Keep the upstream controller and retain its instance. For the current upstream template, replace only `new SlidePresentation();` with:

```js
const presentation = new SlidePresentation();
window.frontendSlidesPresenterAdapter = {
  slides: () => Array.from(presentation.slides),
  getIndex: () => presentation.currentSlide,
  goTo: index => presentation.showSlide(index),
  stage: presentation.stage
};
```

Then run `python3 /absolute/path/to/this-skill/scripts/embed.py deck.html deck-presenter.html`.
The script inserts an inline runtime before the real closing `body`, updates its own marked block on rerun, and leaves other source intact. No npm/build/server is needed to use the resulting HTML. Relative assets retain their original paths; keep the output beside the source or copy those assets too.

Other controllers need only equivalent callbacks. Indices are zero-based. `getIndex()` reports the committed slide; `goTo()` must update the deck's own state, classes, progress, URL and any other native navigation state. Do not emulate it by independently toggling classes. `slides` returns ordered slide elements. `stage` is the fixed canvas element or a selector. Optional `width`/`height` override measured stage dimensions; default fallback is 1920×1080. Optional `id` supplies stable storage identity; otherwise pathname + document title is used. Prefer a unique ID per deck edition if reusing a URL for unrelated talks.

Initialize after the controller and slide DOM. The runtime marks slide/stage elements for snapshots without changing layout or native input handlers. Slide order/count is fixed for one mounted session; reload after structural edits. Upstream can change class names or APIs: update this adapter and retest, without copying its controller or design system. No universal compatibility claim is made for future breaking changes.

For localized presenter interfaces, the adapter may provide `renderPresenter(child, state)`. The runtime calls it synchronously after its own presenter refresh and status messages, so localized labels are applied before the browser paints. `child` is the presenter window; `state` is its current session state, or `null` on disconnection. Keep this hook synchronous and update existing UI elements without replacing their handlers. Do not run a separate timer to translate labels: competing timers cause the default and translated text to flash. The single-file demo includes nine interface dictionaries and independent notes-language selection. Close an already-open presenter and reopen it after updating the runtime so the popup loads the new client code.

## Notes

```html
<section class="slide" id="opening">
  <h1>Build for the room.</h1>
  <template data-presenter-notes>停顿两秒，先与听众建立眼神交流。

用客户的故事开场。强调：A &amp; B 都很重要。</template>
</section>
```

HTML-escape notes (`&`, `<`, `>`) including strings such as `</template>`. Templates are inert even before JS runs. Do not leave a duplicate visible notes element or old note comment. Upstream `scripts/extract-pptx.py` returns `notes` per slide; carry each into the matching template instead of comments. A missing template means empty notes and remains editable.

Edits save as plain text in localStorage, scoped to deck identity and stable slide IDs. If the authored note changes, its older local override is ignored. Without stable slide IDs, index-based fallback cannot safely track reordering. On storage failure, edits remain in memory and the UI asks the user to save HTML/export notes. Exported HTML includes current notes and removes runtime chrome; JSON export is a portable `{version, deckId, slides:[{id,title,notes}]}` record for editing/agent re-import. Browser Save Page/upstream editor exports should also be checked if offered to users. Speaker notes are presentation-private, not source-secret.

## Windows, previews and recovery

The original deck is the audience and sole state owner. P/click opens an `about:blank` popup with its own JS realm. It talks only to its same-origin opener's public session API; no server, BroadcastChannel or storage-event delivery is required. This works for file and HTTP pages. Independent tabs get separate presenter windows. Reloading the audience restores its slide/timer from sessionStorage and the existing presenter reconnects. Closing Presenter leaves the audience running; P reopens it. Closing/navigating away from the audience disables presenter controls and labels the disconnection.

Current/next frames contain sanitized static DOM snapshots with scripts/notes/UI removed, preserve document CSS/base URL, and scale the same stage to fit. Their sandbox disables scripts, navigation and forms. Animations are resolved for `.reveal`; custom animation systems can need snapshot styling. Video/iframes/tainted canvases cannot be represented as live previews; use posters/static fallbacks. Audience playback is untouched. A browser/CSP that blocks inline script or opener access needs a permitted local file/server workflow; do not weaken the site's policy automatically.

The host reserves P, B, F only outside editable controls/modifier shortcuts. Presenter navigation also ignores text inputs, selects and composition. Native audience navigation remains the deck's responsibility. Browser fullscreen requires user activation; remote requests may fail. In that case, click the audience window and press F. Escape follows browser fullscreen behavior. Automatic display selection uses feature-detected `getScreenDetails()` and `requestFullscreen({screen})`; denied/unsupported access explains manual dragging. The runtime never changes system mirroring settings.

## Acceptance

Use the actual generated file, not just an isolated demo:

- Launch by P/click; a blocked popup gives a retry message, not a blanked deck.
- Presenter → audience and native audience → Presenter navigation agree; repeat keys, Home/End, jump, first/last slide work with exactly one audience slide visible.
- Notes match each slide; long/empty/Unicode notes edit without triggering shortcuts; edits persist after popup close and audience reload; Save HTML contains edited notes when reopened under a fresh storage context.
- Current/next match slide styles at 16:9; next shows an end card at the last slide. Resize 1440×900, 1280×720 and a narrow viewport; notes scroll independently.
- Timer start/pause/reset, B/resume, popup reopen, audience reload, audience disconnect, and two simultaneous decks behave correctly.
- Audience pixels and print contain neither notes nor presenter controls; black overlay is not printed. Original controller, edit mode, animations and export still work.
- Verify denial/unsupported display APIs and fullscreen recovery. Separately record real OS extended-desktop, external-screen fullscreen and refocus results if hardware is available.

## V2 laser and pen

No adapter changes are required. The presenter toolbar has Mouse, Blue laser (L), Pen (D), and Clear page annotations. In laser or pen mode, operate on the current-slide preview or the original audience slide. Pointer positions and vector strokes use normalized stage coordinates, so they line up across window sizes and letterboxing. Mouse/Pen/Laser are mutually exclusive; Escape returns to Mouse (the browser may also exit fullscreen). Editing notes suppresses these shortcuts.

The audience owns annotation state; popup subscribers receive updates directly, without waiting for thumbnail polling. Pen input captures the pointer and suppresses native touch/wheel navigation on the drawing surface. Slide changes end active strokes and hide the laser. Blackout hides all marks. Each slide retains its own strokes until cleared or the audience reloads. Closing/reopening Presenter preserves that audience session’s ink. Clear page annotations removes only that page’s strokes, not other pages or notes. Ink and laser are temporary presentation aids: neither is included in HTML export or print.

For regression testing, draw in both windows; resize and verify normalized endpoints; return to a previously marked slide; clear another page; toggle blackout; type L/D in notes; reopen Presenter; and reload the audience. Test real pointer input as well as resulting state—matching method output alone does not verify visible ink or input capture.
