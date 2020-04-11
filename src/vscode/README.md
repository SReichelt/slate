# Slate

This extension integrates the [Slate interactive theorem prover](https://sreichelt.github.io/slate) into Microsoft Visual Studio Code.

## Features

* Full integration of the web-based graphical editor, with bidirectional synchronization between source code and graphical editor.
* Syntax highlighting.
* Display of syntax and type errors.
* Inline preview of rendered mathematical content.
* "Go To Definition" for objects, argument names, and variables.
* Signature help for parameter lists.
* Context-sensitive auto-completion (triggered automatically and via Ctrl+Space).
* Document and workspace symbols.
* "Find All References".
* "Rename Symbol".
* Updating references when renaming and moving files.
* "Format Document".

## Usage

At the moment, some features look for certain files in predefined locations inside the workspace. Therefore, please clone the Slate repository recursively, i.e.
```
   git clone --recursive https://github.com/SReichelt/slate.git
```

Then open the workspace `Slate.code-workspace` in Visual Studio Code, and start editing `.slate` files in the `data/libraries/hlm` subdirectory.

If the "Loading..." message in the Slate view does not disappear, try closing the view and reopening it via the editor toolbar, possibly several times. This is an open [Visual Studio Code bug](https://github.com/microsoft/vscode/issues/89038).

To let Slate adapt references when moving files or directories, consider increasing the `files.participants.timeout` setting in Visual Studio Code.

## Download

The most up-to-date version of the Slate VSCode extension can always be downloaded from https://slate-prover.herokuapp.com/public/download/slate.vsix. This version is guaranteed to match the online version of the theorem prover.
