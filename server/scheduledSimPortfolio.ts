/**
 * POST /api/scheduled/daily-sim-portfolio
 *
 * Scheduled handler for the $10K→$1M simulated portfolio daily evaluation.
 * Called by manus-heartbeat every weekday at market close (9 PM UTC / 5 PM ET).
 *
 * What it does:
 * 1. Fetches live prices from Yahoo Finance (stocks) and CoinGecko (crypto)
 * 2. Runs the FAULTLINE signal engine on each position and candidate
 * 3. Makes BUY/SELL/HOLD decisions with full 9-dimension rationale
 * 4. Executes trades at the exact live price fetched at decision time
 * 5. Generates an AI daily journal entry documenting all decisions
 * 6. Stores everything in the database
 */

import type { Request, Response } from "express";
import { runDailyEvaluation, valuateSimPortfolio } from "./simPortfolioEngine";
import { generateDailyJournal } from "./simPortfolioJournal";
import {
  getSimAccounts,
  upsertSimAccount,
  getSimOpenPositions,
  insertSimPosition,
  updateSimPosition,
  insertSimTrade,
  upsertSimJournalEntry,
} from "./db";

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] [SimPortfolio] ${msg}`);
}

export async function handleScheduledSimPortfolio(_req: Request, res: Response): Promise<void> {
  const startedAt = Date.now();
  log("Daily evaluation started");

  try {
    // 1. Run the evaluation engine — fetches live prices at this exact moment
    const { pressure, stockDecisions, cryptoDecisions } = await runDailyEvaluation();

    // 2. Load current accounts and positions
    const accounts = await getSimAccounts();
    const openPositions = await getSimOpenPositions();

    const stocksAccount = accounts.find(a => a.accountType === "stocks");
    const cryptoAccount = accounts.find(a => a.accountType === "crypto");

    if (!stocksAccount || !cryptoAccount) {
      log("Accounts not seeded yet — skipping evaluation");
      res.json({ ok: false, reason: "accounts_not_seeded" });
      return;
    }

    let stocksCash = parseFloat(stocksAccount.cashBalance);
    let cryptoCash = parseFloat(cryptoAccount.cashBalance);

    // 3. Get previous valuation for P&L calculation
    const previousValuation = await valuateSimPortfolio(openPositions, stocksCash, cryptoCash);
    const previousTotal = previousValuation.totalValue;

    const tradesSummary: string[] = [];
    const executedTrades: Array<{
      ticker: string;
      action: string;
      price: number;
      quantity: number;
      rationale: string;
    }> = [];

    // 4. Execute trade decisions
    for (const decision of [...stockDecisions, ...cryptoDecisions]) {
      const isStock = decision.assetType === "stock";
      const account = isStock ? stocksAccount : cryptoAccount;
      const accountId = account.id;

      if (decision.action === "BUY" && decision.quantity > 0) {
        const cash = isStock ? stocksCash : cryptoCash;
        const cost = decision.price * decision.quantity;

        if (cost > cash) {
          log(`Insufficient cash for ${decision.ticker} BUY — need $${cost.toFixed(2)}, have $${cash.toFixed(2)}`);
          continue;
        }

        // Check if already have a position
        const existingPos = openPositions.find(p => p.ticker === decision.ticker && p.status === "open");
        if (existingPos) {
          log(`Already have open position in ${decision.ticker} — skipping BUY`);
          continue;
        }

        // Insert position at LIVE execution price
        // Schema fields: accountId, ticker, name, assetType, quantity, entryPrice, totalCost, status, entrySignal, entryRationale
        await insertSimPosition({
          accountId,
          ticker: decision.ticker,
          name: decision.name,
          assetType: decision.assetType,
          quantity: String(decision.quantity),
          entryPrice: String(decision.price),
          totalCost: String(decision.price * decision.quantity),
          status: "open",
          entrySignal: decision.signal,
          entryRationale: decision.rationale.fullNarrative,
        });

        // Deduct cash
        const newCash = cash - cost;
        await upsertSimAccount({
          accountType: isStock ? "stocks" : "crypto",
          cashBalance: String(newCash),
          startedAt: account.startedAt,
        });
        if (isStock) stocksCash = newCash;
        else cryptoCash = newCash;

        // Log the trade — schema fields: accountId, ticker, assetType, action, quantity, price, totalValue, rationale, pressureScore, regime
        await insertSimTrade({
          accountId,
          ticker: decision.ticker,
          assetType: decision.assetType,
          action: "BUY",
          quantity: String(decision.quantity),
          price: String(decision.price),
          totalValue: String(decision.price * decision.quantity),
          rationale: decision.rationale.actionSummary,
          pressureScore: pressure.overallPressure,
          regime: pressure.regime,
        });

        tradesSummary.push(`BUY ${decision.quantity} ${decision.ticker} @ $${decision.price.toFixed(2)}`);
        executedTrades.push({
          ticker: decision.ticker,
          action: "BUY",
          price: decision.price,
          quantity: decision.quantity,
          rationale: decision.rationale.actionSummary,
        });

        log(`✅ BUY ${decision.quantity} ${decision.ticker} @ $${decision.price.toFixed(2)}`);
      }

      if (decision.action === "SELL") {
        const existingPos = openPositions.find(p => p.ticker === decision.ticker && p.status === "open");
        if (!existingPos) continue;

        const qty = parseFloat(existingPos.quantity);
        const proceeds = decision.price * qty;
        const entryPrice = parseFloat(existingPos.entryPrice);
        const realizedPnl = (decision.price - entryPrice) * qty;

        // Close position — schema fields: status, exitPrice, exitRationale, closedAt
        await updateSimPosition(existingPos.id, {
          status: "closed",
          exitPrice: String(decision.price),
          exitRationale: decision.rationale.fullNarrative,
          closedAt: new Date(),
        });

        // Return cash
        const cash = isStock ? stocksCash : cryptoCash;
        const newCash = cash + proceeds;
        await upsertSimAccount({
          accountType: isStock ? "stocks" : "crypto",
          cashBalance: String(newCash),
          startedAt: account.startedAt,
        });
        if (isStock) stocksCash = newCash;
        else cryptoCash = newCash;

        // Log the trade
        await insertSimTrade({
          accountId,
          ticker: decision.ticker,
          assetType: decision.assetType,
          action: "SELL",
          quantity: String(qty),
          price: String(decision.price),
          totalValue: String(proceeds),
          rationale: decision.rationale.actionSummary,
          pressureScore: pressure.overallPressure,
          regime: pressure.regime,
        });

        tradesSummary.push(`SELL ${qty} ${decision.ticker} @ $${decision.price.toFixed(2)} (P&L: ${realizedPnl >= 0 ? "+" : ""}$${realizedPnl.toFixed(2)})`);
        executedTrades.push({
          ticker: decision.ticker,
          action: "SELL",
          price: decision.price,
          quantity: qty,
          rationale: decision.rationale.actionSummary,
        });

        log(`✅ SELL ${qty} ${decision.ticker} @ $${decision.price.toFixed(2)} — P&L: ${realizedPnl >= 0 ? "+" : ""}$${realizedPnl.toFixed(2)}`);
      }
    }

    // 5. Get updated positions for valuation and journal
    const updatedPositions = await getSimOpenPositions();
    const updatedAccounts = await getSimAccounts();
    const updatedStocksCash = parseFloat(updatedAccounts.find(a => a.accountType === "stocks")?.cashBalance ?? "10000");
    const updatedCryptoCash = parseFloat(updatedAccounts.find(a => a.accountType === "crypto")?.cashBalance ?? "10000");
    const currentValuation = await valuateSimPortfolio(updatedPositions, updatedStocksCash, updatedCryptoCash);

    const dailyPnl = currentValuation.totalValue - previousTotal;
    const dailyPnlPct = previousTotal > 0 ? (dailyPnl / previousTotal) * 100 : 0;

    // 6. Generate AI daily journal entry
    // generateDailyJournal signature: (valuation, previousTotalValue, tradesSummary, pressure?)
    const journal = await generateDailyJournal(
      currentValuation,
      previousTotal,
      tradesSummary.join("; ") || "No trades executed today — all positions held.",
      pressure,
    );

    // 7. Save journal entry — schema fields: date, pressureScore, regime, totalValue, stocksValue, cryptoValue, dailyPnl, dailyPnlPct, journalEntry, holdingsJson, tradesJson, tradesMade
    const today = new Date().toISOString().slice(0, 10);
    const fullJournalText = [
      journal.macroNarrative,
      journal.actionsTaken,
      journal.forwardLooking,
      journal.riskAssessment,
    ].filter(Boolean).join("\n\n");

    await upsertSimJournalEntry({
      date: today,
      pressureScore: pressure.overallPressure,
      regime: pressure.regime,
      totalValue: String(currentValuation.totalValue),
      stocksValue: String(currentValuation.stocksValue),
      cryptoValue: String(currentValuation.cryptoValue),
      dailyPnl: String(dailyPnl),
      dailyPnlPct: String(dailyPnlPct),
      journalEntry: fullJournalText,
      holdingsJson: JSON.stringify(journal.positionCommentary),
      tradesJson: JSON.stringify(executedTrades),
      tradesMade: executedTrades.length,
    });

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    log(`Daily evaluation complete in ${elapsed}s — ${executedTrades.length} trades executed`);

    res.json({
      ok: true,
      tradesExecuted: executedTrades.length,
      trades: tradesSummary,
      totalValue: currentValuation.totalValue,
      dailyPnl,
      dailyPnlPct,
      journalDate: today,
      elapsed: `${elapsed}s`,
    });

  } catch (err) {
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.error(`[SimPortfolio] Daily evaluation failed after ${elapsed}s:`, (err as Error).message);
    res.status(500).json({ ok: false, error: (err as Error).message, elapsed: `${elapsed}s` });
  }
}
