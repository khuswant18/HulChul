import "dotenv/config";
import express from "express";
import { createKaamkaajApp } from "./kaamkaaj/app.ts";
import { createZentrailApp } from "./zentrail/app.ts";
import { createPostboxApp } from "./postbox/app.ts";
import { db, noFaults, reset, save, type Faults } from "./store.ts";

const password = process.env.SANDBOX_PASSWORD ?? "demo-pass-2026";
const ports = { kaamkaaj: 4010, postbox: 4020, zentrail: 4030 };
const zentrailUrl = `http://localhost:${ports.zentrail}`;

if (process.argv.includes("--reset")) reset();

const kaamkaaj = createKaamkaajApp({ password, zentrailUrl });

const admin = express.Router();
admin.use(express.json());
admin.get("/faults", (_req, res) => res.json(db().faults));
admin.post("/faults", (req, res) => {
  const patch = req.body as Partial<Faults>;
  const faults = { ...db().faults, ...patch };
  db().faults = faults;

  if (patch.expireSessionAfter) {
    for (const session of Object.values(db().sessions)) session.requestsLeft = patch.expireSessionAfter;
    faults.expireSessionAfter = 0;
  }
  save();
  res.json(faults);
});
admin.post("/faults/clear", (_req, res) => {
  db().faults = noFaults();
  save();
  res.json(db().faults);
});
admin.post("/reset", (_req, res) => {
  reset();
  res.json({ ok: true });
});
admin.get("/applications", (_req, res) => res.json(db().applications));
kaamkaaj.use("/__admin", admin);

kaamkaaj.listen(ports.kaamkaaj, () => console.log(`Kaamkaaj job board  http://localhost:${ports.kaamkaaj}`));
createPostboxApp({ password }).listen(ports.postbox, () => console.log(`Postbox webmail     http://localhost:${ports.postbox}`));
createZentrailApp().listen(ports.zentrail, () => console.log(`Zentrail careers    ${zentrailUrl}`));
