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
(0, dotenv_1.config)();
const APIKEY = process.env.API_KEY;
const APIURL = `https://maps.googleapis.com/maps/api/geocode/json?key=${APIKEY}`;
// *****************************************************
// This is just for testing purposes
// *****************************************************
const sampleAddress = "1600 Pennsylvania Avenue NW, Washington, D.C.";
const sampleLocation = {
    name: "White House",
    address: "1600 Pennsylvania Avenue NW, Washington, D.C.",
};
const inputCSVFile = "sampleAddresses.csv";
const outputCSVFile = "sampleAddressesWithCoordinates.csv";
const formatAddress = (address) => address.split(" ").join("%20");
const fetchAddressCoordinates = (address) => __awaiter(void 0, void 0, void 0, function* () {
    const formattedAddress = formatAddress(address);
    const response = yield fetch(`${APIURL}&address=${formattedAddress}`);
    if (!response.ok) {
        throw new Error("Failed to fetch address coordinates");
    }
    const data = yield response.json();
    return data.results[0].geometry.location;
});
// fetchAddressCoordinates(sampleAddress).then((data) => {
//   console.log(data);
//   // Sample return: { lat: 37.4220113, lng: -122.0847483 }
// });
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
            .on("end", () => {
            console.log("CSV file successfully processed");
            // *****************************************************
            // This one will only use one of my precious API credits
            // *****************************************************
            // fetchAddressCoordinates(sampleLocation.address).then((data) => {
            //   sampleLocation.coordinates = data;
            //   stringify(
            //     [sampleLocation],
            //     { header: true, columns: ["name", "address", "coordinates"] },
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
    });
}
getAddresses();
