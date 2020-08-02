# Slate

This extension integrates the [Slate interactive theorem prover](http://www.slate-prover.org/) into Microsoft Visual Studio Code.

![Screenshot](https://raw.githubusercontent.com/SReichelt/slate/master/src/vscode/media/screenshot.png)

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

Please follow these steps:

1. Please clone the [slate](https://github.com/SReichelt/slate) repository recursively, i.e.
   ```
   git clone --recursive https://github.com/SReichelt/slate.git
   ```
2. If you have a personal fork of the [slate-hlm](https://github.com/SReichelt/slate-hlm) repository (e.g. created automatically by the web GUI), add it as a remote to the submodule `data/libraries/hlm`.
3. Open the workspace `Slate.code-workspace` in Visual Studio Code.
4. Alternatively,
   * either open a `.slate` file under `data/libraries/hlm`,
   * or press Ctrl+Shift+P to execute a command, and enter "Slate: Show GUI".

To let Slate adapt references when moving files or directories, consider increasing the `files.participants.timeout` setting in Visual Studio Code.

## Download

Continuously updated builds of the Slate VSCode extension (matching the online version of the theorem prover) are available at http://slate-prover.org/public/download/slate.vsix.
