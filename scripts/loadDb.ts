import { DataAPIClient } from "@datastax/astra-db-ts";
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import OpenAI from "openai"

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"

import "dotenv/config"

type similarityMetric = 'dot_product' | 'cosine' | 'euclidean'

const {
    ASTRA_DB_NAMESPACE,
    ASTRA_DB_COLLECTION,
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN,
    OPENAI_API_KEY,
} = process.env;

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

const f1Data = [
    'https://en.wikipedia.org/wiki/Formula_One',
    'https://en.wikipedia.org/wiki/Formula One',
    'https://www.formula1.com/en/latest/all',
    'https://en.wikipedia.org/wiki/2023 Formula One World Championship',
    'https://en.wikipedia.org/wiki/2022 Formula One Wbrld Championship',
    'https://en.wikipedia.org/wiki/List of Formula One World Drivers%27 Champions',
    'https://en.wikipedia.org/wiki/2024 Formula One World Championship',
    'https://www.formula1.com/en/results.html/2024/races.html',
    'https://www.formula1.com/en/racing/2024.html'
]

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, { keyspace: ASTRA_DB_NAMESPACE });

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 100
});

const createCollection = async (similarityMetric: similarityMetric = "dot_product") => {
    try {
        const res = await db.createCollection(ASTRA_DB_COLLECTION, {
            vector: {
                dimension: 1536,
                metric: similarityMetric
            }
        });
        return res;

    } catch (error) {
        console.log(error);
    }
}

const scrapePage = async (url: string) => {
    const loader = new PuppeteerWebBaseLoader(url, {
        launchOptions: {
            headless: true
        },
        gotoOptions: {
            waitUntil: "domcontentloaded"
        },
        evaluate: async (page, browser) => {
            const result = await page.evaluate(() => document.body.innerHTML)
            await browser.close();
            return result;
        }
    });
    return (await loader.load())[0].pageContent.replace(/<[^>]*>?/gm, '');
}

const loadSampleData = async () => {
    try {
        const collection = await db.collection(ASTRA_DB_COLLECTION);
        for await (const url of f1Data) {
            const content = await scrapePage(url);
            const chunks = await splitter.splitText(content);
            for await (const chunk of chunks) {
                const embedding = await openai.embeddings.create({
                    model: "text-embedding-3-small",
                    input: chunk,
                    encoding_format: "float"
                });
                const vector = embedding.data[0].embedding;
                const res = await collection.insertOne({
                    $vector: vector,
                    text: chunk
                });
                console.log(res);
            }
        }
    } catch (error) {
        console.log(error);
    }
}

createCollection().then(() => loadSampleData());