// Create a function to get the WebSocket URL based on the current environment
export function getWebSocketUrl(path: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}${path}`;
}

export function createWebSocket(): WebSocket {
  const wsUrl = getWebSocketUrl('/ws/file-updates');
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connection established');
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket connection closed');
    // Attempt to reconnect after a delay
    setTimeout(() => {
      console.log('Attempting to reconnect WebSocket...');
      createWebSocket();
    }, 5000);
  };

  return ws;
}
