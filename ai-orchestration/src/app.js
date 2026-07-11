import express from "express";
import morgan from "morgan";
import crypto from "crypto";

import agentRouter from "./routes/agent.routes.js";


const app = express();



/**
 * Request ID Middleware
 */
app.use((req, res, next) => {

  req.requestId =
    crypto.randomUUID();


  res.setHeader(
    "X-Request-ID",
    req.requestId
  );


  next();

});



/**
 * Logging
 */
app.use(
  morgan(
    (tokens, req, res) => {

      return [
        `[${req.requestId}]`,
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        `${tokens["response-time"](req, res)} ms`,
      ].join(" ");

    }
  )
);



/**
 * Body Parser
 */
app.use(
  express.json({
    limit:"2mb"
  })
);


app.use(
  express.urlencoded({
    extended:true,
    limit:"2mb"
  })
);





/**
 * Routes
 */
app.use(
  "/api/ai",
  agentRouter
);





/**
 * Health Check
 */
app.get(
  "/api/status/healthz",
  (req,res)=>{

    res.status(200).json({

      status:"ok",

      service:
        "ai-orchestration",

      uptime:
        process.uptime(),

      timestamp:
        new Date().toISOString()

    });

  }
);





/**
 * 404 Handler
 */
app.use(
  (req,res)=>{

    res.status(404).json({

      success:false,

      error:
        "Route not found",

      path:
        req.originalUrl

    });

  }
);





/**
 * Global Error Handler
 */
app.use(
  (err,req,res,next)=>{


    console.error(
      "\n======================================"
    );

    console.error(
      `[${req.requestId}] Application Error`
    );

    console.error(err);


    console.error(
      "======================================\n"
    );



    res.status(500).json({

      success:false,

      error:
        "Internal server error",

      requestId:
        req.requestId

    });


  }
);



export default app;