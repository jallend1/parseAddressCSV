const fs = require("fs");
fs.readFile("sampleAddresses.csv", "utf8", (err, data) => {
  if (err) console.log(err);
  else console.log(data);
});
