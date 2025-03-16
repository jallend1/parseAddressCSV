"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const dotenv_1 = require("dotenv");
const csv_parse_1 = require("csv-parse");
const csv_stringify_1 = require("csv-stringify");
(0, dotenv_1.config)();
const APIKEY = process.env.API_KEY;
const APIURL = `https://maps.googleapis.com/maps/api/geocode/json?key=${APIKEY}`;
const inputCSVDirectory = "./data/";
const outputCSVFile = "withCoordinates.csv";
// Stores addresses and coordinates to limit repetitive API calls
const addressBook = [];
let totalFetches = 0;
// Stores the addresses to search in the current batch
const currentAddressSearches = [];
// Format address for Google Maps API
const formatAddress = (address) => address.split(" ").join("%20");
// Read the input CSV directory and iterate through the files
function readInputCSVDirectory() {
    return __awaiter(this, void 0, void 0, function* () {
        const files = (0, fs_1.readdirSync)(inputCSVDirectory);
        if (!files) {
            console.error("No files found in the directory");
            return;
        }
        // TODO: Batch converted xls to csv, but xls extension stayed the same so ignoring it for now
        // if (files.filter((file) => file.endsWith(".csv")).length === 0) {
        //   console.error("No compatible files found in the directory");
        //   return;
        // }
        // If there are files in the directory, check if the outut file already exists and load the existing addresses to search first
        (0, fs_1.existsSync)(outputCSVFile)
            ? loadExistingAddresses(outputCSVFile)
            : console.log("No existing address book found.");
        // return;
        for (const file of files) {
            yield handleCSVFile(inputCSVDirectory + file);
        }
    });
}
// Load existing addresses and coordinates into memory
function loadExistingAddresses(file) {
    return __awaiter(this, void 0, void 0, function* () {
        let count = 0;
        (0, fs_1.createReadStream)(file)
            .pipe((0, csv_parse_1.parse)({
            delimiter: ",",
            columns: (header) => header.map((column) => column.trim()),
        }))
            .on("data", (data) => {
            const location = {
                address: data.address,
                latitude: parseFloat(data.latitude),
                longitude: parseFloat(data.longitude),
                trackingNumber: data.trackingNumber,
                name: data.name,
                date: data.date,
            };
            count++;
            // Check if address already exists in the address book and if so, skip it to keep it small
            // if (addressBook.find((addr) => addr.address === location.address)) return;
            addressBook.push(location);
        })
            .on("end", () => {
            console.log(`Existing address book found and ${addressBook.length} locations loaded into memory.`);
        });
    });
}
const isDuplicateTransaction = (trackingNumber) => {
    const duplicate = addressBook.find((addr) => addr.trackingNumber === trackingNumber);
    if (duplicate) {
        console.log(`Duplicate transaction found for ${trackingNumber}`);
        return true;
    }
    // return addressBook.find((addr) => addr.trackingNumber === trackingNumber);
};
const fetchAddressCoordinates = (address) => __awaiter(void 0, void 0, void 0, function* () {
    const formattedAddress = formatAddress(address);
    totalFetches++;
    const response = yield fetch(`${APIURL}&address=${formattedAddress}`);
    if (!response.ok) {
        throw new Error("Failed to fetch address coordinates");
    }
    const data = yield response.json();
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
});
function handleCSVFile(file) {
    return __awaiter(this, void 0, void 0, function* () {
        (0, fs_1.createReadStream)(file)
            .pipe((0, csv_parse_1.parse)({
            delimiter: ",",
            columns: (header) => 
            // Recipient Company not working as a key without trim
            header.map((column) => column.trim()),
        }))
            .on("data", (data) => {
            // If the tracking number is empty or doesn't include the {, skip this row (Original file has these spread throughout)
            if (!data["Package Tracking Number"] ||
                !data["Package Tracking Number"].includes("{"))
                return;
            // if (!data["Package Tracking Number"].includes("{")) return;
            // If the recipient company name is empty, the recipient name has the desired info
            let name;
            data["Recipient Company"] === ""
                ? (name = data["Recipient Name"])
                : (name = data["Recipient Company"]);
            const location = {
                name: name,
                address: data["Recipient Address"],
                date: data["Transaction Date"],
                trackingNumber: data["Package Tracking Number"],
            };
            if (!isDuplicateTransaction(data["Package Tracking Number"])) {
                currentAddressSearches.push(location);
            }
            else {
                console.log(`Duplicate transaction found for ${location.trackingNumber}`);
            }
        })
            .on("end", () => __awaiter(this, void 0, void 0, function* () {
            const fetchPromises = currentAddressSearches.map((location) => __awaiter(this, void 0, void 0, function* () {
                coordinatesExist(location);
                // If location already has coordinates, skip the fetch
                if (!location.latitude) {
                    try {
                        const { lat, lng } = yield fetchAddressCoordinates(location.address);
                        location.latitude = lat;
                        location.longitude = lng;
                    }
                    catch (error) {
                        // Return 0s for coordinates if fetch fails
                        console.error("Failed to fetch coordinates for: " + location.address);
                        console.error(error);
                        location.latitude = 0;
                        location.longitude = 0;
                    }
                }
            }));
            // Wait for all fetches to complete, so I don't write to the file before all coordinates are fetched (AGAIN)
            yield Promise.all(fetchPromises);
            writeOutputCSV(currentAddressSearches);
        }));
    });
}
const coordinatesExist = (location) => {
    // Check if cooordinates already exist in the address book
    const existsInAddressBook = addressBook.find((addr) => addr.address === location.address);
    if (existsInAddressBook) {
        location.latitude = existsInAddressBook.latitude;
        location.longitude = existsInAddressBook.longitude;
    }
    // Check if address already exists in the current batch
    const existsInCurrentArray = currentAddressSearches.find((addr) => addr.address === location.address);
    if (existsInCurrentArray && existsInCurrentArray.latitude) {
        location.latitude = existsInCurrentArray.latitude;
        location.longitude = existsInCurrentArray.longitude;
        return;
    }
};
const writeOutputCSV = (addresses) => {
    const fileExists = (0, fs_1.existsSync)(outputCSVFile);
    // If output file doesn't already exist, include the headers
    (0, csv_stringify_1.stringify)(addresses, {
        header: !fileExists,
        columns: [
            "name",
            "address",
            "date",
            "latitude",
            "longitude",
            "trackingNumber",
        ],
    }, (err, output) => {
        if (err) {
            console.error(err);
        }
        else {
            (0, fs_1.writeFileSync)(outputCSVFile, output, { flag: "a" });
            // Once writefile sync is complete, add the addresses to the address book for the next batch
            addresses.forEach((address) => {
                var _a, _b;
                addressBook.push({
                    name: address.name,
                    date: address.date,
                    address: address.address,
                    latitude: (_a = address.latitude) !== null && _a !== void 0 ? _a : 0,
                    longitude: (_b = address.longitude) !== null && _b !== void 0 ? _b : 0,
                    trackingNumber: address.trackingNumber,
                });
            });
            // Clear the current address searches
            currentAddressSearches.splice(0, currentAddressSearches.length);
            console.log(`My god we've done it! ${totalFetches} successful fetches made!`);
            console.log(`Output written to ${outputCSVFile}`);
        }
    });
};
readInputCSVDirectory();
