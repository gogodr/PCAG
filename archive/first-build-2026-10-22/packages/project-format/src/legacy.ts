import { z } from 'zod';
const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const name = z.string().trim().min(1).max(200);
export const legacySchema = z.object({
  formatVersion: z.literal(1), id, name, startRoomId: id,
  assets: z.array(z.object({ id, name, dataUrl: z.string() }).strict()).max(20),
  rooms: z.array(z.object({
    id, name, width: z.number(), height: z.number(), backgroundAssetId: id.nullable(),
    hotspots: z.array(z.object({ id, name, x: z.number(), y: z.number(), width: z.number(), height: z.number(), inspection: z.string() }).strict()).max(50),
  }).strict()).length(1),
}).strict();
