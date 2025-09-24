import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import csvWriter from 'csv-writer';
const { createObjectCsvWriter } = csvWriter;

// Modern equivalent for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * A recursive function to find all .json files in a directory and its subdirectories.
 * @param {string} dir - The starting directory path.
 * @returns {string[]} An array of full file paths to .json files.
 */
function findJsonFilesRecursive(dir) {
    let jsonFiles = [];
    try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);

            if (stat.isDirectory()) {
                jsonFiles = jsonFiles.concat(findJsonFilesRecursive(itemPath));
            } else if (path.extname(item) === '.json') {
                jsonFiles.push(itemPath);
            }
        }
    } catch (err) {
        // Silently ignore errors for directories that can't be read
    }
    return jsonFiles;
}

/**
 * The core logic for processing files.
 * @param {string} jsonFolderPath - The name of the folder containing JSON files.
 * @param {string} outputCsvFile - The desired name for the output CSV file.
 */
async function runConsolidation(jsonFolderPath, outputCsvFile) {
    const fullPath = path.join(__dirname, jsonFolderPath);

    if (!fs.existsSync(fullPath)) {
        console.error(`\n❌ Error: The folder '${jsonFolderPath}' was not found.`);
        return;
    }

    if (path.extname(outputCsvFile) !== '.csv') {
        outputCsvFile += '.csv';
    }

    const csvWriterInstance = createObjectCsvWriter({
        path: outputCsvFile,
        header: [
            // Standard asset fields
            { id: 'customerKey', title: 'customerKey' },
            { id: 'dataExtensionKey', title: 'DataExtensionKey' },
            { id: 'assetType', title: 'assetType' },
            { id: 'assetName', title: 'assetName' },
            { id: 'description', title: 'Description' },
            { id: 'ownerName', title: 'ownerName' },
            { id: 'createdDate', title: 'createdDate' },
            { id: 'modifiedDate', title: 'modifiedDate' },
            { id: 'status', title: 'status' },
            { id: 'folderPath', title: 'folderPath' },
            { id: 'folderContentType', title: 'FolderContentType' },
            // Fields specific to Data Extensions
            { id: 'fieldName', title: 'FieldName' },
            { id: 'fieldType', title: 'FieldType' },
            { id: 'fieldMaxLength', title: 'MaxLength' },
            { id: 'fieldDefaultValue', title: 'DefaultValue' },
            { id: 'fieldIsRequired', title: 'IsRequired' },
            { id: 'fieldIsPrimaryKey', title: 'IsPrimaryKey' },
        ],
    });

    const allRecords = [];
    const jsonFilePaths = findJsonFilesRecursive(fullPath);

    for (const filePath of jsonFilePaths) {
        try {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(fileContent);

            // --- REFINED LOGIC BASED ON YOUR SAMPLE ---
            // Create a base record with data common to all asset types.
            // This handles capitalized keys from DEs and lowercase from others.
            const baseRecord = {
                customerKey: data?.customerKey ?? data?.CustomerKey ?? '',
                dataExtensionKey: data?.CustomerKey ?? data?.r__dataExtension_key ?? '', // For DEs, the key is CustomerKey
                assetType: data?.assetType?.displayName ?? '',
                assetName: data?.Name ?? data?.name ?? '',
                description: data?.Description ?? data?.description ?? '',
                ownerName: data?.owner?.name ?? '',
                createdDate: data?.createdDate ?? '',
                modifiedDate: data?.modifiedDate ?? '',
                status: data?.status?.name ?? '',
                folderPath: data?.r__folder_Path ?? '',
                folderContentType: data?.r__folder_ContentType ?? '',
            };

            if (baseRecord.folderContentType === 'dataextension' && Array.isArray(data.Fields)) {
                // If the asset is a DE, create a row for each field
                for (const field of data.Fields) {
                    allRecords.push({
                        ...baseRecord, // Use all the common data from the base record
                        // Add the specific field info
                        fieldName: field?.Name ?? '',
                        fieldType: field?.FieldType ?? '',
                        fieldMaxLength: field?.MaxLength ?? '',
                        fieldDefaultValue: field?.DefaultValue ?? '',
                        fieldIsRequired: field?.IsRequired ?? false,
                        fieldIsPrimaryKey: field?.IsPrimaryKey ?? false,
                    });
                }
            } else {
                // For all other assets, create a single row with blank field info
                allRecords.push({
                    ...baseRecord,
                    fieldName: '',
                    fieldType: '',
                    fieldMaxLength: '',
                    fieldDefaultValue: '',
                    fieldIsRequired: '',
                    fieldIsPrimaryKey: '',
                });
            }
        } catch (err) {
            const fileName = path.basename(filePath);
            console.warn(`⚠️ Warning: Could not process file ${fileName}. Skipping.`);
        }
    }

    if (allRecords.length > 0) {
        await csvWriterInstance.writeRecords(allRecords);
        console.log(`\n✅ Success! Consolidated ${jsonFilePaths.length} files into ${allRecords.length} rows in '${outputCsvFile}'.`);
    } else {
        console.log("\nℹ️ No JSON files were found. The CSV file was not created.");
    }
}

function start() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Enter the name of the starting folder: ', (folderName) => {
        rl.question('Enter the name for the output CSV file: ', async (outputFileName) => {
            rl.close();
            await runConsolidation(folderName, outputFileName.trim());
        });
    });
}

start();