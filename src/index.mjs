import axios from "axios";
import xpath from "xpath";
import { DOMParser } from "@xmldom/xmldom";
import { client as mongodb } from "./mongodb.mjs";
import { sendMessage } from "./telegram.mjs";
import { UUID } from "bson";
import { SQS } from "@aws-sdk/client-sqs";

const products = [
    {
        collection: "search",
        name: "Atlas Search",
        url: "https://www.mongodb.com/docs/atlas/atlas-search/changelog/"
    },
    {
        collection: "vectorSearch",
        name: "Atlas Vector Search",
        url: "https://www.mongodb.com/docs/atlas/atlas-vector-search/changelog/"
    },
    {
        collection: "atlas",
        name: "Atlas",
        url: "https://www.mongodb.com/docs/atlas/release-notes/atlas/"
    },
    {
        collection: "dataFederation",
        name: "Atlas Data Federation",
        url: "https://www.mongodb.com/docs/atlas/release-notes/data-federation/"
    },
    {
        collection: "appServices",
        name: "App Services",
        url: "https://www.mongodb.com/docs/atlas/app-services/release-notes/backend/"
    }
];

function convertStringToDate(dateString) {
    const dateParts = dateString.split(" ");
    const day = parseInt(dateParts[0], 10);
    const month = dateParts[1];
    const year = parseInt(dateParts[2], 10);
    
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthIndex = monthNames.indexOf(month);
    
    return new Date(year, monthIndex, day);
}

function processListItems(node, depth = 0) {

    let result = '';
    const extractNodeText = (target, targetDepth = 0) => Array.from(target.childNodes).forEach(child => {
        
        if(child.nodeName === 'style' && child.textContent !== null){
            result = result.replace(child.textContent, "");
        }

        if(child.nodeName === 'p'){
            if(targetDepth > 0) result += '\n';
            result += child.textContent.replace(/\s+/g, ' ').trim();
        }

        if(child.childNodes !== null) extractNodeText(child, targetDepth+1);
    });

    extractNodeText(node);

    const subItems = xpath.select(`./ul/li`, node);
    subItems.forEach(subItem => {
        result += '\n' + '\t'.repeat(depth + 1);
        result += processListItems(subItem, depth + 1);
    });

    return result;
}

async function getChangelog(date, url){
    const response = await axios.get(url);
    const doc = new DOMParser({errorHandler: {}}).parseFromString(response.data, 'text/xml');

    const releases = xpath.select(
        "//h2[starts-with(text(),'20') and contains(text(),'Releases')]", 
        doc
    );

    const onlyDate = date.toISOString().split('T')[0]

    return releases.map(release => {
        const year = parseInt(release.textContent.replace("Releases", "").trim());

        if(date.getFullYear() > year) {
            return null;
        };

        const releaseItems = xpath.select(
            `following-sibling::section`, 
            release
        );

        const dates = releaseItems.map(releaseItem => {
            let releaseDate = xpath.select1(
                `.//h3[contains(text(),'${year} Release')]`, 
                releaseItem
            )?.textContent;

            if(!releaseDate) return null;
            releaseDate = convertStringToDate(releaseDate)

            if(onlyDate >= releaseDate.toISOString().split('T')[0]){
                return null;
            }

            const changes = xpath.select(
                `./ul/li`, 
                releaseItem
            ).map(change => processListItems(change));

            return { date: releaseDate, changes };
        }).filter(Boolean);

        return { year, dates };

    }).filter(Boolean);
}

const sqs = new SQS({ region: "us-east-1" });
const db = mongodb.db("changelog");
const start = new Date('2000-01-01');
const options = {
    sort: { date: -1 },
    projection: { _id: 0, date: 1 },
};

export async function scheduledEventHandler(event) {
    for (let product of products){

        const collection = db.collection(product.collection);
        const lastChange = await collection.findOne({}, options);
        const lastDate = lastChange ? lastChange.date : start;

        console.log(`\nProcessing ${product.collection} since ${lastDate}`);
        const changelog = await getChangelog(lastDate, product.url);
        
        const records = [];
        const telegramPromises = [];
        for (let releases of changelog){
            for (let dates of releases.dates){
                for (let change of dates.changes){

                    records.push({
                        _id: new UUID(),
                        date: dates.date,
                        changes: change
                    });

                    telegramPromises.push(sendMessage(product.name, dates.date, change))
                }
            }
        }

        if(records.length > 0){
            console.log(`Inserting ${records.length} records`);

            // wait for all telegram messages to be sent before inserting records
            await Promise.all(telegramPromises);

            // wait for all records to be inserted before sending messages to SQS
            await collection.insertMany(records);

            const messages = records.map(record => sqs.sendMessage({
                QueueUrl: process.env.SQS_URL,
                MessageBody: JSON.stringify({
                    id: record._id,
                    product: product.collection,
                    change: record.changes
                })
            }));

            await Promise.all(messages);
        }

        console.log(`Finished processing ${product.collection}`);
    }

    //await mongodb.close();
    console.log('Processing completed');
};