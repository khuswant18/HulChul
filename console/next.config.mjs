import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
export default {
  // Dependencies live in the repo root's node_modules.
  turbopack: { root: path.join(here, "..") },
  devIndicators: false,
  agentRules: false,
};
