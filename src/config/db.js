const mongoose = require("mongoose");

async function connectDb (){
   try {
      await mongoose.connect("mongodb+srv://abhishekyadav:EPio9PKCb7iRaB9R@uberapp.gadacue.mongodb.net/tectonicadminpanel")
      console.log("database is connected");
   } catch (error) {
     console.log("ERROR FROM CONNECT DATABASE FUNCTION:",error)   
   }
}

module.exports = connectDb