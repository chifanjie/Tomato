import { createSearchWorkerEngine } from "./searchWorkerEngine";
import type { SearchWorkerRequest } from "./searchWorkerProtocol";

const handle = createSearchWorkerEngine();
self.onmessage = (event: MessageEvent<SearchWorkerRequest>) => self.postMessage(handle(event.data));
