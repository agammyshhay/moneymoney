// [CUSTOM-CSV-START] CSV export re-enabled (opt-in via config.outputVendors.csv.active)
import csv from './csv/csv';
// [CUSTOM-CSV-END]
import json from './json/json';

const outputVendors = [json, csv];

export default outputVendors;
