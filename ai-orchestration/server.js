import "dotenv/config";
import app from "./src/app.js";


const PORT =
  process.env.PORT || 3000;



const server =
  app.listen(PORT, () => {

    console.log(
      "======================================"
    );

    console.log(
      "🚀 AI Orchestration Server Started"
    );

    console.log(
      "Port:",
      PORT
    );

    console.log(
      "Environment:",
      process.env.NODE_ENV || "development"
    );

    console.log(
      "======================================"
    );

  });





/**
 * Graceful Shutdown
 */
function shutdown(signal) {


  console.log(
    `\nReceived ${signal}. Starting graceful shutdown...`
  );


  server.close(() => {


    console.log(
      "HTTP server closed successfully."
    );


    process.exit(0);


  });



  // Force close after timeout
  setTimeout(()=>{


    console.error(
      "Forced shutdown after timeout."
    );


    process.exit(1);


  },10000);


}





/**
 * Uncaught Exception
 */
process.on(
  "uncaughtException",
  (error)=>{


    console.error(
      "\n======================================"
    );


    console.error(
      "UNCAUGHT EXCEPTION"
    );


    console.error(error);


    console.error(
      "======================================\n"
    );


    shutdown(
      "uncaughtException"
    );


  }
);





/**
 * Unhandled Promise Rejection
 */
process.on(
  "unhandledRejection",
  (reason)=>{


    console.error(
      "\n======================================"
    );


    console.error(
      "UNHANDLED PROMISE REJECTION"
    );


    console.error(reason);


    console.error(
      "======================================\n"
    );


    shutdown(
      "unhandledRejection"
    );


  }
);





/**
 * Kubernetes Signals
 */
process.on(
  "SIGTERM",
  ()=>shutdown("SIGTERM")
);


process.on(
  "SIGINT",
  ()=>shutdown("SIGINT")
);