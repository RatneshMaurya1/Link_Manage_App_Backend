const express = require("express")
require("dotenv").config()
const connectDb = require("./config/db")
const userRouter = require("./router/userRouter")
const cors = require("cors")
const linkRouter = require("./router/linkRouter")
const PORT = process.env.PORT || 9000
const app = express()
app.set("trust proxy", true);


const corsOptions = {
    origin:[
        process.env.LOCAL_FRONTEND_URL,
        process.env.FRONTEND_URL
    ],
    method:["GET","POST","PUT","PATCH","DELETE"]
}
app.use(cors(corsOptions))


app.use(express.json())

app.use("/api/",userRouter)
app.use("/",linkRouter)

app.use("/",(req,res) => {
    res.send("Welcome to the home page")
})


connectDb()
.then(() => {
    console.log("MongoDB connected successfully...")
    app.listen(PORT, () => {
        console.log(`server is running on ${PORT}`)
    })
}).catch((err) => {
    console.log("mongodb connection failed" + err)
})

