import OpenAI from "openai";
import { DataAPIClient } from "@datastax/astra-db-ts";
import Groq from "groq-sdk";

// Initialize OpenAI client for Embeddings
// We use OpenAI only for generating vector embeddings, not for chat.
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Groq client for Chat Completions
// Groq is used as the LLM to generate the final response.
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

// Initialize AstraDB client for Vector Retrieval
// This connects to our database where the F1 data is stored.
const client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(process.env.ASTRA_DB_API_ENDPOINT, {
    keyspace: process.env.ASTRA_DB_NAMESPACE,
});

export async function POST(req: Request) {
    try {
        // 1. Get the user's message from the request body
        const { messages } = await req.json();
        const latestMessage = messages[messages?.length - 1]?.content;

        let docContext = "";

        // 2. Generate Embedding for the user's question
        // We convert the text question into a vector (array of numbers) to compare with our stored data.
        const embedding = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: latestMessage,
            encoding_format: "float",
        });

        // 3. Retrieve relevant documents from AstraDB
        // We search for vectors in our database that are similar to the question's vector.
        try {
            const collection = await db.collection(process.env.ASTRA_DB_COLLECTION || "");

            // Perform the vector search
            // limit: 5 means we get the top 5 most relevant chunks of text.
            const cursor = await collection.find(
                {},
                {
                    sort: {
                        $vector: embedding.data[0].embedding,
                    },
                    limit: 5,
                }
            );

            const documents = await cursor.toArray();

            // 4. Extract the text content from the retrieved documents
            docContext = documents.map((doc) => doc.text).join("\n");

            console.log(`Retrieved ${documents.length} documents for context.`);
        } catch (err) {
            console.error("Error retrieving documents:", err);
            // Even if retrieval fails, we can try to answer (though RAG won't work well)
            docContext = "";
        }

        // 5. Construct the Prompt for Groq
        // We combine the system instructions, the retrieved context, and the user's question.
        const template = {
            role: "system",
            content: `
        You are an AI assistant who knows everything about Formula One.
        Use the below context to augment what you know about Formula One racing.
        The context will provide you with the most recent page data from wikipedia,
        the official F1 website and others.
        
        If the context doesn't include the information you need answer based on your
        existing knowledge or
        what the context does or doesn't include.
        
        Format responses using markdown where applicable and don't return images.
        
        ----------------
        START CONTEXT
        ${docContext}
        END CONTEXT
        ----------------
        QUESTION: ${latestMessage}
        ----------------      
      `
        };

        // 6. Send the prompt to Groq for completion
        // Filter out any messages that don't have a valid role or content to prevent 400 errors.
        const history = messages
            .slice(0, -1)
            .filter((m: any) => m.role && m.content)
            .map((m: any) => ({ role: m.role, content: m.content }));

        const response = await groq.chat.completions.create({
            messages: [template, ...history, { role: "user", content: latestMessage }],
            model: "openai/gpt-oss-120b",
        });

        // 7. Return the response to the frontend
        // We return the content of the first choice provided by the model.
        return new Response(JSON.stringify({
            role: "assistant",
            content: response.choices[0]?.message?.content || "Sorry, I couldn't generate a response."
        }), {
            headers: { "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Error in chat route:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
