import { createReadStream, writeFileSync } from "fs";
import { config } from "dotenv";
import { parse } from "csv-parse";
import { stringify } from "csv-stringify";

config();
const APIKEY = process.env.API_KEY;
const APIURL = `https://maps.googleapis.com/maps/api/geocode/json?key=${APIKEY}`;
const sampleAddress = "1600 Pennsylvania Avenue NW, Washington, D.C.";
const sampleLocation = {
  name: "White House",
  address: "1600 Pennsylvania Avenue NW, Washington, D.C.",
};
const inputCSVFile = "sampleAddresses.csv";
const outputCSVFile = "sampleAddressesWithCoordinates.csv";

const formatAddress = (address) => address.split(" ").join("%20");

const fetchAddressCoordinates = async (address) => {
  const formattedAddress = formatAddress(address);
  const response = await fetch(`${APIURL}&address=${formattedAddress}`);
  if (!response.ok) {
    throw new Error("Failed to fetch address coordinates");
  }
  const data = await response.json();
  return data.results[0].geometry.location;
};

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
      console.log("CSV file successfully processed");
      // *****************************************************
      // This one will only use one of my precious API credits
      // *****************************************************
      fetchAddressCoordinates(sampleLocation.address).then((data) => {
        sampleLocation.coordinates = data;
        stringify(
          [sampleLocation],
          { header: true, columns: ["name", "address", "coordinates"] },
          (err, output) => {
            if (err) {
              console.error(err);
            } else {
              writeFileSync(outputCSVFile, output);
              console.log("My god we've done it!");
            }
          }
        );
        console.log(sampleLocation);
      });

      // TODO: This one is real life and will use all my API credits :(
      // addresses.forEach((location) => {
      //   fetchAddressCoordinates(location.address).then((data) => {
      //     location.coordinates = data;
      //     console.log(location);
      //   });
      // });
    });
}

getAddresses();
