import {
  SandpackCodeEditor,
  SandpackFileExplorer,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
  useActiveCode,
  SandpackCodeViewer,
} from "@codesandbox/sandpack-react";
import { sandpackDark } from "@codesandbox/sandpack-themes";
import styled from "@emotion/styled";
import React from "react";

// Update type definitions with proper index signatures
type FileMap = {
  [key: string]: string;
};

interface BaseFiles extends FileMap {
  "/src/App.tsx": string;
  "/src/main.tsx": string;
  "/package.json": string;
  "/vite.config.ts": string;
  "/index.html": string;
  "/tsconfig.json": string;
  [key: string]: string; // Allow additional string keys
}

interface LiveEditorProps {
  files: FileMap;
  activeFile?: string;
  onFileChange?: (filePath: string) => void;
  isFullScreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const LiveEditor: React.FC<LiveEditorProps> = ({
  files,
  activeFile,
  onFileChange,
  isFullScreen,
  onToggleFullscreen,
}) => {
  // Type the base files correctly
  const baseFiles: BaseFiles = {
    "/src/App.tsx": `import React from 'react';
export default function App() {
  return <div>Todo App</div>;
}`,
    "/src/main.tsx": `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
    "/package.json": JSON.stringify(
      {
        name: "vite-react-typescript",
        private: true,
        version: "0.0.0",
        type: "module",
        scripts: {
          dev: "vite",
          build: "tsc && vite build",
          preview: "vite preview",
        },
        dependencies: {
          react: "^18.2.0",
          "react-dom": "^18.2.0",
          "@emotion/styled": "^11.11.0",
        },
        devDependencies: {
          "@types/react": "^18.2.43",
          "@types/react-dom": "^18.2.17",
          "@vitejs/plugin-react": "^4.2.1",
          typescript: "^5.2.2",
          vite: "^4.5.0",
        },
      },
      null,
      2
    ),
    "/vite.config.ts": `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()]
});`,
    "/index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React + TS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
    "/tsconfig.json": `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}`,
  };

  // Create a proper merged files object with type assertion
  const mergedFiles: FileMap = { ...baseFiles };

  // Add additional files with proper type checking
  Object.entries(files).forEach(([path, content]) => {
    if (!content) return;
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    if (normalizedPath.startsWith("/src/")) {
      mergedFiles[normalizedPath] = content;
    }
  });

  // Remove the useSandpack hook from here
  return (
    <Container isFullScreen={isFullScreen}>
      <SandpackProvider
        theme={sandpackDark}
        template="vite-react-ts"
        files={mergedFiles}
        customSetup={{
          entry: "/src/main.tsx",
          environment: "node",
          dependencies: {
            react: "^18.2.0",
            "react-dom": "^18.2.0",
            "@emotion/styled": "^11.11.0",
            vite: "^4.5.0",
            "@vitejs/plugin-react": "^4.2.1",
          },
        }}
        options={{
          activeFile: activeFile
            ? `/${activeFile.replace(/^\/+/, "")}`
            : "/src/App.tsx",
          visibleFiles: [
            "/src/App.tsx",
            "/src/main.tsx",
            "/index.html",
            "/package.json",
            "/vite.config.ts",
          ],
          recompileMode: "immediate",
          recompileDelay: 300,
        }}
      >
        <EditorContainer>
          <ToolbarWrapper>
            <SandpackFileExplorer />
            <FullScreenButton onClick={onToggleFullscreen}>
              {isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
            </FullScreenButton>
          </ToolbarWrapper>

          <SandpackLayout>
            <EditorWrapper>
              <FileChangeWrapper onFileChange={onFileChange}>
                <SandpackCodeEditor
                  showTabs
                  showLineNumbers
                  showInlineErrors
                  wrapContent
                  closableTabs
                  readOnly={false}
                />
              </FileChangeWrapper>
            </EditorWrapper>
            <PreviewWrapper>
              <SandpackPreview
                showNavigator
                showRefreshButton={false}
                showOpenInCodeSandbox={false}
              />
            </PreviewWrapper>
          </SandpackLayout>
        </EditorContainer>
      </SandpackProvider>
    </Container>
  );
};

// Update the FileChangeWrapper to use a simpler approach
const FileChangeWrapper: React.FC<{
  children: React.ReactNode;
  onFileChange?: (filePath: string) => void;
}> = ({ children, onFileChange }) => {
  const { sandpack } = useSandpack();

  // Use a simpler approach with useEffect to track file changes
  React.useEffect(() => {
    if (!onFileChange || !sandpack.activeFile) return;
    
    // When active file changes, notify parent component
    onFileChange(sandpack.activeFile.replace(/^\//, ''));
    
    // We're not using sandpack.listen since it doesn't exist in the type
  }, [sandpack.activeFile, onFileChange, sandpack.files]);

  return <>{children}</>;
};

const Container = styled.div<{ isFullScreen?: boolean }>`
  height: 100%;
  width: 100%;
  background: ${(props) => props.theme.colors.background};
  ${(props) =>
    props.isFullScreen &&
    `
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1000;
  `}
`;

const EditorContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const ToolbarWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: ${(props) => props.theme.colors.surface};
  border-bottom: 1px solid ${(props) => props.theme.colors.border};
`;

const EditorWrapper = styled.div`
  flex: 1;
  min-width: 400px;
  height: 100%;
`;

const PreviewWrapper = styled.div`
  flex: 1;
  height: 100%;
`;

const FullScreenButton = styled.button`
  padding: 6px 12px;
  background: ${(props) => props.theme.colors.surface};
  color: ${(props) => props.theme.colors.text};
  border: 1px solid ${(props) => props.theme.colors.border};
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;

  &:hover {
    background: ${(props) => props.theme.colors.background};
  }
`;
