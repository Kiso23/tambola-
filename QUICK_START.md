# ⚡ Quick Start Guide - Diwali Tambola

## 🎯 Get Running in 2 Minutes

### Step 1: Install Dependencies
```bash
cd tambola-game
npm install
```

### Step 2: Start the Server
```bash
npm start
```

You'll see:
```
🎉 Tambola Server running on http://localhost:3000
Perfect for Diwali celebrations!
```

### Step 3: Open in Browser
Go to: **http://localhost:3000**

---

## 🎮 Play with Friends

### Creating a Game
1. Enter your name (e.g., "Priya")
2. Click **"Create Game"**
3. Copy the game link (shows up in the game)
4. Send to friends on WhatsApp/Telegram

### Joining a Game
1. Friend opens the link you sent
2. Enters their name (e.g., "Amit")  
3. Game code auto-fills from URL
4. Clicks **"Join Game"**

### Playing
1. Creator clicks **"Start Game"** (after everyone joins)
2. Creator clicks **"Draw Number"** repeatedly
3. Your ticket auto-marks as numbers are drawn
4. When you get a full line/two lines/house → Click the win button!

---

## ✨ Game Features

✅ **Auto-Marking** - Numbers mark automatically  
✅ **Live Player List** - See who's playing  
✅ **Anti-Cheating** - Server verifies all wins  
✅ **Three Win Types** - Line, 2-Lines, Full House  
✅ **Proof Verification** - Check game integrity anytime  
✅ **Mobile Friendly** - Play on phone/tablet  

---

## 🔒 Security & Fairness

- **Server-Verified**: All marks checked server-side
- **Tamper-Proof**: Tickets can't be modified
- **Cryptographic Proofs**: Math proves fairness
- **No Cheating**: Players can verify game proof

Click **"📜 Verify Game Proof"** to see all details.

---

## 📱 Playing on Network

If friends are on different devices/WiFi:

1. Find your computer's local IP:
   ```bash
   # On Mac/Linux
   ifconfig | grep "inet "
   
   # On Windows
   ipconfig
   ```
   Look for: `192.168.x.x` or similar

2. Share link: `http://YOUR_IP:3000?game=abc123`

3. Friends open that link in their browser

---

## 🐛 Troubleshooting

### "Port 3000 already in use"
```bash
# Use different port
PORT=8080 npm start
```

### "Cannot find module"
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### "WebSocket connection failed"
- Check firewall allows port 3000
- Try localhost first: http://localhost:3000
- Restart the server

### "Game not found"
- Make sure creator started the game
- Check game code is correct
- Refresh the page

---

## 🎊 Pro Tips

1. **Start Fresh**: Refresh browser before starting new game
2. **Draw Steadily**: Give players time to mark numbers
3. **One Winner Per Round**: Only claim when you genuinely have numbers
4. **Verify After**: Check game proof for proof of fairness
5. **Host Your Own**: Run server on your laptop for gatherings

---

## 💾 Important Notes

- **Game Data**: Stored in memory (clears on server restart)
- **Game Link**: Anyone with link can join - keep it in group
- **Duration**: Games persist until server restarts
- **Players**: No limit to how many can join!

---

## 🎉 Ready to Play?

Run `npm start` and enjoy Diwali Tambola with friends! 🎆

**Questions?** Check README.md for detailed documentation.

---

**Happy Diwali!** 🪔✨🎊
