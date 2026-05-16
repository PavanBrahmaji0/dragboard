import type { Card } from './Card';

export declare class ConfigPanel {
  /** Open the config modal for a given card */
  open(card: Card): void;

  /** Close and remove the modal */
  close(): void;
}
