# tsc-node-build

Build **TypeScript Node.js** libraries with ESM support using `tsc`.

## Features

- Building `CommonJS` & `ESM` concurrently, taking advantage of multi-core
- Watching & execute feature with a modified version of [tsc-watch](https://github.com/gilamran/tsc-watch)

## Install

```bash
pnpm add tsc-node-build
```

```bash
yarn add tsc-node-build
```

```bash
npm install tsc-node-build
```

## Usage

In your `package.json` you can specify:

```json
{
  "scripts": {
    "build": "tsc-node-build",
    "dev": "tsc-node-watch --onSuccess \"node dist/cjs/index.js\""
  }
}
```

And it assumes you have configured your `package.json` as it follows:

```json
{
  "exports": {
    "./*": {
      "import": "./dist/esm/*.js",
      "require": "./dist/cjs/*.js"
    }
  },
  "typesVersions": {
    "*": {
      "*": [
        "dist/types/*"
      ]
    }
  },
}
```
