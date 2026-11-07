# Prompt Engineering Academy — Project Rules

## Language and Purpose

- Communication with the user and user-facing content must be in Russian.
- Technical identifiers, library names, type names, and filenames remain in English.
- The project is a static educational portal for people with basic experience using AI.

## Sources of Truth

When documents conflict, use this priority:

1. The user's latest direct instruction.
2. `docs/DECISIONS.md` — confirmed and deferred decisions.
3. `docs/REQUIREMENTS.md` — mandatory requirements and acceptance criteria.
4. Subject-specific documents in `docs/specs/`.
5. `docs/PRODUCT_SPEC.md` and `docs/TECH_SPEC.md`.
6. `docs/IMPLEMENTATION_PLAN.md` and `docs/TEST_PLAN.md`.

If a conflict is found, do not silently choose an option. Stop the affected work, record the conflict, and ask the user to decide.

## MVP Boundaries

- Stack: Astro + React + TypeScript.
- Publication target: a public repository and GitHub Pages.
- No backend, database, registration, accounts, real AI API, or secret keys.
- Do not add features absent from `docs/REQUIREMENTS.md` or a user-confirmed decision.
- Possible improvements are outside the MVP and must not be implemented without separate approval.

## Open Decisions

Before implementation that depends on an `OPEN` item in `docs/DECISIONS.md`, ask the user to decide it. Publication parameters are approved in `DEC-036`. Publishing the site still requires a separate direct user request under Git and External Actions.

## Approved Visual System

- Decision source: `DEC-019`; detailed contract: `docs/specs/01-experience.md`.
- Direction: mature cybernetics and cybersecurity without hacker clichés; green `#4DF58C` is the primary accent and purple `#8B7CFF` is the structural secondary accent.
- Primary typeface: `IBM Plex Sans`; `IBM Plex Mono` is used only for system labels, counters, and the digital background.
- The background Matrix animation uses only digits `0–9`, remains decorative and non-interactive, and becomes static when `prefers-reduced-motion` is enabled.
- Do not change palette roles, typography, geometry, icon style, or motion contract without a new user decision.
- A full learning-progress reset does not change the selected theme; see `DEC-020`.

## Approved Styling Architecture

- Decision source: `DEC-021`; detailed contract: `docs/specs/01-experience.md`.
- `src/styles/tokens.css` contains semantic custom properties and theme mappings; `src/styles/global.css` contains reset, base typography, focus, and shared MDX-content rules.
- `.astro` components use native scoped `<style>`; React UI components with local styles use colocated `*.module.css`. Logic-only modules must not create empty stylesheets.
- Components use semantic variables; hardcoded palette colors outside `tokens.css` are prohibited.
- The allowlist for additional styling dependencies is empty: Tailwind, Sass/SCSS, CSS-in-JS, and other styling packages are outside the MVP unless a new decision is made.

## Approved Gamification Model

- Decision source: `DEC-023`; full catalogue and state contract: `docs/specs/04-quiz-progress-gamification.md`.
- XP is awarded by milestone model, once per stable award key; approved maximum without reset is `660 XP`.
- Score-dependent XP and achievements are computed only after `finalComplete`; XP does not affect the final rank or reveal quiz results before the allowed phase.
- Rewards are cosmetic emblems at `100`, `300`, and `500 XP`; they do not block articles, the quiz, or features.
- `xpTotal` and unlocked rewards are derived from the catalogue and award keys. A full reset clears gamification state but preserves the theme preference.

## Development

- Make minimal, focused changes.
- Add or update a behavior check before implementation.
- The exercise architecture uses `ExerciseShell`, a shared typed contract, and React composition; specialized editors and evaluators connect through a registry without a custom `BaseExercise` class hierarchy.
- Keep the scoring engine in pure TypeScript functions without React dependencies.
- Inline exercises are autonomous React islands; the final quiz is one React island.
- Do not use Redux, Zustand, backend storage, or an AI API without changing the approved requirements.
- Accessibility is part of behavior: keyboard access, visible focus, and a button alternative to drag-and-drop are required.
- Behavioral changes must update requirements, specifications, and tests.
- DnD (drag-and-drop) uses the approved `@dnd-kit/react` line with directly imported APIs from `@dnd-kit/dom`, isolated behind the local `DragAdapter`; a button-based, keyboard-friendly alternative is required. Full contract: `DEC-022` and `docs/specs/02-exercise-system.md`.

## Verification

- Every acceptance criterion must have a reproducible check.
- Before the full test suite, first check Node.js/npm availability and run a minimal representative test.
- Use Vitest for scoring and unit tests, React component tests, and Playwright for E2E and accessibility checks.
- Check the production build and the published GitHub Pages URL when publication is separately approved.
- Do not claim completion without fresh verification results.

## Git Workflow

- This project does not use Git Flow.
- Work directly on the existing `main` branch. Do not create `develop` or feature branches unless the user changes this decision.
- Under `DEC-036`, `gh-pages` is reserved for manually published build output; it is not a development branch.
- Before changing code or branch state, inspect the current Git state and available branches.

## Git and External Actions

- Do not run `git init`, commit, push, create a repository, publish, or change GitHub Pages without a separate direct user request.
- Do not add secrets, real credentials, or local configuration to the repository.
- Preserve unrelated user changes.
