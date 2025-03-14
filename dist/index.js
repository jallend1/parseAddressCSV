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
const inputCSVFile = "smallBatch.csv";
// const inputCSVFile = "sampleAddresses.csv";
const outputCSVFile = "sampleAddressesWithCoordinates.csv";
// Format address for Google Maps API
const formatAddress = (address) => address.split(" ").join("%20");
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
    // If the geometry object is not present, return 0s
    if (!data.results[0].geometry) {
        return { lat: 0, lng: 0 };
    }
    // Return the coordinates of the first result
    return {
        lat: data.results[0].geometry.location.lat,
        lng: data.results[0].geometry.location.lng,
    };
});
function getAddresses() {
    return __awaiter(this, void 0, void 0, function* () {
        const addresses = [];
        (0, fs_1.createReadStream)(inputCSVFile)
            .pipe((0, csv_parse_1.parse)({
            delimiter: ",",
            columns: (header) => header.map((column) => column.trim()), // Recipient Company not working as a key without trim
        }))
            .on("data", (data) => {
            const location = {
                name: data["Recipient Company"],
                address: data["Recipient Address"],
            };
            addresses.push(location);
        })
            .on("end", () => __awaiter(this, void 0, void 0, function* () {
            const fetchPromises = addresses.map((location) => __awaiter(this, void 0, void 0, function* () {
                // Check if address already exists in the array
                const existingLocation = addresses.find((addr) => addr.address === location.address);
                // If it does, use the existing coordinates
                if (existingLocation && existingLocation.latitude) {
                    location.latitude = existingLocation.latitude;
                    location.longitude = existingLocation.longitude;
                }
                // If it doesn't, fetch the coordinates
                else {
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
            (0, csv_stringify_1.stringify)(addresses, {
                header: true,
                columns: ["name", "address", "latitude", "longitude"],
            }, (err, output) => {
                if (err) {
                    console.error(err);
                }
                else {
                    (0, fs_1.writeFileSync)(outputCSVFile, output);
                    console.log("My god we've done it!");
                }
            });
        }));
    });
}
getAddresses();
