const express = require("express");
const app = express();
const blogRoutes = require("./src/routes/blog.routes")
const cors = require("cors")
const clientRoutes = require("./src/routes/client.route")
const PORT = 3000 || process.env.PORT
const projectRoutes = require("./src/routes/project.route");
const connectDb = require("./src/config/db")
app.use(express.json())
app.use(cors({
   origin:"*",
   credentials:true
}))
app.use("/api/projects",projectRoutes)
app.use("/api/blogs",blogRoutes)
app.use("/api/clients",clientRoutes)
connectDb()
app.listen(PORT,()=>{
   console.log("your number is :",PORT) 
})