type Listener = (message: string) => void;

const listeners = new Set<Listener>();

/** Shows a brief toast from anywhere; rendered by <ToastHost /> in the root layout. */
export function showToast(message: string) {
  listeners.forEach((l) => l(message));
}

export function subscribeToast(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
