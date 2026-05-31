import { Router } from "express";
import { db, userCardsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/cards/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const rows = await db.select().from(userCardsTable).where(eq(userCardsTable.userId, userId));

    if (rows.length === 0) {
      const emptyCards = Array.from({ length: 50 }, (_, i) => ({ id: i, front: "", back: "" }));
      return res.json(emptyCards);
    }

    return res.json(rows[0].cards);
  } catch (err) {
    req.log.error({ err }, "Failed to get cards");
    return res.status(500).json({ error: "Failed to get cards" });
  }
});

router.post("/cards/:userId/save", async (req, res) => {
  try {
    const { userId } = req.params;
    const { cards } = req.body;

    const existing = await db.select().from(userCardsTable).where(eq(userCardsTable.userId, userId));

    if (existing.length > 0) {
      await db.update(userCardsTable)
        .set({ cards, updatedAt: new Date() })
        .where(eq(userCardsTable.userId, userId));
    } else {
      await db.insert(userCardsTable).values({ userId, cards });
    }

    return res.json({ status: "success", message: "Saqlandi!" });
  } catch (err) {
    req.log.error({ err }, "Failed to save cards");
    return res.status(500).json({ status: "error", message: "Save failed" });
  }
});

router.post("/cards/:userId/results", async (req, res) => {
  try {
    return res.json({ status: "success", message: "Results saved" });
  } catch (err) {
    req.log.error({ err }, "Failed to save results");
    return res.status(500).json({ status: "error", message: "Save failed" });
  }
});

export default router;
