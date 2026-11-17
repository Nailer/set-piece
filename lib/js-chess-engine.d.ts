declare module "js-chess-engine" {
  const engine: { aiMove: (fen: string, level: number) => Record<string, string> };
  export default engine;
}
