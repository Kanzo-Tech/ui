// The gauges are package.json's `gauges`; what each measures is `scripts/gauges.mjs`, and why each limit is what it is, `/docs/design`.
import { gauges } from "../../scripts/gauges.mjs";

export default gauges(import.meta.url);
