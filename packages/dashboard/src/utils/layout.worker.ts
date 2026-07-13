import { computeLayout, type LayoutMessage } from "./layoutAlgorithm.js";

self.onmessage = (event: MessageEvent<LayoutMessage>) => {
  self.postMessage(computeLayout(event.data));
};
