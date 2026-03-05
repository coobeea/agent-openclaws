import WebSocket from 'ws';
const ws = new WebSocket('ws://localhost:8765/api/hub/ws');

ws.on('open', () => {
  console.log('Connected, waiting...');
});

ws.on('message', (data) => {
  console.log('Received:', data.toString());
});

ws.on('close', (code, reason) => {
  console.log('Closed:', code, reason.toString());
});

ws.on('error', (err) => {
  console.error('Error:', err);
});
