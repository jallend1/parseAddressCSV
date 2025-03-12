import { createReadStream } from "fs";
import dotenv from "dotenv";
import { parse } from "csv-parse";

dotenv.config();
const APIKEY = process.env.API_KEY;
const APIURL = `https://maps.googleapis.com/maps/api/geocode/json?key=${APIKEY}`;
const sampleAddress = "1600 Amphitheatre Parkway, Mountain View, CA";
const inputCSVFile = "sampleAddresses.csv";
const outputCSVFile = "sampleAddressesWithCoordinates.csv";

// const formatAddress = (address) => address.split(" ").join("%20");

// const fetchAddressCoordinates = async (address) => {
//   const formattedAddress = formatAddress(address);
//   const response = await fetch(`${APIURL}&address=${formattedAddress}`);
//   if (!response.ok) {
//     throw new Error("Failed to fetch address coordinates");
//   }
//   const data = await response.json();
//   return data.results[0].geometry.location;
// };

// fetchAddressCoordinates(sampleAddress).then((data) => {
//   console.log(data);
//   // Sample return: { lat: 37.4220113, lng: -122.0847483 }
// });

async function getAddresses() {
  const addresses = [];
  createReadStream(inputCSVFile)
    .pipe(
      parse({
        delimiter: ",",
        columns: (header) => header.map((column) => column.trim()), // Recipient Company not working as a key without trim
      })
    )
    .on("data", (data) => {
      const location = {
        name: data["Recipient Company"],
        address: data["Recipient Address"],
      };

      addresses.push(location);
    })
    .on("end", () => {
      console.log(addresses);
      console.log("CSV file successfully processed");
    });
}

getAddresses();
