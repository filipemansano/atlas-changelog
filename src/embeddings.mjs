import { client as mongodb } from "./mongodb.mjs";
import { generateEmbeddings } from './openai.mjs';
import { UUID } from "bson";

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