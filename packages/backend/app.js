var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var app = express();
var Busboy = require("busboy");
var { parse } = require("content-range");
var util = require("util");
var fs = require("fs");
var MultiStream = require("multistream");

// app.use(logger("dev"));
// app.use(express.json());
// app.use(express.urlencoded({ extended: false }));
// app.use(cookieParser());
// app.use(express.static(path.join(__dirname, "public")));

// an upload route that supports resumability using range headers
app.post("/upload", (req, res) => {
  var busboy = Busboy({ headers: req.headers });
  busboy.on("file", (name, file, info) => {
    const chunkSize = req.headers["chunk-size"];
    const fileId = req.headers["unique-file-id"];
    const filename = fileId;
    const contentRangeHeader = req.headers["content-range"];
    const contentRange = parse(contentRangeHeader);

    if (!contentRange) {
      return res.status(400).json({
        error: "Invalid Content-Range header",
      });
    }

    const part = contentRange.start / chunkSize;
    const partFilename = util.format("%i.part", part);
    const tmpDirName = util.format("./tmp/%s", fileId);
    console.log("partFilename: ", partFilename);

    if (!fs.existsSync(tmpDirName)) {
      fs.mkdirSync(tmpDirName, { recursive: true });
    }

    const partFilePath = path.join(tmpDirName, partFilename);
    const writableStream = fs.createWriteStream(partFilePath);
    file.pipe(writableStream);

    file.on("end", () => {
      const isLastPart = contentRange.size === contentRange.end + 1;
      console.log("isLastPart: ", isLastPart, { contentRange });
      if (isLastPart) {
        const totalParts = Math.ceil(contentRange.size / chunkSize);
        const parts = [...Array(totalParts).keys()];
        const partFiles = parts.map((part) => {
          return path.join(tmpDirName, util.format("%i.part", part));
        });

        const destFilePath = path.join("./uploads", filename);
        if (!fs.existsSync("./uploads")) {
          fs.mkdirSync("./uploads", { recursive: true });
        }

        const fileDescriptor = fs.openSync(destFilePath, "w");
        const outputStream = fs.createWriteStream(destFilePath);
        const inputListStream = partFiles.map((file) =>
          fs.createReadStream(file)
        );

        const combinedStream = new MultiStream(inputListStream);
        combinedStream.pipe(outputStream);
        combinedStream.on("end", () => {
          fs.closeSync(fileDescriptor);
          // remove tmp files
          partFiles.forEach((file) => fs.unlinkSync(file));
          res.status(200).json({
            message: "File uploaded successfully",
          });
        });

        combinedStream.on("error", (err) => {
          fs.closeSync(fileDescriptor);
          res.status(500).json({
            error: err,
          });
        });
      } else {
        res.status(200).json({
          message: "Chunk uploaded successfully",
        });
      }
    });
  });

  req.pipe(busboy);
});

module.exports = app;
