export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function demoAccounts(users: { email: string; name: string }[], password: string, accent: string) {
  const rows = users
    .map(
      (u) => `<li>
        <span><strong>${esc(u.name)}</strong><br><code>${esc(u.email)}</code></span>
        <button type="button" data-email="${esc(u.email)}">Use this account</button>
      </li>`,
    )
    .join("");
  return `<aside class="demo-accounts" aria-label="Demo accounts">
    <p><strong>Demo accounts</strong> Password for both: <code>${esc(password)}</code></p>
    <ul>${rows}</ul>
    <style>
      .demo-accounts{margin:0 0 18px;padding:12px 14px;border:1px dashed ${accent};border-radius:6px;background:#fbfbfd;font-size:13px}
      .demo-accounts p{margin:0 0 8px}
      .demo-accounts ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}
      .demo-accounts li{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .demo-accounts code{font:12px ui-monospace,Menlo,monospace;color:#444;white-space:nowrap}
      .demo-accounts button{font:inherit;font-size:12px;padding:4px 10px;border:1px solid ${accent};background:#fff;color:${accent};border-radius:4px;cursor:pointer}
    </style>
    <script>
      document.querySelectorAll(".demo-accounts button").forEach(function (b) {
        b.addEventListener("click", function () {
          document.getElementById("email").value = b.dataset.email;
          document.getElementById("password").value = ${JSON.stringify(password)};
        });
      });
    </script>
  </aside>`;
}

export const rupees = (n: number) => "₹" + n.toLocaleString("en-IN");

export function stipendText(min: number, max: number) {
  return min === max ? `${rupees(min)} /month` : `${rupees(min)} - ${max.toLocaleString("en-IN")} /month`;
}

export function shortDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function daysAgoText(d: Date) {
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}
