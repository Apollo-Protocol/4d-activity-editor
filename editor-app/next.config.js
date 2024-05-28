/** @type {import('next').NextConfig} */

const isGithubActions = process.env.GITHUB_ACTIONS || false;

let assetPrefix = ''
let basePath = ''
let images = {
  unoptimized: true,
}

if (isGithubActions) {
  const repo = process.env.GITHUB_REPOSITORY.replace(/.*?\//, '');

  assetPrefix = `/${repo}/`;
  basePath = `/${repo}`;
  images = {
    loader: 'imgix',
    path: 'apollo-protocol-editor.imgix.net',
  }
}

const nextConfig = {
  reactStrictMode: true,
  assetPrefix: assetPrefix,
  basePath: basePath,
  images: images,
  output: 'export',
};

module.exports = nextConfig;
