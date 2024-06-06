import axios from 'axios';
const API_KEY = process.env.OPENAI_API_KEY;

export async function generateEmbeddings(inputText) {
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

export async function completions(product, question, context, language) {
    const url = 'https://api.openai.com/v1/chat/completions';
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
    };

    const data = {
        model: "gpt-3.5-turbo",
        messages: [
            {
              "role": "system",
              "content": `You are a helpful assistant that will answer the question about the ${product} changelogs in ${language}, for answer the question use the following changelogs\n${context.join('\n\n')}. remember to always respond in ${language} and be as clear as possible.`
            },
            {
              "role": "user",
              "content": question
            }
        ]
    };

    try {
        const response = await axios.post(url, data, { headers });
        return response.data.choices[0].message.content;
    } catch (error) {
        throw error;
    }
}