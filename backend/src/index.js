//require('dotenv').config({path: './env'})\

import dotenv from "dotenv"
import connectDB from "./db/index.js"
import { app } from "./app.js"

dotenv.config({
  path: './env'
})

connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`⚙️ Server is running at port : ${process.env.PORT}`);
    })
})
.catch((err) => {
    console.log("MONGO db connection failed !!! ", err);
})




















//This is traditional way of connecting database in the index file
/*
import express from "express"
const app=express()

(async()=>{
  try {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
    app.on("Error",(error)=>{
      console.log("ERRR: ", error)
      throw error
    })

    app.listen(process.env.PORT,()=>{
      console.log(`App is listening at port , ${process.env.PORT}`)
    })
  } catch (error) {
    console.error('Err: ',error)  
    throw error
  }
})()
*/