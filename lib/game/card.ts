/** A 1200×630 share image: the final position on the board, with the set's name and the result. */
export async function resultCard(shot: string, setName: string, result: string, plies: number): Promise<string> {
  const c = document.createElement("canvas");
  c.width = 1200;
  c.height = 630;
  const g = c.getContext("2d")!;
  const img = new Image();
  img.src = shot;
  await img.decode();
  g.fillStyle = "#1a1512";
  g.fillRect(0, 0, 1200, 630);
  const w = 760;
  const scale = Math.max(w / img.width, 630 / img.height);
  const sw = w / scale;
  const sh = 630 / scale;
  g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, 630);
  const grad = g.createLinearGradient(700, 0, 820, 0);
  grad.addColorStop(0, "rgba(26,21,18,0)");
  grad.addColorStop(1, "rgba(26,21,18,1)");
  g.fillStyle = grad;
  g.fillRect(700, 0, 120, 630);
  g.fillStyle = "#1a1512";
  g.fillRect(820, 0, 380, 630);

  g.fillStyle = "#c8a46a";
  g.font = "600 22px Georgia, serif";
  g.fillText("SET PIECE", 840, 110);
  g.fillStyle = "#f5ecdf";
  g.font = "italic 54px Georgia, serif";
  let y = 190;
  let line = "";
  for (const word of setName.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > 330 && line) {
      g.fillText(line, 840, y);
      line = word;
      y += 62;
    } else line = test;
  }
  g.fillText(line, 840, y);
  y += 60;
  g.font = "26px Georgia, serif";
  g.fillStyle = "#e6c48a";
  for (const part of result.split(". ")) {
    g.fillText(part.replace(/\.$/, "") + ".", 840, y);
    y += 36;
  }
  g.fillStyle = "rgba(245,236,223,0.7)";
  g.font = "20px Georgia, serif";
  g.fillText(`${Math.ceil(plies / 2)} moves`, 840, y + 10);
  g.fillText("Pieces forged by Aholo Lux3D", 840, 560);
  g.fillText("#Manycorehackathon", 840, 590);
  return c.toDataURL("image/png");
}
