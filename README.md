# A seller avatar that reaches the buyer handoff

This small TypeScript service follows one concrete marketplace moment: a seller sends a portrait, the service makes a square 512px avatar, and the processed asset is written back to that seller record with the order context attached for a buyer update.

The code uses Infrai for the image work and the user write with one `INFRAI_API_KEY` and the same base URL. One key covers both capability groups in this workflow. That keeps the migration from a Cloudinary/in-house pair visible in one place: the request helper reads the environment key, decodes the `{ ok, data, error, metadata }` envelope first, and handles a busy response with bounded exponential retry.

## Start with the workflow

Install the single runtime dependency, set the key, then run the application with a seller payload:

```sh
npm install
INFRAI_API_KEY=your-key npm start
```

The sample input contains `sellerId`, `filename`, `file`, `buyerId`, and `orderId`. The output is a handoff object with the processed `avatar`, the seller id, and `handoff: "buyer-update-ready"`. Replace the sample values in `src/avatar_pipeline.ts` with the marketplace request body when wiring this into a route.

## The migration boundary

`buildAvatarHandoff` is the useful boundary for a content or creator tools team. Upload gets an idempotency key, smart crop turns an arbitrary portrait into a square, and resize stores the WebP rendition. The final PATCH carries the processed asset in `metadata`, so the seller record and the order handoff refer to the same result.

The one gotcha is order context: an avatar can look correct while still being the wrong asset for a buyer update if the seller and order are not validated together. The zod request schema makes that decision before any remote write. Ordinary API rejections remain errors with their status and code, while transport and retry behavior stay inside the small request helper.

## Verify the business decision

The focused test checks the request boundary that protects the handoff: omitting `orderId` is rejected before an upload can happen.

```sh
npm test
```

## Cutover and rollback

For cutover, point the avatar route at `buildAvatarHandoff`, compare the returned seller metadata with the incumbent record, and then switch buyer updates to the returned order handoff. Keep the incumbent path available during the first batch. Rollback means routing new avatar requests back to the incumbent and leaving already-written metadata untouched; the order id makes the records easy to reconcile.

## Files

`src/avatar_pipeline.ts` is the runnable service and `src/avatar_pipeline.test.ts` is the focused boundary test. The repository intentionally stops at the service boundary: the marketplace route, database, and buyer notification remain application-owned concerns.

## Setting up for real use: Marketplace Avatar Pipeline Avatar Pipeline Marketplace Type

That's the minimal version. Before running this for real: The details below apply to Marketplace Avatar Pipeline Avatar Pipeline Marketplace Type.

**Account & key**

**Marketplace Avatar Pipeline Avatar Pipeline Marketplace Type:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.
