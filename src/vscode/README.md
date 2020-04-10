# Slate

This extension integrates the [Slate interactive theorem prover](https://sreichelt.github.io/slate) into Microsoft Visual Studio Code.

## Features

* Full integration of the web-based graphical editor, with bidirectional synchronization between source code and graphical editor.
(Note: A [Visual Studio Code bug](https://github.com/microsoft/vscode/issues/89038) currently sometimes prevents the editor from being loaded. You may need to close the editor and reopen it via the toolbar a few times.)
* Syntax highlighting.
* Display of syntax and type errors.
* Inline preview of rendered mathematical content.
* "Go To Definition" for objects, argument names, and variables.
* Signature help for parameter lists.
* Context-sensitive auto-completion (triggered automatically and via Ctrl+Space).
* Document and workspace symbols.
* "Find All References".
* "Rename Symbol".
* Updating references when renaming and moving files. (Note: You probably need to increase the `files.participants.timeout` setting in Visual Studio Code for this to work.)
* "Format Document".