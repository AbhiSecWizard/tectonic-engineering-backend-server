const express = require("express");
const app = express();
const blogRoutes = require("./src/routes/blog.routes")
const cors = require("cors")
const clientRoutes = require("./src/routes/client.route")
const galleryRoutes = require("./src/routes/gallery.routes")
const teamRoutes = require("./src/routes/team.routes")
const authRouter = require("./src/routes/auth.routes")
const cookieParser = require("cookie-parser")
const PORT = 3000 || process.env.PORT
const projectRoutes = require("./src/routes/project.route");
const connectDb = require("./src/config/db")
app.use(express.json())
app.use(cookieParser());   
app.use(cors({
   origin:"http://localhost:5173",
   credentials:true
}))
app.use("/api/projects",projectRoutes)
app.use("/api/blogs",blogRoutes)
app.use("/api/clients",clientRoutes)
app.use("/api/gallery",galleryRoutes)
app.use("/api/team",teamRoutes)
app.use("/api/admin",authRouter)
connectDb()

app.get("/",(req,res)=>{
   res.send("your server is healthy its. techtonic web server")
})

app.listen(PORT,()=>{
   console.log("your number is :",PORT) 
})