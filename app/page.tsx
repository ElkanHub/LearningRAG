"use client";
import ReactMarkdown from 'react-markdown';

import { useState } from "react";

// Define the structure of a message
type Message = {
    role: "user" | "assistant";
    content: string;
};

export default function Home() {
    // State to store the history of messages
    const [messages, setMessages] = useState<Message[]>([
        { role: "assistant", content: "Hello! ask me anything about Formula One." },
    ]);

    // State to store the current input from the user
    const [input, setInput] = useState("");

    // State to show a loading indicator while fetching the response
    const [isLoading, setIsLoading] = useState(false);

    // Function to handle sending a message
    const handleSend = async () => {
        if (!input.trim()) return;

        // 1. Add the user's message to the state so it appears in the UI immediately
        const userMessage: Message = { role: "user", content: input };
        setMessages((prev) => [...prev, userMessage]);
        setInput(""); // Clear the input box
        setIsLoading(true);

        try {
            // 2. Send the message history to our backend API
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messages: [...messages, userMessage],
                }),
            });

            // 3. Parse the response from the backend
            const data = await response.json();

            if (response.ok) {
                // 4. Add the AI's response to the state
                setMessages((prev) => [...prev, data]);
            } else {
                console.error("Error from backend:", data.error);
                // Optionally show an error toast or alert here
            }
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="flex flex-col min-h-screen items-center justify-center p-4 bg-gray-50 text-gray-800 font-sans">
            <div className="w-full max-w-2xl bg-white shadow-xl rounded-lg overflow-hidden flex flex-col h-[80vh]">

                {/* Header */}
                <header className="bg-red-600 p-4 text-white text-center font-bold text-xl uppercase tracking-wider">
                    F1 RAG Chatbot
                </header>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"
                                }`}
                        >
                            <div
                                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${msg.role === "user"
                                    ? "bg-red-600 text-white rounded-br-none"
                                    : "bg-gray-100 text-gray-800 rounded-bl-none border border-gray-200"
                                    }`}
                            >
                                {msg.role === "user" ? (
                                    <div className="prose prose-invert prose-sm max-w-none">
                                        {msg.content}
                                    </div>
                                ) : (
                                    <div className="prose prose-sm max-w-none break-words">
                                        <ReactMarkdown>
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-gray-100 text-gray-500 rounded-2xl px-4 py-2 text-sm italic">
                                Thinking...
                            </div>
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-gray-100 bg-gray-50">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSend()}
                            placeholder="Ask about F1..."
                            className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all shadow-sm"
                            disabled={isLoading}
                        />
                        <button
                            onClick={handleSend}
                            disabled={isLoading}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-full p-2 px-6 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            Send
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}
