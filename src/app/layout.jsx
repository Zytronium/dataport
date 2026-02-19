import "./globals.css";

export const metadata = {
  title: "DATAPORT.exe",
  description: "A text-based web game where you're stuck in a computer system.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={"antialiased"}
      >
        {children}
      </body>
    </html>
  );
}
