import { createRequire } from "node:module";

// The production build bundles the TypeScript application and all local
// utilities into dist/server.cjs. This thin Vercel entry only loads that
// verified bundle, avoiding untranspiled local TypeScript imports at runtime.
const require = createRequire(import.meta.url);
const server = require("../dist/server.cjs");

export default server.default ?? server;
