// The worker the evaluation fixture's model runs in, so a long prefill never holds the page's thread
// — the one the harnesses poll the page on. Its whole script is `serveLocalModel`.
import { serveLocalModel } from "@kanzo-tech/llm/local";

void serveLocalModel();
