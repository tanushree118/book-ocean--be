// Entry Point of the API Server

const express = require("express");
var multer = require("multer");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs/promises");
let CryptoJS = require("crypto-js");

/* Creates an Express application.
The express() function is a top-level
function exported by the express module.
*/
const app = express();
const Pool = require("pg").Pool;

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "BookOcean",
  password: "Tanush001",
  dialect: "postgres",
  port: 5432,
});

/* To handle the HTTP Methods Body Parser
is used, Generally used to extract the
entire body portion of an incoming
request stream and exposes it on req.body
*/
const bodyParser = require("body-parser");
const { enc } = require("crypto-js");
app.use(bodyParser.text());
app.use(bodyParser.urlencoded({ extended: false }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

pool.connect((err, client, release) => {
  if (err) {
    return console.error("Error acquiring client", err.stack);
  }
  client.query("SELECT NOW()", (err1, result) => {
    release();
    if (err1) {
      return console.error("Error executing query", err.stack);
    }
    console.log("Connected to Database !");
  });
});

const getCipheredText = (text) => {
  return CryptoJS.AES.encrypt(text, 'my-secret-key@123').toString();
}

app.post("/checkIfRegisteredUser", async (req, res, next) => {
  const userCredentials = JSON.parse(req.body);
  var bytes = CryptoJS.AES.decrypt(userCredentials.password, 'my-secret-key@123');
  var decryptedPassword = (bytes.toString(CryptoJS.enc.Utf8));
  let result = [];
  let error = "";
  try {
    await pool
      .query(
        `Select count(*) from registered_users where username = '${userCredentials.username?.toLowerCase()}' and password = '${decryptedPassword}'`
      )
      .then((testData) => {
        if (testData.rows[0].count > 0) {
          result.push({
            status: true,
            message: "User validation done successfully",
          });
        } else {
          result.push({
            status: false,
            message: `Invalid username or password`,
          });
        }
      });
  } catch (err) {
    error = err;
    console.log(`%%%%%%%%%%%%${err}`);
  }
  if (error) {
    result.push({
      status: false,
      message: `User validation failed due to ${error}`,
    });
  }
  res.send(result);
});

app.post("/newuser", async (req, res, next) => {
  const dataToBeInserted = JSON.parse(req.body);
  let bytes = CryptoJS.AES.decrypt(dataToBeInserted.password, 'my-secret-key@123');
  let decryptedPassword = (bytes.toString(CryptoJS.enc.Utf8));
  let result = [];
  let error = "";
  try {
    await pool.query(
      `INSERT INTO "registered_users" (firstname, lastname, email_address, username, password) 
      VALUES ('${dataToBeInserted.firstname}', '${dataToBeInserted.lastname}', '${dataToBeInserted.emailAddress}', '${dataToBeInserted.username?.toLowerCase()}', '${decryptedPassword}')`
    );
  } catch (err) {
    error = err;
    console.log(`=====${err}`);
  }
  if (error) {
    result.push({
      status: false,
      message: `Insertion failed due to ${error}`,
    });
  } else {
    result.push({
      status: true,
      message: "Data inserted successfully",
    });
  }
  res.send(result);
});

app.get("/getbookdetails", async (req, res, next) => {
  let result = [];
  try {
    await pool.query('SELECT * from "books"').then((testData) => {
      testData.rows.forEach((ele) => result.push(ele));
    });
  } catch (err) {
    console.log(`getbooks query failed due to ${err}`);
  }
  res.send(result);
});

app.get("/getAllRegisteredUsers", async (req, res, next) => {
  let result = [];
  let error = "";
  try {
    await pool
      .query('SELECT username from "registered_users"')
      .then((testData) => {
        testData.rows.forEach((key) => result.push(key.username));
      });
  } catch (err) {
    error = err;
    console.log(`getAllRegisteredUsers query failed due to ${error}`);
  }
  if (error) {
    result.push({
      status: false,
      message: `Request failed due to ${error}`,
    });
  }
  res.send(result);
});

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Uploads is the Upload_folder_name
    cb(null, "books");
  },
  filename: function (req, file, cb) {
    const fileName = Date.now() + "-" + file.originalname;
    cb(null, fileName);
  },
});

const maxSize = 1 * 1000 * 1000 * 1000;

var upload = multer({
  storage: storage,
  limits: { fileSize: maxSize },
  fileFilter: function (req, file, cb) {
    // Set the filetypes, it is optional
    var filetypes = /epub|pdf|mobi|doc/;
    var mimetype = filetypes.test(file.mimetype);

    var extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }

    cb(
      "Error: File upload only supports the " +
        "following filetypes - " +
        filetypes
    );
  },
}).single("myFile");

app.post("/uploadFile", function (req, res, next) {
  let result = [];
  // Error MiddleWare for multer file upload, so if any
  // error occurs, the image would not be uploaded!
  upload(req, res, function (err) {
    if (err) {
      // ERROR occured (here it can be occured due
      // to uploading image of size greater than
      // 1MB or uploading different file type)
      result.push({
        status: false,
        message: `Upload failure due to : ${err}`,
      });
    } else {
      // SUCCESS, image successfully uploaded
      result.push({
        status: true,
        message: "Success, File Uploaded!",
      });
    }
    res.send(result);
  });
});

app.post("/uploadFileDetails", async function (req, res, next) {
  const detailsToBeStored = JSON.parse(req.body);
  let bookDetails = {
    bookName: "",
    author: "",
    genre: "",
    aboutBook: "",
    contributor: "",
    fileName: "",
    fileSize: "",
  };
  Object.entries(detailsToBeStored)?.map((entry) => {
    if (entry[0] !== "fileSize") {
      bookDetails[entry[0]] = entry[1].replace(/'/g, `''`);
    } else {
      bookDetails[entry[0]] = entry[1];
    }
  });
  let result = [];
  let error = "";
  try {
    await pool.query(
      `INSERT INTO "books" (name, author, contributor, about_file, genre, file_name, file_size) VALUES
      ('${bookDetails.bookName}', 
        '${bookDetails.author}', 
        '${bookDetails.contributor}', 
        '${bookDetails.aboutBook}', 
        '${bookDetails.genre}',
        '${bookDetails.fileName}',
        ${bookDetails.fileSize}
        )`
    );
  } catch (err) {
    error = err;
    console.log(err);
  }
  if (error) {
    result.push({
      status: false,
      message: `Insertion failed due to ${error}`,
    });
  } else {
    result.push({
      status: true,
      message: "Details inserted successfully",
    });
  }
  res.send(result);
});

app.post("/downloadFile", (req, res) => {
  const requestedFileToDownload = JSON.parse(req.body);
  const directoryPath = path.join(__dirname, "books");
  //passsing directoryPath and callback function
  fs.readdir(directoryPath, function (err, files) {
    //handling error
    if (err) {
      return console.log("Unable to scan directory: " + err);
    }
    //listing all files using forEach
    files.forEach(function (file) {
      let fileSize = fs.statSync(`${directoryPath}/${file}`).size;

      if (
        file.substring(file.indexOf("-") + 1) ===
          requestedFileToDownload.fileName &&
        requestedFileToDownload.fileSize === fileSize
      ) {
        res.download(`${directoryPath}/${file}`);
      }
    });
  });
});

app.post("/deleteFile", async (req, res) => {
  const fileDetails = JSON.parse(req.body);
  const directoryPath = path.join(__dirname, "books");
  let result = [];
  let error1 = "";
  let isFileDeleted = false;
  fs.readdir(directoryPath, async function (err, files) {
    //handling error
    if (err) {
      return console.log("Unable to scan directory: " + err);
    }
    //listing all files using for...of
      for(let file of files) {
        let fileSize = fs.statSync(`${directoryPath}/${file}`).size;
        if (
          file.substring(file.indexOf("-") + 1) === fileDetails.fileName &&
          fileDetails.fileSize === fileSize
        ) {
          await fsPromises.unlink(`${directoryPath}/${file}`);
          isFileDeleted = true;
          break;
        }
      }
    if (isFileDeleted) {
      try {
        await pool.query(
          `DELETE FROM "books" WHERE file_name = '${fileDetails.fileName}'
           AND contributor = '${fileDetails.contributor}' AND file_size = '${fileDetails.fileSize}'`
        );
      } catch (error) {
        error1 = err;
        console.log(erro1);
      }
      if (error1) {
        result.push({
          status: false,
          message: `Deletion failed due to ${error}`,
        });
      } else {
        result.push({
          status: true,
          message: "Deletion successful",
        });
      }
      res.send(result);
    }
  });
  
});

app.post("/getPassword", async(req, res) => {
  const loggedInUser = JSON.parse(req.body);
  let result = [];
  let error = "";
  let encryptedPassword = "";
  try {
    await pool.query(
      `SELECT password FROM "registered_users" WHERE username = '${loggedInUser.toLowerCase()}'`
    ).then((testData) => {
      encryptedPassword = getCipheredText(testData?.rows[0]?.password)
    })
  } catch(err) {
    error = err;
  }
  if (error) {
    result.push({
      status: false,
      message: `Request failed due to ${error}`
    })
  } else {
    result.push({
      status: true,
      message: encryptedPassword
    })
  }
  res.send(result);
})

app.post("/changePassword", async(req, res) => {
  const passwordFields = JSON.parse(req.body);
  const decryptedPasswordFields = {
    oldPassword: "",
    newPassword: "",
    confirmNewPassword: "",
    loggedInUser: passwordFields.loggedInUser
  }
  let result = [];
  let error = "";
  Object.entries(passwordFields).map((field) => {
    if(field[0] !== 'loggedInUser') {
      let bytes = CryptoJS.AES.decrypt(field[1], 'my-secret-key@123');
      decryptedPasswordFields[field[0]] = (bytes.toString(CryptoJS.enc.Utf8));
    }
  });
  try {
    await pool.query(
      `UPDATE "registered_users" SET password = '${decryptedPasswordFields.newPassword}' WHERE username = '${decryptedPasswordFields.loggedInUser?.toLowerCase()}' and password = '${decryptedPasswordFields.oldPassword}'`
    )
  } catch(err) {
    error = err;
    console.log(error);
  }
  if (error) {
    result.push({
      status: false,
      message: `Updation failed due to ${error}`
    })
  } else {
    result.push({
      status: true,
      message: 'Password changed successfully'
    })
  }
  res.send(result);
})

app.post("/suggestedBooks", async(req, res) => {
  const suggestedBookDetails = JSON.parse(req.body);
  let result = [];
  let error = "";
  try {
    await pool.query(
      `INSERT INTO "suggested_books" (book, author, requested_by) VALUES
      ('${suggestedBookDetails.bookName}', '${suggestedBookDetails.author}', '${suggestedBookDetails.requested_by?.toLowerCase()}')`
    );
  } catch(err) {
    console.log(err);
    error = err;
  }
  if (error) {
    result.push({
      status: false,
      message: `Insertion failed due to ${error}`
    })
  } else {
    result.push({
      status: true,
      message: "Book suggestion stored successfully"
    })
  }
  res.send(result);
})

// Require the Routes API
// Create a Server and run it on the port 8080
const server = app.listen(8080, function () {
  let host = server.address().address;
  let port = server.address().port;
  console.log(`Host: ${host} ; Port: ${port}`)
  // Starting the Server at the port 8080
});
