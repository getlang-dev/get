# GetLang Tokenizer Prompt

Review `packages/parser/src/grammar/lexer.ts` and `packages/parser/src/grammar/getlang.ne`, and use the root `test` directory if you need a more top-down view of the language behavior.

Then:

1. Produce a Monaco Monarch tokens provider for the language and write it into `assets/tokenizers`.
2. Produce a TextMate grammar for the language and write it into `assets/tokenizers`.
3. Scaffold a minimal installable VS Code extension that bundles the TextMate grammar under `assets/tokenizers/vscode-getlang`.
4. Under `assets/tokenizers/examples`, write one `.getlang` file per edge case that might expose limitations in either tokenizer.

Constraints:

- Prefer mirroring the real lexer/parser structure instead of guessing from surface syntax.
- Call out any known approximation where Monarch or TextMate cannot exactly model the moo lexer states.
- Do not silently “improve” the language; follow the existing lexer/parser behavior.
- Keep the tokenizer outputs self-contained and ready to inspect locally.
- Do not make unrelated repo changes.

Deliverables:

- `assets/tokenizers/getlang.monarch.ts`
- `assets/tokenizers/getlang.tmLanguage.json`
- `assets/tokenizers/vscode-getlang/*`
- `assets/tokenizers/examples/*.getlang`

Before finishing, verify the generated grammar files are syntactically valid and summarize any known tokenizer mismatches you noticed while comparing them to the real lexer.
