# 🎊 Diwali Tambola - Fair & Fun Online Bingo Game 🎊

A fair, anti-cheating multiplayer Tambola (Bingo) web game perfect for Diwali celebrations!

## ✨ Features

- **Fair Gaming**: Anti-cheating mechanisms ensure no manipulation is possible
  - Server-verified number marking
  - Cryptographic game proofs
  - Tamper-proof tickets with SHA256 hashing
  - Deterministic number drawing sequence

- **Multiplayer**: Real-time multiplayer with WebSocket
  - Share game link with friends
  - Multiple players can join instantly
  - Live player list with mark counts

- **Three Win Types**:
  - 🎯 First Line (any complete row)
  - 🎯 Two Lines (two complete rows)
  - 🏠 Full House (all numbers marked)

- **Beautiful Diwali Theme**:
  - Colorful gradient backgrounds
  - Animated decorations
  - Festive design

## 🚀 Quick Start

### Prerequisites
- Node.js (v14+)
- npm or yarn

### Installation

1. Clone or extract the project:
```bash
cd tambola-game
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open in browser:
```
http://localhost:3000
```

## 🎮 How to Play

### Creating a Game
1. Open the app
2. Enter your name in "Create Game"
3. Click "Create Game"
4. Share the displayed game link with friends
5. Wait for players to join

### Joining a Game
1. Get the game code from the game link (e.g., `?game=abc123def456`)
2. Enter your name and game code
3. Click "Join Game"

### Playing
1. Once all players have joined, the creator clicks "Start Game"
2. Creator clicks "Draw Number" to draw numbers
3. Your ticket auto-marks when numbers are drawn
4. Claim wins:
   - 🎯 **Claim Line**: When you complete any row
   - 🎯 **Claim 2 Lines**: When you complete two rows
   - 🏠 **Full House**: When all numbers are marked

## 🔒 Anti-Cheating Features

### How Fair Play is Ensured

1. **Server-Verified Marks**
   - All marks are checked server-side
   - Client cannot claim false marks
   - Only drawn numbers can be marked

2. **Tamper-Proof Tickets**
   - Each ticket is hashed with SHA256
   - Ticket cannot be modified after joining
   - Hash verified on every win claim

3. **Cryptographic Proofs**
   - Game hash is immutable
   - Server seed ensures deterministic number sequence
   - All winners have cryptographic proof
   - Can verify game integrity with proof

4. **Fair Number Drawing**
   - Numbers pre-shuffled using server seed
   - No randomness during play
   - Cannot be manipulated by any player
   - Sequence same for all players

### Verify Game Proof
- Click "📜 Verify Game Proof" button
- View complete game state
- See game hash, server seed, all drawn numbers
- Verify no manipulation occurred

## 🎯 Game Rules

- **Minimum Players**: 2
- **Maximum Players**: Unlimited
- **Numbers**: 1-90
- **Ticket Size**: 3×3 grid (9 numbers)
- **Drawn Numbers**: Up to 90

### Win Conditions
- **First Line**: Any complete horizontal row
- **Second Line**: Any two complete horizontal rows
- **Full House**: All 9 numbers marked

## 📱 Mobile Friendly

The app is fully responsive and works on:
- Desktop browsers
- Tablets
- Mobile phones

## 🛠 Technical Stack

- **Frontend**: Pure HTML, CSS, Vanilla JavaScript
- **Backend**: Node.js + Express
- **Real-time**: WebSocket (ws)
- **Hashing**: SHA256 (Node crypto)

## 📁 File Structure

```
tambola-game/
├── index.html          # Complete game frontend
├── server.js           # Node.js backend with WebSocket
├── package.json        # Dependencies
└── README.md          # This file
```

## 🔧 Configuration

Server runs on port 3000 by default. To change:
```bash
PORT=8080 npm start
```

## 🎉 Perfect for Diwali

- **Fun for all ages** ✓
- **Fair and transparent** ✓
- **No setup required** ✓
- **Share with unlimited friends** ✓
- **Festive theme** ✓

## ⚠️ Important Notes

1. **Server Persistence**: Game data is kept in memory. Server restart will clear all games.
2. **For Production**: Use a database to persist games and implement authentication.
3. **Game Link**: Keep game code private - anyone with the code can join!

## 🐛 Troubleshooting

### Port Already in Use
```bash
lsof -i :3000
kill -9 <PID>
```

### WebSocket Connection Failed
- Check firewall settings
- Ensure port 3000 is accessible
- Try localhost first, then network IP

### Players Not Connecting
- Share the full game link including the game code
- Check browser console for errors (F12)
- Ensure all players can access the server IP

## 📝 License

Open source - Use freely for Diwali celebrations and beyond!

## 🙏 Enjoy!

May your Diwali Tambola be fun, fair, and full of celebrations! 🎊✨🪔

---

For updates and support, check the project repository.

**Happy Diwali!** 🎆🪔✨
