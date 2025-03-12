import { createReadStream } from "fs";
import dotenv from "dotenv";
import { parse } from "csv-parse";

dotenv.config();
const APIKEY = process.env.API_KEY;
console.log(APIKEY);

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

// getAddresses();
