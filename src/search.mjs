import { client as mongodb } from "./mongodb.mjs";
import { generateEmbeddings, completions } from './openai.mjs';

const collection = mongodb.db("changelog").collection("embeddings");

const validLanguages = ['pt-br', 'es-es', 'en-us'];
const validProducts = ['atlas', 'search', 'vectorSearch', 'dataFederation', 'appServices'];

export async function httpHandler(event) {

    const { text, language, product } = JSON.parse(event.body);

    if (!validLanguages.includes(language)) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid language' })
        };
    }

    if (!validProducts.includes(product)) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid product' })
        };
    }

    if (!text || text.trim() === '') {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid question' })
        };
    }

    const queryVector = await generateEmbeddings(text);

    const changes = await collection.aggregate([
        {
            "$vectorSearch": {
                queryVector: queryVector.data[0].embedding,
                path: "embeddings",
                numCandidates: 10,
                index: "changelog_vector_index",
                limit: 3,
                filter: {
                    product: product,
                }
              }
        },
        {
            "$lookup": {
                from: product,
                localField: "id",
                foreignField: "_id",
                as: "changes"
            }
        },
        {
            "$unwind": "$changes"
        },
        {
            "$project": {
                _id: 0,
                changes: 1
            }
        }
    ]).toArray();

    const response = await completions(product, text, changes.map(item => item.changes), language);

    return {
        statusCode: 200,
        body: JSON.stringify({ response })
    };
}