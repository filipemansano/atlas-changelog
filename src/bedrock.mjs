import { BedrockRuntimeClient, InvokeModelCommand, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
const client = new BedrockRuntimeClient({ region: "us-east-1" });

/**
 * AWS Bedrock Pricing
 * Amazon Titan Text Embeddings V2
 *  - $0.00002 per 1,000 input tokens
 */
export async function generateEmbeddings(inputText) {
    
    const command = new InvokeModelCommand({
        body: Buffer.from(JSON.stringify({
            "inputText": inputText,
            "dimensions": 1024,
            "normalize": true
        })),
        contentType: 'application/json',
        modelId: 'amazon.titan-embed-text-v2:0',
    });

    const response = await client.send(command);
    const body = JSON.parse(Buffer.from(response.body).toString());
    return body.embedding
}

/**
 * AWS Bedrock Pricing
 * Llama 3 Instruct (70B)
 *  - $0.00265 per 1,000 input tokens
 *  - $0.0035 per 1,000 output tokens
 * 
 * Llama 3 Instruct (8B)
 *  - $0.0004 per 1,000 input tokens
 *  - $0.0006 per 1,000 output tokens
 */
export async function completions(product, question, context, language) {
    const input = {
        modelId: "meta.llama3-8b-instruct-v1:0",
        system: [
            { "text": `You are a helpful assistant that will answer the question about the ${product} changelogs in ${language}, for answer the question use the following changelogs\n${context.join('\n\n')}. remember to always respond in ${language} and be as clear as possible.`}
        ],
        messages: [
            {
                "role": "user",
                "content": [{"text": question}]
            }
        ]
    };

    const response = await client.send(new ConverseCommand(input));
    console.log(response.usage);
    return response.output.message.content;
}