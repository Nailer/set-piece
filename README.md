# Set Piece

Describe any theme, or show a photo, and Aholo Lux3D forges a whole chess set in 3D. Play it against the computer or a friend, then download it to 3D-print. Lost a piece from a real set? Photograph one that survived and Lux3D makes the missing one to match.

## How a set is forged

Everything visual in a set comes from Aholo Lux3D:

| Step | Lux3D capability | What it does |
| --- | --- | --- |
| Draw the king | Multimodal to image | Turns the theme (or a photo) into a king that sets the style |
| Draw the other five | Multimodal to image, with the king as reference | Same material, palette and base; each piece keeps its own chess silhouette |
| Build all six | Image to 3D (G1-Turbo) | A GLB for every piece, compressed to about 0.5 MB |
| Replace a lost piece | Multimodal to image from your photo, then image to 3D | A matching piece, ready to print |

Pieces land on the board as soon as each one is built, so you can start playing while the set is still forging.

## Features

- Forge a set from a theme or a photo, with live progress per piece
- Play while it forges: classic pieces are replaced by yours as they arrive
- Full chess rules (castling, en passant, promotion with your own pieces, all draws)
- The computer at four levels, each unlocked by beating the one before
- Online games with a friend by link, with server-checked moves; pass-and-play with auto-turn
- 3D board with legal-move hints, capture animations, captured-piece trays and sounds
- Four finishes for the second side; jade and gold are earned
- Take back, resign, move list, result card and a ready-made X post
- Set pages with a 3D turntable of every piece and Lux3D timings
- Print studio: tournament proportions from one king height, per-piece STL or the whole set as a zip with counts and a filament estimate
- How to play guide on every page

## Run it

```bash
npm install
cp .env.example .env.local   # add AHOLO_API_KEY
npm run dev
```

Node 22 or newer. Data is stored in `data/` (or `DATA_DIR`); sets in `seed/` are copied in on first start.

The computer opponent is [js-chess-engine](https://github.com/josefjadrny/js-chess-engine) (MIT); the rules are [chess.js](https://github.com/jhlywa/chess.js) (BSD-2). The home page replays Paul Morphy's Opera Game (Paris, 1858).

Built for the Manycore Aholo Global 3D AI Hackathon.
