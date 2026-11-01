import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createPackage } from "@electron/asar";
import rcedit from "rcedit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const winDir = path.join(rootDir, "Waymark-win32-x64");
const resourcesDir = path.join(winDir, "resources");
const localesDir = path.join(winDir, "locales");
const stageDir = path.join(rootDir, "release", ".asar-stage");

async function main() {
  console.log("1. Building optimized renderer (dist-electron)...");
  execSync("bun run desktop:build", { cwd: rootDir, stdio: "inherit" });

  console.log("2. Staging application files for ASAR...");
  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });

  fs.cpSync(path.join(rootDir, "dist-electron"), path.join(stageDir, "dist-electron"), {
    recursive: true,
  });
  fs.cpSync(path.join(rootDir, "electron"), path.join(stageDir, "electron"), {
    recursive: true,
  });

  const appPkg = {
    name: "waymark",
    productName: "Waymark",
    version: "1.0.0",
    description: "Personal offline workspace",
    main: "electron/main.cjs",
    author: "Waymark",
    private: true,
  };
  fs.writeFileSync(
    path.join(stageDir, "package.json"),
    JSON.stringify(appPkg, null, 2),
    "utf8",
  );

  console.log("3. Packing resources/app.asar...");
  const asarPath = path.join(resourcesDir, "app.asar");
  await createPackage(stageDir, asarPath);
  fs.rmSync(stageDir, { recursive: true, force: true });
  const asarSize = fs.statSync(asarPath).size;
  console.log(`   -> Packed app.asar (${(asarSize / 1024).toFixed(1)} KB)`);

  console.log("4. Pruning unused Chromium locale .pak files...");
  if (fs.existsSync(localesDir)) {
    const keepLocales = new Set(["en-US.pak", "en-GB.pak"]);
    let removedCount = 0;
    let removedBytes = 0;
    for (const entry of fs.readdirSync(localesDir)) {
      if (!keepLocales.has(entry)) {
        const fullPath = path.join(localesDir, entry);
        removedBytes += fs.statSync(fullPath).size;
        fs.unlinkSync(fullPath);
        removedCount++;
      }
    }
    console.log(
      `   -> Removed ${removedCount} unused locale files (${(removedBytes / (1024 * 1024)).toFixed(1)} MB saved)`,
    );
  }

  console.log("5. Embedding icon & Windows metadata into Waymark.exe...");
  const exePath = path.join(winDir, "Waymark.exe");
  const iconPath = path.join(rootDir, "electron", "assets", "icon.ico");
  if (fs.existsSync(exePath) && fs.existsSync(iconPath)) {
    await rcedit(exePath, {
      icon: iconPath,
      "file-version": "1.0.0.0",
      "product-version": "1.0.0.0",
      "version-string": {
        CompanyName: "Waymark",
        FileDescription: "Waymark — Personal Offline Workspace",
        ProductName: "Waymark",
        InternalName: "Waymark",
        OriginalFilename: "Waymark.exe",
        LegalCopyright: "Copyright © 2026 Waymark",
      },
    });
    console.log("   -> Embedded icon and version metadata into Waymark.exe");
  }

  console.log("6. Building standalone portable .exe & installer .exe...");
  execSync(
    'bunx electron-builder --win portable nsis --x64 --prepackaged "Waymark-win32-x64"',
    { cwd: rootDir, stdio: "inherit" },
  );

  for (const name of ["Waymark-Portable-x64.exe", "Waymark-Setup-x64.exe"]) {
    const builtPath = path.join(rootDir, "release", name);
    if (fs.existsSync(builtPath)) {
      const destRoot = path.join(rootDir, name);
      fs.copyFileSync(builtPath, destRoot);
      const sizeMb = (fs.statSync(destRoot).size / (1024 * 1024)).toFixed(1);
      console.log(`   -> Ready: ${destRoot} (${sizeMb} MB)`);
    }
  }

  console.log("Done!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
