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

export function broadcast(data) {
  var msg = 'data: ' + JSON.stringify(data) + '\n\n';
  clients.forEach(function (client) {
    try { client.write(msg); } catch (e) { clients.delete(client); }
  });
}
