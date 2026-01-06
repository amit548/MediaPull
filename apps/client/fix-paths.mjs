import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outDir = path.join(__dirname, "out");

function getAllHtmlFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function (file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllHtmlFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      if (file.endsWith(".html")) {
        arrayOfFiles.push(path.join(dirPath, "/", file));
      }
    }
  });

  return arrayOfFiles;
}

try {
  const htmlFiles = getAllHtmlFiles(outDir);

  htmlFiles.forEach((file) => {
    let content = fs.readFileSync(file, "utf8");

    content = content.replace(/"\/_next\//g, '"./_next/');
    content = content.replace(/'\/_next\//g, "'./_next/");

    content = content.replace(/src="\/([^"]+)"/g, 'src="./$1"');
    content = content.replace(/href="\/([^"]+)"/g, 'href="./$1"');

    fs.writeFileSync(file, content);
    console.log(`Fixed paths in ${file}`);
  });
  console.log("Static export path fixing complete.");
} catch (e) {
  console.log("No HTML files found or error processing.", e);
}
