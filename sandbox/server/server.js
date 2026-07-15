import app from "./src/app.js";
import { initPool } from "./src/pool.js";

// Await pool init so the server only starts accepting traffic once at least
// POOL_SIZE warm pods are ready. Without this await, every early request
// hits the slow on-demand fallback path (30–60 s).
await initPool();

app.listen(3000, () => {
  console.log("Sandbox Api is running at port 3000");
});
