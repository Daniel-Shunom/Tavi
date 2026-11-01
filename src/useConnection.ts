import { useCallback, useEffect, useRef, useState } from 'react';
import { initialState, serverMessageSchema, type Command, type State } from '../shared/protocol';
import { serviceSocketUrl } from './judging/transport';
export function useConnection() {
  const [state, setState] = useState<State>(initialState);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const ws = useRef<WebSocket | null>(null);
  // Offset between the service clock and this browser, so cues render on a shared timeline.
  const offset = useRef(0);
  useEffect(() => {
    let disposed = false;
    let retry: ReturnType<typeof setTimeout>;
    function connect() {
      const socket = new WebSocket(serviceSocketUrl());
      ws.current = socket;
      socket.onopen = () => {
        if (!disposed) {
          setConnected(true);
          setError('');
        }
      };
      socket.onmessage = (event) => {
        try {
          const message = serverMessageSchema.parse(JSON.parse(String(event.data)));
          if (message.type === 'state') {
            offset.current = message.now - Date.now();
            setState(message.state);
          }
          if (message.type === 'error') setError(message.message);
        } catch {
          setError('Received an unreadable update.');
        }
      };
      socket.onclose = () => {
        if (!disposed) {
          setConnected(false);
          retry = setTimeout(connect, 1500);
        }
      };
      socket.onerror = () => {
        socket.close();
      };
    }
    connect();
    return () => {
      disposed = true;
      clearTimeout(retry);
      ws.current?.close();
    };
  }, []);
  const send = useCallback((command: Command) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      setError('');
      ws.current.send(JSON.stringify(command));
    } else setError('Studio is disconnected. Changes have not been saved.');
  }, []);
  const serverNow = useCallback(() => Date.now() + offset.current, []);
  return { state, connected, error, send, serverNow };
}
