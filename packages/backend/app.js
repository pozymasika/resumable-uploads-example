var express = require("express");
var Busboy = require("busboy");
var util = require("util");
var fs = require("fs");
var path = require("path");
var MultiStream = require("multistream");
var debug = require("debug")("backend:server");

const app = express();

function prettyBytes(bytes = 0, decimals = 2) {
  if (bytes == 0) return "0 Bytes";
  var k = 1024,
    sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
    i = Math.floor(Math.log(bytes) / Math.log(k));
  return (
    parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i]
  );
}

/**
 * parses a range header: bytes 0-99/1000
 * @param {string} range
 * @returns {{start: number, end: number, total: number}}}
 */
function parseRange(range) {
  // bytes 0-99/1000
  var parts = range.replace(/bytes /, "").split("/");
  var rangeParts = parts[0].split("-");
  var start = parseInt(rangeParts[0], 10);
  var end = parseInt(rangeParts[1], 10);
  var total = parseInt(parts[1], 10);
  return { start, end, total };
}

// receive a file upload
app.post("/upload", (req, res) => {
  var busboy = Busboy({ headers: req.headers });
  busboy.on("file", (fieldName, file, info) => {
    // inspect the range headers
    var chunkSize = req.headers["chunk-size"];
    var fileId = req.headers["file-id"];
    var contentRangeHeader = req.headers["content-range"];
    var range = parseRange(contentRangeHeader);
    // determine the chunk being sent
    var part = range.start / chunkSize; // 3000 / 1000 = 3
    // save chunk to temp file
    var partFilename = util.format("%i.part", part); // 0.part, 1.part
    var tmpDirName = util.format("./tmp/%s", fileId);
    debug(
      `Uploading chunk ${prettyBytes(range.start)} - ${prettyBytes(
        range.end
      )} of ${prettyBytes(range.total)}`
    );

    if (!fs.existsSync(tmpDirName)) {
      fs.mkdirSync(tmpDirName, { recursive: true });
    }

    var partFilePath = path.join(tmpDirName, partFilename);
    var writeStream = fs.createWriteStream(partFilePath);
    file.pipe(writeStream);

    file.on("end", () => {
      // once complete, combine chunks into one file
      var isLastPart = range.total === range.end + 1;
      if (isLastPart) {
        var totalParts = Math.ceil(range.total / chunkSize);
        debug(`Combining ${totalParts} chunks into ${fileId}`);

        var fileParts = [];
        for (var i = 0; i < totalParts; i++) {
          fileParts.push(path.join(tmpDirName, util.format("%i.part", i)));
        }

        var destFilePath = path.join("./uploads", fileId);
        if (!fs.existsSync("./uploads")) {
          fs.mkdirSync("./uploads", { recursive: true });
        }

        var outPutStream = fs.createWriteStream(destFilePath);
        var inputStream = fileParts.map((part) => fs.createReadStream(part));
        var combinedStream = new MultiStream(inputStream);
        combinedStream.pipe(outPutStream);

        combinedStream.on("end", () => {
          debug(`Final file saved to ${destFilePath}`);
          // delete tmp dir
          fs.rmSync(tmpDirName, { recursive: true });
          res.status(200).send("ok");
        });

        combinedStream.on("error", (err) => {
          res.status(500).send(err);
        });
      } else {
        res.status(200).send("ok");
      }
    });
  });
  req.pipe(busboy);
});

module.exports = app;
