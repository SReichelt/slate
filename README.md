# The Slate interactive theorem prover

Slate is an interactive theorem prover that is currently under development.

## Web access

Slate is designed as a web application.
Please visit http://sreichelt.github.io/slate/.

## Running Slate locally

Installing and executing Slate on a local machine is convenient or necessary in a few cases:

1. Developing the prover itself.
2. Making large additions to the library.
3. Refactoring parts of the library.
4. Building a separate library.
5. Creating new notation templates.
6. (Currently also for almost everything else, but this will change.)

Local installation has been tested on Linux and Microsoft Windows.

### Installing and executing the web app

Please follow these steps:

1. Install the following software:
   * [Git](https://git-scm.com/downloads)
   * Microsoft [Visual Studio Code](https://code.visualstudio.com/Download)
   * [Node.js](https://nodejs.org/)
   * Google [Chrome](https://www.google.com/chrome/) or [Chromium](https://www.chromium.org/Home)
   * [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools/), in case you would like to debug Slate
2. Create a script `chrome-remote-debug` as follows:
   * On Linux, create a text file `chrome-remote-debug` with the contents
     ```
     #! /bin/sh
     set -e
     /usr/bin/google-chrome --remote-debugging-port=9222 "$@"
     ```
     and make it executable via `chmod +x`.
   * On Windows, create a text file `chrome-remote-debug.cmd` with the contents
     ```
     "<path>\chrome.exe" --remote-debugging-port=9222 %*
     ```
     replacing `<path>` with the correct path.
3. Make sure the programs `git`, `code`, `npm`, and `chrome-remote-debug` can be started from the command line, i.e. are accessible via the `PATH` environment variable.
4. In a terminal, in a directory of your choice, run
   ```
   git clone https://github.com/SReichelt/slate.git
   cd slate
   npm install
   npm run-script get-lib
   ```
5. Start Visual Studio Code, and open the workspace `Slate.code-workspace`.
6. Now you should be able to execute the app via "Debug/Start" (F5). If successful, a browser will open.
7. If the app does not start, check the many output/console/terminal windows of Visual Studio Code. On Windows, I had to fix two problems:
   * In the `tsc-watch` package, there were two superfluous commas in a `.js` file. (Probably a matter of different language standards.)
   * In the `open` package, in `open.js`, there is a specialization starting with "`case 'win32':`". This specialization somehow breaks URLs passed to the browser. Commenting it out worked for me, YMMV.
8. If you would like to debug the application, select the launch configuration called "Launch and attach", which attaches the VSCode debugger to Chrome.

### Installing the VSCode extension

Slate comes with a Visual Studio Code extension, which has not been officially released at this early point in time. It adds syntax highlighting, tooltips, code lenses, completion, renaming, etc. to `.slate` files. To install it, follow these steps:

1. Open the separate workspace `Slate-vscode.code-workspace`.
2. Click "Terminal/Run Task..." and type "npm: install" (or run `npm install` in the `src/vscode` directory).
3. Click "Terminal/Run build task", or hit F5 to build and test the extension.
12. Open a terminal in the [VSCode extensions folder](https://vscode-docs.readthedocs.io/en/stable/extensions/install-extension/#your-extensions-folder).
13. Create a symbolic link to the `src/vscode` subdirectory of Slate:
    * On Linux, use
      ```
      ln -s <path>/src/vscode slate
      ```
    * On Windows, use `mklink` with the `/d` option, or `New-Item` in PowerShell.
14. Switch back to the main workspace and open a `.slate` file.
