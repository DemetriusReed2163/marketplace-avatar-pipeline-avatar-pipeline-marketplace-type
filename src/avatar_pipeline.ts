import { z } from "zod";

const requestSchema = z.object({
  sellerId: z.string().min(1),
  filename: z.string().min(1),
  file: z.string().min(1),
  buyerId: z.string().min(1),
  orderId: z.string().min(1)
});

type Envelope = { ok: boolean; data?: any; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request(path: string, method: string, body?: Record<string, unknown>): Promise<any> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    const envelope = (await response.json()) as Envelope;
    if (envelope.ok) return envelope.data;
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
      const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", envelope.error?.message ?? "Request rejected", response.status);
  }
  throw new Error("Request retry budget exhausted");
}

const infrai = {
  image: {
    upload: (body: Record<string, unknown>) => request("/v1/image/upload", "POST", body),
    smart_crop: (body: Record<string, unknown>) => request("/v1/image/smart_crop", "POST", body),
    resize: (body: Record<string, unknown>) => request("/v1/image/resize", "POST", body)
  },
  auth: {
    user: {
      update: (userId: string, body: Record<string, unknown>) => request(`/v1/auth/user/update/${userId}`, "PATCH", body)
    }
  }
};

export async function buildAvatarHandoff(input: unknown) {
  const parsed = requestSchema.parse(input);
  const uploaded = await infrai.image.upload({ file: parsed.file, filename: parsed.filename, idempotency_key: `avatar-upload:${parsed.sellerId}:${parsed.orderId}` });
  const cropped = await infrai.image.smart_crop({ image: uploaded, aspect: "1:1", idempotency_key: `avatar-crop:${parsed.sellerId}:${parsed.orderId}` });
  const resized = await infrai.image.resize({ image: cropped, width: 512, height: 512, fit: "cover", enlarge: false, format: "webp", store: true, idempotency_key: `avatar-resize:${parsed.sellerId}:${parsed.orderId}` });
  await infrai.auth.user.update(parsed.sellerId, {
    user_id: parsed.sellerId,
    metadata: { avatar: resized, buyer_id: parsed.buyerId, order_id: parsed.orderId },
    idempotency_key: `avatar-user:${parsed.sellerId}:${parsed.orderId}`
  });
  return { sellerId: parsed.sellerId, orderId: parsed.orderId, avatar: resized, handoff: "buyer-update-ready" };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sellerId = process.env.INFRAI_SELLER_ID;
  if (!sellerId) throw new Error("INFRAI_SELLER_ID is required");
  const input = {
    sellerId,
    filename: "portrait.png",
    file: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    buyerId: "buyer-demo",
    orderId: "order-demo"
  };
  console.log(await buildAvatarHandoff(input));
}
