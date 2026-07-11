import axios from "axios";
import { tool } from "langchain";
import * as z from "zod";


const AXIOS_TIMEOUT = 15000;


export function createTools(sandboxId) {

  if (!sandboxId) {
    throw new Error("sandboxId required for tools");
  }


  const client = axios.create({

    baseURL:
      `http://sandbox-svc-${sandboxId}:3000`,

    timeout: AXIOS_TIMEOUT,

  });



  function logStart(name) {

    console.log("\n======================================");
    console.log(`[Tool Started] ${name}`);

  }



  function logEnd(name, start) {

    console.log(
      `[Tool Finished] ${name} (${Date.now() - start}ms)`
    );

    console.log("======================================\n");

  }



  function logError(name, error) {

    console.error("\n======================================");

    console.error(
      `[Tool Failed] ${name}`
    );


    if(error.response){

      console.error(
        "Status:",
        error.response.status
      );

      console.error(
        "Data:",
        error.response.data
      );

    }
    else {

      console.error(
        error.message
      );

    }


    console.error("======================================\n");

  }



  /**
   * LIST FILES
   */
  const listFiles = tool(

    async()=>{

      const start = Date.now();


      try{

        logStart("list_files");


        const response =
          await client.get(
            "/list-files"
          );


        const files =
          response.data.files ?? [];


        console.log(
          "Files count:",
          files.length
        );


        logEnd(
          "list_files",
          start
        );


        return JSON.stringify(files);


      }
      catch(error){

        logError(
          "list_files",
          error
        );


        return JSON.stringify({
          error:
            "Unable to list files"
        });

      }

    },


    {

      name:"list_files",

      description:
        "List all files inside the project. Must be called before modifying code."

    }

  );





  /**
   * READ FILES
   */
  const readFiles = tool(

    async({files})=>{


      const start = Date.now();


      try{


        logStart(
          "read_files"
        );


        if(!files || files.length===0){

          return JSON.stringify([]);

        }



        // safety limit
        const selectedFiles =
          files.slice(0,10);



        console.log(
          "Reading:",
          selectedFiles
        );



        const response =
          await client.get(
            `/read-files?files=${encodeURIComponent(
              selectedFiles.join(",")
            )}`
          );



        logEnd(
          "read_files",
          start
        );


        return JSON.stringify(
          response.data.files ?? []
        );


      }
      catch(error){


        logError(
          "read_files",
          error
        );


        return JSON.stringify({
          error:
            "Unable to read files"
        });


      }


    },


    {


      name:"read_files",


      description:
        "Read existing files before updating them.",


      schema:z.object({

        files:z.array(
          z.string()
        )

      })


    }


  );






  /**
   * CREATE FILES
   */
  const createFiles = tool(

    async({files})=>{


      const start =
        Date.now();


      try{


        logStart(
          "create_files"
        );


        const response =
          await client.post(
            "/create-files",
            {
              files
            }
          );



        logEnd(
          "create_files",
          start
        );


        return JSON.stringify(
          response.data.results ?? []
        );


      }
      catch(error){


        logError(
          "create_files",
          error
        );


        return JSON.stringify({
          error:
            "Create files failed"
        });


      }


    },


    {

      name:
        "create_files",


      description:
        "Create new files only. Never overwrite existing files.",


      schema:z.object({

        files:z.array(

          z.object({

            file:z.string(),

            content:z.string()

          })

        )

      })

    }

  );







  /**
   * UPDATE FILES
   */
  const updateFiles = tool(

    async({files})=>{


      const start =
        Date.now();


      try{


        logStart(
          "update_files"
        );



        const response =
          await client.patch(

            "/update-files",

            {
              updates:files
            }

          );



        logEnd(
          "update_files",
          start
        );


        return JSON.stringify(
          response.data.results ?? []
        );


      }
      catch(error){


        logError(
          "update_files",
          error
        );


        return JSON.stringify({

          error:
            "Update files failed"

        });


      }


    },


    {


      name:
        "update_files",


      description:
        "Update existing files only. Never create new files.",


      schema:z.object({

        files:z.array(

          z.object({

            file:z.string(),

            content:z.string()

          })

        )

      })


    }


  );




  return [

    listFiles,

    readFiles,

    createFiles,

    updateFiles

  ];

}