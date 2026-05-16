export type EventListener<T = unknown> = (payload: T) => void;

export class EventEmitter {
  protected _listeners: Record<string, EventListener[]>;

  on<T = unknown>(event: string, cb: EventListener<T>): this;
  off<T = unknown>(event: string, cb: EventListener<T>): this;
  once<T = unknown>(event: string, cb: EventListener<T>): this;
  emit<T = unknown>(event: string, payload?: T): void;
}
