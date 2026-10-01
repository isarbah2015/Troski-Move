export type ToastKind = 'success' | 'error';
type Listener = (message: string, kind: ToastKind) => void;

const listeners = new Set<Listener>();

/** Shows a brief toast from anywhere; rendered by <ToastHost /> in the root layout. Use `error` for things that did not happen. */
export function showToast(message: string, kind: ToastKind = 'success') {
  listeners.forEach((l) => l(message, kind));
}

export function subscribeToast(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
