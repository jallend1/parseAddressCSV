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
        if (files.filter((file) => file.endsWith(".csv")).length === 0) {
            console.error("No compatible files found in the directory");
            return;
        }
        // If there are files in the directory, check if the outut file already exists and load the existing addresses to search first
        if ((0, fs_1.existsSync)(outputCSVFile))
            loadExistingAddresses(outputCSVFile);
        return;
        // TODO: Uncomment this when pre-API debugging is done
        for (const file of files) {
            handleCSVFile(inputCSVDirectory + file);
        }
    });
}
// Load existing addresses and coordinates into memory
function loadExistingAddresses(file) {
    return __awaiter(this, void 0, void 0, function* () {
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
            };
            addressBook.push(location);
        })
            .on("end", () => {
            console.log("Existing address book found and loaded into memory.");
        });
    });
}
const fetchAddressCoordinates = (address) => __awaiter(void 0, void 0, void 0, function* () {
    const formattedAddress = formatAddress(address);
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
            // If the transaction date is empty, skip this row (Original file has these spread throughout)
            if (data["Transaction Date"] === "")
                return;
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
    // Check if address already exists in the current batch
    const existsInCurrentArray = currentAddressSearches.find((addr) => addr.address === location.address);
    if (existsInCurrentArray && existsInCurrentArray.latitude) {
        location.latitude = existsInCurrentArray.latitude;
        location.longitude = existsInCurrentArray.longitude;
        return;
    }
    // If it doesn't, check the address book
    const existsInAddressBook = addressBook.find((addr) => addr.address === location.address);
    if (existsInAddressBook) {
        location.latitude = existsInAddressBook.latitude;
        location.longitude = existsInAddressBook.longitude;
    }
};
const writeOutputCSV = (addresses) => {
    const fileExists = (0, fs_1.existsSync)(outputCSVFile);
    // If output file doesn't already exist, include the headers
    (0, csv_stringify_1.stringify)(addresses, {
        header: !fileExists,
        columns: ["name", "address", "date", "latitude", "longitude"],
    }, (err, output) => {
        if (err) {
            console.error(err);
        }
        else {
            (0, fs_1.writeFileSync)(outputCSVFile, output, { flag: "a" });
            console.log("My god we've done it!");
        }
    });
};
readInputCSVDirectory();
