# Slate/GitHub interaction

This page aims to document how the Slate web app uses the GitHub API.

All of these different cases should be tested after making changes to the workflow in Slate.

## User not logged in

If the user isn't logged in, we obviously don't use the GitHub API at all.

Note that logging in always results in a page refresh since we first redirect to GitHub and GitHub then redirects back. Although it is possible to avoid this using a trick, we would need to reload the entire library anyway in many cases. So the standard solution is actually the most convenient: From the point of view of the web app, the logged in user never changes as long as the app is running.

### Debug build

In a debug build, content is served from the local clone of the repository under `data/libraries`, via the local web server. Submissions are sent to the server, which just overwrites the local file.

### Release build

In a release build, we cannot assume that the server has a copy of the library under `data/libraries`. Therefore, the frontend fetches the library directly from https://raw.githubusercontent.com/ (except that the server may cache this content and server is as `.preload` files).

Submissions, however, are sent to the server via the same API as in the debug build. The server then forwards them by email.

## User logged in

In the logged-in case, the debug and release builds behave the same.

At startup, the app queries the user's info and repository status before fetching anything from the library, as the location to fetch from depends on several variables.

### User does not have a fork of the library

If the user does not have a personal fork of the library, content is served from the main library repository, via https://raw.githubusercontent.com/ (possibly cached by the server as `.preload` files). Unless the user has write access to the main repository, the repository is forked when the user makes the first submission.

### User has a fork of the library

If the user has a fork of the library, the app first tries to fast-forward it to match the upstream repository (unless an open pull request exists, as it is guaranteed to fail then). If fast-forwarding is not possible, the user is warned about viewing a possibly outdated of the library with local changes.

Content is usually served from the user's own fork (via https://raw.githubusercontent.com/), except in case the repository was just fast-forwarded: Since https://raw.githubusercontent.com/ is not updated immediately, we need to fetch from the main repository to avoid seeing outdated data.

Submissions are committed into the user's fork. If the attempt to fast-forward the repository had been unsuccessful, no further action is taken, and the user is warned about this. Otherwise, the app always tries to create a pull request, even if one existed at startup, since the existing pull request might have been merged in the meantime. (Note that if a pull request existed at startup, the repository was _not_ fast-forwarded, but this does not count as an unsuccessful attempt.)
