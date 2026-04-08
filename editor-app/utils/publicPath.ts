const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function publicPath(path: string) {
  if (!path.startsWith("/")) {
    return path;
  }

  if (!basePath) {
    return path;
  }

  return `${basePath}${path}`;
}