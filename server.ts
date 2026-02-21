import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const db = new Database("oracle.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS bankroll (
    id INTEGER PRIMARY KEY,
    amount REAL DEFAULT 1000.0,
    initial_amount REAL DEFAULT 1000.0
  );

  CREATE TABLE IF NOT EXISTS bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT,
    market TEXT,
    odds REAL,
    fair_odds REAL,
    edge REAL,
    stake REAL,
    status TEXT DEFAULT 'pending', -- pending, win, loss, void
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS learning_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league TEXT,
    team TEXT,
    variance_adjustment REAL DEFAULT 0,
    notes TEXT
  );
`);

// Ensure bankroll exists
const bankrollCount = db.prepare("SELECT COUNT(*) as count FROM bankroll").get() as { count: number };
if (bankrollCount.count === 0) {
  db.prepare("INSERT INTO bankroll (amount, initial_amount) VALUES (1000, 1000)").run();
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API Routes
  app.get("/api/bankroll", (req, res) => {
    const row = db.prepare("SELECT * FROM bankroll WHERE id = 1").get();
    res.json(row);
  });

  app.post("/api/bankroll/reset", (req, res) => {
    const { amount } = req.body;
    db.prepare("UPDATE bankroll SET amount = ?, initial_amount = ? WHERE id = 1").run(amount, amount);
    res.json({ success: true });
  });

  app.get("/api/odds", async (req, res) => {
    const { sport } = req.query;
    const apiKey = process.env.THE_ODDS_API_KEY || "5e6fade8815816723be4071f38f88719";
    try {
      const response = await fetch(`https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${apiKey}&regions=us,eu&markets=h2h,totals&oddsFormat=decimal`);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch odds" });
    }
  });

  app.get("/api/sports", async (req, res) => {
    const apiKey = process.env.THE_ODDS_API_KEY || "5e6fade8815816723be4071f38f88719";
    try {
      const response = await fetch(`https://api.the-odds-api.com/v4/sports/?apiKey=${apiKey}`);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sports" });
    }
  });

  app.post("/api/bets", (req, res) => {
    const { event, market, odds, fair_odds, edge, stake } = req.body;
    const result = db.prepare(`
      INSERT INTO bets (event, market, odds, fair_odds, edge, stake)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(event, market, odds, fair_odds, edge, stake);
    
    // Deduct stake from bankroll immediately? 
    // Actually, usually we deduct when the bet is placed.
    db.prepare("UPDATE bankroll SET amount = amount - ? WHERE id = 1").run(stake);
    
    res.json({ id: result.lastInsertRowid });
  });

  app.get("/api/bets", (req, res) => {
    const rows = db.prepare("SELECT * FROM bets ORDER BY created_at DESC").all();
    res.json(rows);
  });

  app.post("/api/bets/:id/result", (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // win, loss, void
    
    const bet = db.prepare("SELECT * FROM bets WHERE id = ?").get() as any;
    if (!bet || bet.status !== 'pending') {
      return res.status(400).json({ error: "Invalid bet or already processed" });
    }

    let bankrollChange = 0;
    if (status === 'win') {
      bankrollChange = bet.stake * bet.odds;
    } else if (status === 'void') {
      bankrollChange = bet.stake;
    }
    // loss results in 0 return, stake already deducted

    db.prepare("UPDATE bets SET status = ? WHERE id = ?").run(status, id);
    db.prepare("UPDATE bankroll SET amount = amount + ? WHERE id = 1").run(bankrollChange);

    res.json({ success: true, bankrollChange });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
