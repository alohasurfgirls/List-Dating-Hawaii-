// Text imports on the server: the bundler (Bun) inlines the
// file's contents as a string. Used for Koa's, Alex's and
// Leilani's sample-photo base64 payloads (koa-sample-*.b64.txt,
// alex-sample-*.b64.txt, leilani-sample-*.b64.txt), which are
// far too large to embed as string literals in TypeScript
// source.
declare module "*.txt" {
  const text: string;
  export default text;
}
