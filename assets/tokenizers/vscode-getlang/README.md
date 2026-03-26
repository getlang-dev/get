# GetLang VS Code Extension

This is a minimal VS Code extension that contributes the bundled GetLang TextMate grammar from this repo.

## Files

- `package.json`: extension manifest
- `language-configuration.json`: comments and bracket behavior
- `syntaxes/getlang.tmLanguage.json`: bundled TextMate grammar

## Install Locally

1. Change into this directory:

   ```bash
   cd /code/assets/tokenizers/vscode-getlang
   ```

2. Package the extension:

   ```bash
   npx @vscode/vsce package
   ```

3. In VS Code, run `Extensions: Install from VSIX...` and select the generated `.vsix`.

## Test In An Extension Host

From this directory run:

```bash
code --extensionDevelopmentPath="$(pwd)"
```

Then open any `.getlang` file, for example one of the examples in `/code/assets/tokenizers/examples`.

## Updating The Grammar

The extension bundles a copy of:

- `/code/assets/tokenizers/getlang.tmLanguage.json`

If you update the source grammar, copy those changes into:

- `/code/assets/tokenizers/vscode-getlang/syntaxes/getlang.tmLanguage.json`
