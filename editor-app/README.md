# How to Deploy Locally

This guide explains how to host the 4D Activity Editor.

## Getting Started

Install Node https://nodejs.org/en/download/, which includes npm.

Install yarn

```bash
npm install --global yarn
```

From inside this folder location, install the project dependencies

```bash
yarn install
```

Then run the development server:

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the website.

## Running from the file system with no server

Update next.config.js and set this option:

```js
assetPrefix: "./";
```

## Feedback

This tool is currently an early experiment and as such any issues or feedback you have please [get in touch](https://github.com/Apollo-Protocol/4d-activity-editor/discussions). All thoughts are greatly appreciated!
