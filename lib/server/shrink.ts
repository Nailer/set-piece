/**
 * Lux3D returns 8–20 MB pieces with 2K PNG textures. A chess piece on a board
 * needs far less: 1K WebP textures, at most 24,000 triangles, and meshopt
 * compression bring each one to a few hundred kilobytes.
 */
const MAX_TRIANGLES = 24000;

export async function shrinkGlb(file: string, out = file): Promise<void> {
  const { NodeIO } = await import("@gltf-transform/core");
  const { EXTTextureWebP, EXTMeshoptCompression, KHRMeshQuantization } = await import("@gltf-transform/extensions");
  const { textureCompress, dedup, prune, weld, simplify, meshopt } = await import("@gltf-transform/functions");
  const { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } = await import("meshoptimizer");
  const sharp = (await import("sharp")).default;
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
  const io = new NodeIO()
    .registerExtensions([EXTTextureWebP, EXTMeshoptCompression, KHRMeshQuantization])
    .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
  const doc = await io.read(file);
  await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024], quality: 82 }));
  let tris = 0;
  for (const m of doc.getRoot().listMeshes())
    for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute("POSITION")?.getCount() ?? 0) / 3;
  if (tris > MAX_TRIANGLES) await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: MAX_TRIANGLES / tris, error: 0.01 }));
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  await io.write(out, doc);
}
