import crypto from "node:crypto";
import express from "express";
import cookieParser from "cookie-parser";
import { db, findUser, save } from "../store.ts";
import { esc } from "../html.ts";

// A bare-bones webmail client. The job board and Zentrail "send" email here.

const css = `
body{margin:0;font:14px/1.45 -apple-system,"Helvetica Neue",Arial,sans-serif;color:#222;background:#fafafa}
.bar{background:#fff;border-bottom:1px solid #e3e3e3;padding:12px 24px;display:flex;justify-content:space-between;align-items:center}
.bar b{font-size:17px;color:#c2410c}
main{max-width:900px;margin:24px auto;padding:0 24px}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e3e3e3}
td{padding:10px 14px;border-bottom:1px solid #eee;vertical-align:top}
tr.unread td{font-weight:600}
td.from{width:210px;color:#444}td.date{width:150px;color:#777;text-align:right;white-space:nowrap}
a{color:inherit;text-decoration:none}a:hover{text-decoration:underline}
.msg{background:#fff;border:1px solid #e3e3e3;padding:22px 26px}
.msg pre{font:inherit;white-space:pre-wrap}
.login{max-width:340px;margin:60px auto;background:#fff;border:1px solid #e3e3e3;padding:24px}
.login input{width:100%;box-sizing:border-box;padding:8px;margin:4px 0 12px;border:1px solid #ccc}
.login button{padding:8px 18px;background:#c2410c;color:#fff;border:0;cursor:pointer}
`;

const shell = (title: string, body: string, email?: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(title)} | Postbox</title><style>${css}</style></head><body>
<div class="bar"><b>Postbox</b>${email ? `<span>${esc(email)}</span>` : ""}</div><main>${body}</main></body></html>`;

export function createPostboxApp(options: { password: string }) {
  const app = express();
  const sessions = new Map<string, string>();

  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  app.use((_req, res, next) => {
    if (db().faults.mailOutage) {
      return res.status(503).send(shell("Unavailable", "<h1>Postbox is temporarily unavailable</h1><p>Please try again in a few minutes.</p>"));
    }
    next();
  });

  const currentUser = (req: express.Request) => sessions.get(req.cookies.pb_session);

  app.get("/login", (_req, res) => {
    res.send(
      shell(
        "Sign in",
        `<form class="login" method="post" action="/login">
          <h2 style="margin-top:0">Sign in</h2>
          <label for="email">Email</label><input id="email" name="email" type="email" required>
          <label for="password">Password</label><input id="password" name="password" type="password" required>
          <button type="submit">Sign in</button>
        </form>`,
      ),
    );
  });

  app.post("/login", (req, res) => {
    const { email = "", password = "" } = req.body as Record<string, string>;
    const user = findUser(email);
    if (!user || password !== options.password) return res.status(401).send(shell("Sign in", "<p>Wrong email or password.</p>"));
    const token = crypto.randomBytes(12).toString("hex");
    sessions.set(token, user.email);
    res.cookie("pb_session", token, { httpOnly: true });
    res.redirect("/");
  });

  app.get("/", (req, res) => {
    const email = currentUser(req);
    if (!email) return res.redirect("/login");
    const mails = db()
      .mails.filter((m) => m.to === email)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    res.send(
      shell(
        "Inbox",
        `<h2>Inbox</h2>
        ${
          mails.length
            ? `<table aria-label="Inbox"><tbody>${mails
                .map(
                  (m) => `<tr class="${m.read ? "" : "unread"}" data-mail-id="${m.id}">
                    <td class="from">${esc(m.from)}</td>
                    <td class="subject"><a href="/messages/${m.id}">${esc(m.subject)}</a></td>
                    <td class="date">${new Date(m.sentAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td></tr>`,
                )
                .join("")}</tbody></table>`
            : "<p>Your inbox is empty.</p>"
        }`,
        email,
      ),
    );
  });

  app.get("/messages/:id", (req, res) => {
    const email = currentUser(req);
    if (!email) return res.redirect("/login");
    const mail = db().mails.find((m) => m.id === Number(req.params.id) && m.to === email);
    if (!mail) return res.status(404).send(shell("Not found", "<p>Message not found.</p>", email));
    mail.read = true;
    save();
    res.send(
      shell(
        mail.subject,
        `<p><a href="/">← Inbox</a></p><div class="msg"><h2 style="margin-top:0">${esc(mail.subject)}</h2>
        <p style="color:#666">From ${esc(mail.from)} · ${new Date(mail.sentAt).toLocaleString("en-IN")}</p><pre>${esc(mail.body)}</pre></div>`,
        email,
      ),
    );
  });

  return app;
}
