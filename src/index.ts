import { createReadStream, writeFileSync, readdirSync, existsSync } from "fs";
import { config } from "dotenv";
import { parse } from "csv-parse";
import { stringify } from "csv-stringify";

config();
const APIKEY = process.env.API_KEY;
const APIURL: string = `https://maps.googleapis.com/maps/api/geocode/json?key=${APIKEY}`;

const inputCSVDirectory = "./data/";
const outputCSVFile = "withCoordinates.csv";
// Stores addresses and coordinates to limit repetitive API calls
const addressBook: {
  address: string;
  latitude: number;
  longitude: number;
}[] = [];

// Stores the addresses to search in the current batch
const currentAddressSearches: {
  name: string;
  address: string;
  date: string;
  latitude?: number;
  longitude?: number;
}[] = [];

// Format address for Google Maps API
const formatAddress = (address: string) => address.split(" ").join("%20");

// Read the input CSV directory and iterate through the files
async function readInputCSVDirectory() {
  const files = readdirSync(inputCSVDirectory);
  if (!files) {
    console.error("No files found in the directory");
    return;
  }
  if (files.filter((file) => file.endsWith(".csv")).length === 0) {
    console.error("No compatible files found in the directory");
    return;
  }
  // If there are files in the directory, check if the outut file already exists and load the existing addresses to search first
  if (existsSync(outputCSVFile)) loadExistingAddresses(outputCSVFile);
  return;

  // TODO: Uncomment this when pre-API debugging is done
  for (const file of files) {
    handleCSVFile(inputCSVDirectory + file);
  }
}

// Load existing addresses and coordinates into memory
async function loadExistingAddresses(file: string) {
  createReadStream(file)
    .pipe(
      parse({
        delimiter: ",",
        columns: (header: string[]) =>
          header.map((column: string) => column.trim()),
      })
    )
    .on("data", (data: { [key: string]: string }) => {
      const location = {
        address: data.address,
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
      };
      addressBook.push(location);
    })
    .on("end", () => {
      console.log("Existing address book found and loaded into memory.");
    });
}

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

  // If the geometry object is not present, return zeros
  if (!data.results[0].geometry) {
    return { lat: 0, lng: 0 };
  }

  // Return the coordinates of the first result
  return {
    lat: data.results[0].geometry.location.lat,
    lng: data.results[0].geometry.location.lng,
  };
};

async function handleCSVFile(file: string) {
  createReadStream(file)
    .pipe(
      parse({
        delimiter: ",",
        columns: (header: string[]) =>
          // Recipient Company not working as a key without trim
          header.map((column: string) => column.trim()),
      })
    )
    .on("data", (data: { [key: string]: string }) => {
      // If the transaction date is empty, skip this row (Original file has these spread throughout)
      if (data["Transaction Date"] === "") return;

      // If the recipient company name is empty, the recipient name has the desired info
      let name;
      data["Recipient Company"] === ""
        ? (name = data["Recipient Name"])
        : (name = data["Recipient Company"]);

      const location = {
        name: name,
        address: data["Recipient Address"],
        date: data["Transaction Date"],
      };
      currentAddressSearches.push(location);
    })
    .on("end", async () => {
      const fetchPromises = currentAddressSearches.map(async (location) => {
        coordinatesExist(location);
        // If location already has coordinates, skip the fetch
        if (!location.latitude) {
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
      writeOutputCSV(currentAddressSearches);
    });
}

const coordinatesExist = (location: {
  name: string;
  address: string;
  date: string;
  latitude?: number;
  longitude?: number;
}) => {
  // Check if address already exists in the current batch
  const existsInCurrentArray = currentAddressSearches.find(
    (addr) => addr.address === location.address
  );
  if (existsInCurrentArray && existsInCurrentArray.latitude) {
    location.latitude = existsInCurrentArray.latitude;
    location.longitude = existsInCurrentArray.longitude;
    return;
  }
  // If it doesn't, check the address book
  const existsInAddressBook = addressBook.find(
    (addr) => addr.address === location.address
  );
  if (existsInAddressBook) {
    location.latitude = existsInAddressBook.latitude;
    location.longitude = existsInAddressBook.longitude;
  }
};

const writeOutputCSV = (
  addresses: {
    name: string;
    address: string;
    date: string;
    latitude?: number;
    longitude?: number;
  }[]
) => {
  const fileExists = existsSync(outputCSVFile);
  // If output file doesn't already exist, include the headers
  stringify(
    addresses,
    {
      header: !fileExists,
      columns: ["name", "address", "date", "latitude", "longitude"],
    },
    (err, output) => {
      if (err) {
        console.error(err);
      } else {
        writeFileSync(outputCSVFile, output, { flag: "a" });
        console.log("My god we've done it!");
      }
    }
  );
};

readInputCSVDirectory();
