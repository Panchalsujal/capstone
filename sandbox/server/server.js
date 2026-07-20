import app from "./src/app.js";
import { initPool } from "./src/pool.js";
import { connectToDb } from "./src/config/db.js";

// Await pool init so the server only starts accepting traffic once at least
// POOL_SIZE warm pods are ready. Without this await, every early request
// hits the slow on-demand fallback path (30–60 s).
connectToDb();
await initPool();

app.listen(3000, () => {
  console.log("Sandbox Api is running at port 3000");
});
