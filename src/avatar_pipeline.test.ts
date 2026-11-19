import assert from "node:assert/strict";
import { buildAvatarHandoff } from "./avatar_pipeline.ts";

await assert.rejects(
  buildAvatarHandoff({ sellerId: "seller", filename: "portrait.jpg", file: "data", buyerId: "buyer" }),
  /orderId/
);

console.log("avatar request boundary rejects a handoff without an order id");
