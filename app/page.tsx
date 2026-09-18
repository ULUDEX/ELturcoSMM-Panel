import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-static";

export default async function Home() {
  const filePath = path.join(process.cwd(), "public", "site", "index.html");
  const html = await fs.readFile(filePath, "utf8");

  return (
    <iframe
      srcDoc={html}
      title="ElTurco SMM"
      style={{ width: "100%", minHeight: "100vh", border: 0, display: "block" }}
    />
  );
}
