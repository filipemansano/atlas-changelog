import axios from 'axios';
import { client as mongodb } from "./mongodb.mjs";
const API_KEY = process.env.OPENAI_API_KEY;
import { UUID } from "bson";

async function generateEmbeddings(inputText) {
    const url = 'https://api.openai.com/v1/embeddings';
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
    };

    const data = {
        model: 'text-embedding-ada-002',
        input: inputText
    };

    try {
        const response = await axios.post(url, data, { headers });
        return response.data;
    } catch (error) {
        throw error;
    }
}

const collection = mongodb.db("changelog").collection("embeddings");
export async function queueEventHandler(sqsEvent) {

    const promises = [];
    for (let record of sqsEvent.Records) {
        const message = JSON.parse(record.body);
        const { id, product, change } = message;
        const promise = generateEmbeddings(change)
            .then(embedding => {
                return { id: new UUID(id), product, embeddings: embedding.data[0].embedding, model: {
                    name: embedding.model,
                    usage: embedding.usage
                } };
            });

        promises.push(promise);
    }

    if (promises.length === 0) return;

    const embeddings = await Promise.all(promises);
    await collection.insertMany(embeddings);
}