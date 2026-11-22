const http = require("http"), fs = require("fs"), path = require("path");
const { WebSocketServer } = require("ws");
const USER = (process.env.TIKTOK_USER || "").replace("@", "").trim();
const page = fs.readFileSync(path.join(__dirname, "index.html"));

const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x"), q = u.searchParams;
  if (u.pathname === "/teste") {
    send({ t: "gift", name: q.get("nome") || "Ana", gift: q.get("presente") || "Rose", diamonds: +q.get("diamantes") || 1, count: 1 });
    return res.end("presente enviado");
  }
  if (u.pathname === "/comentar") {
    send({ t: "chat", name: q.get("nome") || "Ana", text: q.get("texto") || "perdão" });
    return res.end("comentário enviado");
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(page);
});
const wss = new WebSocketServer({ server, path: "/ws" });
function send(m) { const s = JSON.stringify(m); wss.clients.forEach(c => c.readyState === 1 && c.send(s)); }

async function tiktok() {
  if (!USER) return console.log("Defina TIKTOK_USER para ligar na sua live. Os testes /teste e /comentar já funcionam.");
  const lib = await import("tiktok-live-connector");
  const C = lib.TikTokLiveConnection || lib.WebcastPushConnection, E = lib.WebcastEvent || {};
  const c = new C(USER, process.env.SIGN_API_KEY ? { signApiKey: process.env.SIGN_API_KEY } : {});
  const who = d => (d.user && (d.user.uniqueId || d.user.nickname)) || d.uniqueId || d.nickname || "ovelhinha";
  c.on(E.CHAT || "chat", d => send({ t: "chat", name: who(d), text: d.comment || "" }));
  c.on(E.GIFT || "gift", d => {
    const g = d.giftDetails || d;
    if ((g.giftType === 1 || d.giftType === 1) && !d.repeatEnd) return;
    send({ t: "gift", name: who(d), gift: g.giftName || d.giftName || "", diamonds: g.diamondCount || d.diamondCount || 0, count: d.repeatCount || 1 });
  });
  c.on(E.LIKE || "like", d => send({ t: "like", name: who(d) }));
  c.on(E.MEMBER || "member", d => send({ t: "join", name: who(d) }));
  const go = () => c.connect().then(() => console.log("Conectado à live de @" + USER))
    .catch(e => { console.log("Falha ao conectar:", e.message || e); setTimeout(go, 15000); });
  go();
}
server.listen(process.env.PORT || 3000, () => {
  console.log("Jogo no ar");
  tiktok().catch(e => console.log("Erro:", e.message));
});
