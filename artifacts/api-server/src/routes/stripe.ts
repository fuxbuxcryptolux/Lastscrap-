import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { uniformPurchasesTable } from "@workspace/db";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const UNIFORM_PRICE_ID = "price_1Tgz2vBhdNeCqImiWSpbyhiM";

const VALID_UNIFORM_IDS = new Set([
  "spacemarine",
  "armybasic",
  "apocalypse",
  "street",
]);

router.post("/stripe/checkout", async (req, res) => {
  const { uniformId, deviceId, successUrl, cancelUrl } = req.body as {
    uniformId?: string;
    deviceId?: string;
    successUrl?: string;
    cancelUrl?: string;
  };

  if (!uniformId || !VALID_UNIFORM_IDS.has(uniformId)) {
    res.status(400).json({ error: "Invalid uniform_id" });
    return;
  }
  if (!deviceId || typeof deviceId !== "string" || deviceId.length < 4) {
    res.status(400).json({ error: "Invalid device_id" });
    return;
  }

  const baseUrl = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (!baseUrl) {
    res.status(500).json({ error: "Missing REPLIT_DOMAINS env" });
    return;
  }

  try {
    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: UNIFORM_PRICE_ID, quantity: 1 }],
      mode: "payment",
      success_url: successUrl ?? `https://${baseUrl}`,
      cancel_url: cancelUrl ?? `https://${baseUrl}`,
      metadata: {
        type: "uniform",
        uniform_id: uniformId,
        device_id: deviceId,
      },
    });

    await db.insert(uniformPurchasesTable).values({
      id: randomUUID(),
      deviceId,
      uniformId,
      stripeSessionId: session.id,
      fulfilled: false,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    req.log.error({ err }, "Failed to create checkout session");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

router.get("/stripe/entitlements", async (req, res) => {
  const deviceId = req.query["deviceId"] as string | undefined;
  if (!deviceId) {
    res.status(400).json({ error: "Missing deviceId" });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(uniformPurchasesTable)
      .then((all) =>
        all.filter((r) => r.deviceId === deviceId && r.fulfilled),
      );

    const uniforms = rows.map((r) => r.uniformId);
    res.json({ uniforms });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch entitlements");
    res.status(500).json({ error: "Failed to fetch entitlements" });
  }
});

router.post("/stripe/webhook-custom", async (req, res) => {
  const event = req.body as {
    type?: string;
    data?: { object?: Record<string, unknown> };
  };

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object as {
      id?: string;
      payment_status?: string;
      metadata?: { type?: string; uniform_id?: string; device_id?: string };
    } | undefined;

    if (
      session?.payment_status === "paid" &&
      session?.metadata?.type === "uniform" &&
      session.metadata.uniform_id &&
      session.metadata.device_id &&
      session.id
    ) {
      try {
        await db
          .update(uniformPurchasesTable)
          .set({ fulfilled: true })
          .where(sql`stripe_session_id = ${session.id}`);

        logger.info(
          { uniformId: session.metadata.uniform_id, deviceId: session.metadata.device_id },
          "Uniform purchase fulfilled",
        );
      } catch (err) {
        logger.error({ err }, "Failed to fulfill uniform purchase");
      }
    }
  }

  res.json({ received: true });
});

export default router;
