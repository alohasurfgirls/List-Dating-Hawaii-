declare module "*.css";
declare module "*.webp";
declare module "*.png";
declare module "*.jpg";
// Text imports: the bundler inlines the file's contents as a
// string. Used for the hatch-maps runtime (hatch-maps.txt), which
// the map component injects as a classic script at runtime — the
// CVM client build allows exactly one JS bundle, so the runtime
// cannot ship as a second .js file.
declare module "*.txt" {
  const text: string;
  export default text;
}
