# NPM Publishing Guide

This guide covers the two essential commands for publishing a new version of the package to npm.

## 1. Bump the Version

Use this command to increment the version (patch, minor, or major):

```sh
pnpm version patch
```

- Replace `patch` with `minor` or `major` as needed.
- This will update the version, build the package, commit, tag, and push to GitHub.

## 2. Publish to NPM

After bumping the version, publish the package to npm:

```sh
pnpm publish --access public
```

- This will publish the new version to the npm registry as a public package.
