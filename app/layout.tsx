import { title } from "process"
import "./globals.css"
import { Children } from "react"

export const metadata = {
    title: "F11GPT",
    description: "Where you find all information about Formula one"
}

const RootLayout = ({ children }) => {
    return (
        <html lang="en">
            <body>
                {children}
            </body>
        </html>
    )
}

export default RootLayout