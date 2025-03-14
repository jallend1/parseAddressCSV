import { createReadStream, writeFileSync } from "fs";
import { config } from "dotenv";
import { parse } from "csv-parse";
import { stringify } from "csv-stringify";

config();
const APIKEY = process.env.API_KEY;
const APIURL: string = `https://maps.googleapis.com/maps/api/geocode/json?key=${APIKEY}`;

// *****************************************************
// This is just for testing purposes
// *****************************************************
const sampleAddress: string = "1600 Pennsylvania Avenue NW, Washington, D.C.";
const sampleLocation: {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
} = {
  name: "White House",
  address: "1600 Pennsylvania Avenue NW, Washington, D.C.",
};

const inputCSVFile = "sampleAddresses.csv";
const outputCSVFile = "sampleAddressesWithCoordinates.csv";

// Format address for Google Maps API
const formatAddress = (address: string) => address.split(" ").join("%20");

const fetchAddressCoordinates = async (address: string) => {
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
  const addresses: {
    name: string;
    address: string;
    latitude?: number;
    longitude?: number;
  }[] = [];
  createReadStream(inputCSVFile)
    .pipe(
      parse({
        delimiter: ",",
        columns: (header: string[]) =>
          header.map((column: string) => column.trim()), // Recipient Company not working as a key without trim
      })
    )
    .on("data", (data: { [key: string]: string }) => {
      const location = {
        name: data["Recipient Company"],
        address: data["Recipient Address"],
      };
      addresses.push(location);
    })
    .on("end", () => {
      console.log("CSV file successfully processed");
      addresses.forEach((location) => {
        // Check if address already exists in the array
        const existingLocation = addresses.find(
          (addr) => addr.address === location.address
        );
        // If it does, use the existing coordinates
        if (existingLocation && existingLocation.latitude) {
          location.latitude = existingLocation.latitude;
          location.longitude = existingLocation.longitude;
        }
        // If it doesn't, fetch the coordinates
        else {
          fetchAddressCoordinates(location.address).then(({ lat, lng }) => {
            location.latitude = lat;
            location.longitude = lng;
          });
        }
      });

      // *****************************************************
      // This one will only use one of my precious API credits
      // *****************************************************
      // fetchAddressCoordinates(sampleLocation.address).then(({ lat, lng }) => {
      //   sampleLocation.latitude = lat;
      //   sampleLocation.longitude = lng;
      //   stringify(
      //     [sampleLocation],
      //     {
      //       header: true,
      //       columns: ["name", "address", "latitude", "longitude"],
      //     },
      //     (err, output) => {
      //       if (err) {
      //         console.error(err);
      //       } else {
      //         writeFileSync(outputCSVFile, output);
      //         console.log("My god we've done it!");
      //       }
      //     }
      //   );
      //   console.log(sampleLocation);
      // });

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
