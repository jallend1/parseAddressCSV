import { parse } from "csv-parse";
import { createReadStream } from "fs";

const APIKEY = null;
const APIURL = `https://maps.googleapis.com/maps/api/geocode/json`;

const inputCSVFile = "sampleAddresses.csv";
const outputCSVFile = "sampleAddressesWithCoordinates.csv";

async function getAddresses() {
  const addresses = [];
  createReadStream(inputCSVFile)
    .pipe(parse({ delimiter: ",", columns: true }))
    .on("data", (data) => {
      addresses.push(data["Recipient Address"]);
    })
    .on("end", () => {
      console.log(addresses);
      console.log("CSV file successfully processed");
    });
}

getAddresses();
