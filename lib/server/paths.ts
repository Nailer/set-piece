import path from "node:path";

export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), "data");
export const FILES_DIR = path.join(DATA_DIR, "files");
export const SEED_DIR = path.join(process.cwd(), "seed");
