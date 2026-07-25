var clients = new Set();

export function sseHandler(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('data: {"type":"connected"}\n\n');
  clients.add(res);
  req.on('close', function () { clients.delete(res); });
}

export async function broadcast(data) {
  var msg = 'data: ' + JSON.stringify(data) + '\n\n';
  clients.forEach(function (client) {
    try { client.write(msg); } catch (e) { clients.delete(client); }
  });
  try {
    var { default: db } = await import('./db/index.js');
    var { rows } = await db.query("SELECT value FROM settings WHERE key = 'webhook'");
    if (rows.length && rows[0].value && rows[0].value.webhook_url) {
      fetch(rows[0].value.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: data.type, timestamp: new Date().toISOString(), data: data }), signal: AbortSignal.timeout(3000) }).catch(function () {});
    }
  } catch (e) {}
}
