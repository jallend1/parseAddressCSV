import { createReadStream, writeFileSync } from "fs";
import { config } from "dotenv";
import { parse } from "csv-parse";
import { stringify } from "csv-stringify";

config();
const APIKEY = process.env.API_KEY;
const APIURL: string = `https://maps.googleapis.com/maps/api/geocode/json?key=${APIKEY}`;

const inputCSVFile = "smallBatch.csv";
// const inputCSVFile = "sampleAddresses.csv";
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

  // Sample return: { lat: 37.4220113, lng: -122.0847483 }
  // If the status is ZERO_RESULTS, return 0s
  if (data.status === "ZERO_RESULTS") {
    return { lat: 0, lng: 0 };
  }

  // If the geometry object is not present, return 0s
  if (!data.results[0].geometry) {
    return { lat: 0, lng: 0 };
  }

  // Return the coordinates of the first result
  return {
    lat: data.results[0].geometry.location.lat,
    lng: data.results[0].geometry.location.lng,
  };
};

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
    .on("end", async () => {
      const fetchPromises = addresses.map(async (location) => {
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
          try {
            const { lat, lng } = await fetchAddressCoordinates(
              location.address
            );
            location.latitude = lat;
            location.longitude = lng;
          } catch (error) {
            // Return 0s for coordinates if fetch fails
            console.error(
              "Failed to fetch coordinates for: " + location.address
            );
            location.latitude = 0;
            location.longitude = 0;
          }
        }
      });

      // Wait for all fetches to complete, so I don't write to the file before all coordinates are fetched (AGAIN)
      await Promise.all(fetchPromises);

      stringify(
        addresses,
        {
          header: true,
          columns: ["name", "address", "latitude", "longitude"],
        },
        (err, output) => {
          if (err) {
            console.error(err);
          } else {
            writeFileSync(outputCSVFile, output);
            console.log("My god we've done it!");
          }
        }
      );
    });
}

getAddresses();
