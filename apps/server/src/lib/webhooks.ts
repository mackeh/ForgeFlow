import { createHmac } from "crypto";
import { getWebhook, listWebhooks, updateWebhook, type StoredWebhook, type WebhookEventType } from "./webhookStore.js";

type WebhookPayload = Record<string, unknown>;

function signBody(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export async function dispatchWebhookEvent(event: WebhookEventType, payload: WebhookPayload) {
  const webhooks = await listWebhooks();
  const targets = webhooks.filter((webhook) => webhook.enabled && webhook.events.includes(event));
  if (!targets.length) {
    return { attempted: 0, delivered: 0 };
  }

  const envelope = {
    event,
    timestamp: new Date().toISOString(),
    payload
  };

  let delivered = 0;
  await Promise.all(
    targets.map(async (webhook) => {
      if (await deliverWebhook(webhook, envelope)) {
        delivered += 1;
      }
    })
  );

  return { attempted: targets.length, delivered };
}

export async function dispatchWebhookTest(webhookId: string, payload: WebhookPayload) {
  const webhook = await getWebhook(webhookId);
  if (!webhook) {
    throw new Error("Webhook not found");
  }
  const envelope = {
    event: "run.started" as const,
    timestamp: new Date().toISOString(),
    payload: {
      ...payload,
      kind: "webhook_test"
    }
  };
  const delivered = await deliverWebhook(webhook, envelope);
  return { attempted: 1, delivered: delivered ? 1 : 0 };
}

async function deliverWebhook(
  webhook: StoredWebhook,
  envelope: { event: WebhookEventType; timestamp: string; payload: WebhookPayload }
) {
  const body = JSON.stringify(envelope);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-forgeflow-event": envelope.event,
    ...(webhook.headers || {})
  };

  if (webhook.secret) {
    headers["x-forgeflow-signature"] = `sha256=${signBody(webhook.secret, body)}`;
  }

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    await updateWebhook(webhook.id, {
      lastDeliveryAt: new Date().toISOString(),
      lastDeliveryStatus: "DELIVERED",
      lastDeliveryError: ""
    });
    return true;
  } catch (error) {
    await updateWebhook(webhook.id, {
      lastDeliveryAt: new Date().toISOString(),
      lastDeliveryStatus: "FAILED",
      lastDeliveryError: String(error)
    });
    return false;
  }
}
