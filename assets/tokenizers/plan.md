# Tokenizer Plan

This document tracks the tokenizer work for GetLang going forward.

## Goals

- Keep editor tokenization aligned with the real language as defined by:
  - `packages/parser/src/grammar/lexer.ts`
  - `packages/parser/src/grammar/getlang.ne`
  - behavior demonstrated in the root `test` directory
- Make approximation boundaries explicit where Monarch or TextMate cannot exactly model the lexer/parser.
- Maintain an installable VS Code extension bundle for fast manual review.
- Build a repeatable verification loop so future LLMs can measure tokenizer behavior against the real lexer/parser instead of relying on visual guesswork.

## Current Outputs

- `assets/tokenizers/getlang.monarch.ts`
- `assets/tokenizers/getlang.tmLanguage.json`
- `assets/tokenizers/vscode-getlang/*`
- `assets/tokenizers/examples/*.get`

## Known Gaps To Revisit

- Slice literals are currently over-highlighted as if interpolation were active inside them.
- Recursive interpolation is only approximated in the editor grammars.
- Request-mode tokenization is line-oriented in the editor grammars and may not perfectly match the moo request states.
- Selector-heavy template regions after `->` are highlighted lexically, not parsed as CSS/XPath/other selector syntaxes.
- Optional markers (`?`) and fallback/ternary operators can be hard to distinguish structurally in editor grammars.

## Workstreams

### 1. Tighten lexical fidelity

- Review each tokenizer rule against the corresponding moo state.
- Remove known false positives first, especially anything that highlights syntax the real lexer does not support.
- Prefer matching token boundaries from the lexer over adding more visually appealing but inaccurate scopes.

### 2. Expand example coverage

- Keep `assets/tokenizers/examples` as the corpus of high-value tokenizer stress cases.
- Add one file per edge case, with a short comment header that explains what to inspect.
- Add examples whenever a bug is found, before or alongside the fix.

### 3. Build machine-verifiable checks

- Add scripts that tokenize example inputs using:
  - the real moo lexer
  - the Monarch grammar
  - the TextMate grammar
- Normalize the output into a comparable form so differences are visible and reviewable.

### 4. Improve VS Code packaging

- Keep `assets/tokenizers/vscode-getlang` installable with minimal setup.
- When tokenizer behavior changes, refresh the bundled grammar copy and re-test against the example corpus.

## Verification Loop

Future LLMs should follow this loop whenever they change tokenizer behavior.

### Step 1. Choose fixtures

- Use all files in `assets/tokenizers/examples`.
- Add any new fixture that reproduces the bug being fixed.
- Reuse real syntax from the root `test` directory when creating new fixtures.

### Step 2. Capture ground truth from the real lexer/parser

- Run the real moo lexer over each fixture and record:
  - token type
  - token text
  - line/column offsets when useful
  - lexer state transitions if practical
- For parser-valid fixtures, also record whether the parser accepts the file.
- Treat the lexer as the source of truth for lexical boundaries.

### Step 3. Capture tokenizer output

- Tokenize the same fixture with the Monarch provider.
- Tokenize the same fixture with the TextMate grammar.
- Convert both outputs into a normalized stream, for example:
  - line number
  - start/end columns
  - scope or token class
  - matched text

### Step 4. Compare normalized output to ground truth

- Flag places where a tokenizer:
  - highlights syntax the lexer does not recognize
  - misses syntax the lexer does recognize
  - merges or splits important token boundaries incorrectly
  - enters a wrong lexical region, such as treating slice content like interpolated template content
- Separate expected approximation differences from regressions.

### Step 5. Review visually in an editor

- Open the fixture set in the VS Code extension host.
- Inspect at least the changed fixture and any neighboring edge cases.
- Confirm the visual result matches the normalized diff and does not introduce obvious regressions.

### Step 6. Update docs and examples

- If the tokenizer is intentionally approximate, document that limitation in:
  - this file
  - comments near the tokenizer rule if needed
- If a bug was found, add or refine an example fixture so the issue stays reproducible.

## Suggested Verification Artifacts

These do not all exist yet, but future work should converge on them.

- `assets/tokenizers/examples/*.getlang`
- `assets/tokenizers/plan.md`
- `assets/tokenizers/verify/`
- `assets/tokenizers/verify/fixtures.ts`
- `assets/tokenizers/verify/lexer-truth.ts`
- `assets/tokenizers/verify/monarch-runner.ts`
- `assets/tokenizers/verify/textmate-runner.ts`
- `assets/tokenizers/verify/diff.ts`

## Suggested Implementation Order

1. Add a small verification harness for the existing example corpus.
2. Fix known false positives, starting with slice interpolation.
3. Add regression fixtures for every tokenizer bug found.
4. Improve request-state and interpolation handling where the grammars can support it safely.
5. Repackage and manually verify the VS Code extension after each meaningful tokenizer change.

## Operating Rule For Future LLMs

Do not trust a tokenizer change just because it “looks better” in one file. Run the verification loop, compare against the real lexer/parser, and update the example corpus so the change remains testable.
