import {
  SandpackCodeEditor,
  SandpackFileExplorer,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
} from "@codesandbox/sandpack-react";
import { sandpackDark } from "@codesandbox/sandpack-themes";
// import { sandpackDark } from "@codesandbox/sandpack-themes";
import styled from "@emotion/styled";
import React from "react";

// Define a proper index signature for our file types
type FileRecord = Record<string, string>;

interface LiveEditorProps {
  files: Record<string, string>;
  activeFile?: string;
  onFileChange?: (filePath: string) => void;
  isFullScreen?: boolean;
  onToggleFullscreen?: () => void;
}

// Define minimum files needed for a working Vite React app
const defaultFiles: FileRecord = {
  "/src/App.tsx": `import React from 'react'

export default function App() {
  return <div>Todo App</div>
}`,
  "/src/main.tsx": `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)`,
  "/index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
  "/package.json": JSON.stringify(
    {
      name: "vite-react-ts",
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview",
      },
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0",
      },
      devDependencies: {
        "@types/react": "^18.2.15",
        "@types/react-dom": "^18.2.7",
        "@vitejs/plugin-react": "^4.0.3",
        typescript: "^5.0.2",
        vite: "^4.4.5",
      },
    },
    null,
    2
  ),
  "/vite.config.ts": `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()]
})`,
};

export const LiveEditor: React.FC<LiveEditorProps> = ({
  files,
  activeFile,
  onFileChange,
  isFullScreen,
  onToggleFullscreen,
}) => {
  // Create merged files as a Record type with string keys
  const mergedFiles: FileRecord = { ...defaultFiles };

  // Add user files with normalized paths
  Object.entries(files).forEach(([path, content]) => {
    if (!content) return;

    // Normalize path to ensure no duplicates
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    // Only add files that should be in the project
    if (normalizedPath.startsWith("/src/") && content.trim()) {
      mergedFiles[normalizedPath] = content;
    }
  });

  const FileChangeListener = ({
    onFileChange,
    children,
  }: {
    onFileChange?: LiveEditorProps["onFileChange"];
    children: React.ReactNode;
  }) => {
    // This is just a wrapper component that doesn't use useSandpack
    // We'll handle file changes through other mechanisms
    return <>{children}</>;
  };

  return (
    <Container isFullScreen={isFullScreen}>
      <SandpackProvider
        theme={sandpackDark}
        template="vite-react-ts"
        files={mergedFiles}
        customSetup={{
          dependencies: {
            react: "^18.2.0",
            "react-dom": "^18.2.0",
          },
          entry: "/src/main.tsx",
        }}
        options={{
          activeFile: activeFile
            ? `/${activeFile.replace(/^\/+/, "")}`
            : "/src/App.tsx",
          recompileMode: "delayed",
          recompileDelay: 500,
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
              <FileChangeListener onFileChange={onFileChange}>
                <SandpackCodeEditor
                  showTabs
                  showLineNumbers
                  showInlineErrors
                  wrapContent
                  closableTabs
                />
              </FileChangeListener>
            </EditorWrapper>
            <PreviewWrapper>
              <SandpackPreview
                showNavigator
                showRefreshButton
                showOpenInCodeSandbox={false}
              />
            </PreviewWrapper>
          </SandpackLayout>
        </EditorContainer>
      </SandpackProvider>
    </Container>
  );
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
