import {
  SandpackCodeEditor,
  SandpackFileExplorer,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
} from "@codesandbox/sandpack-react";
import { sandpackDark } from "@codesandbox/sandpack-themes";
import styled from "@emotion/styled";
import React from "react";

interface LiveEditorProps {
  files: Record<string, string>;
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
  // Create a proper package.json if it doesn't exist
  const defaultPackageJson = {
    name: "todo-app",
    private: true,
    version: "0.0.0",
    type: "module",
    dependencies: {
      react: "^18.2.0",
      "react-dom": "^18.2.0",
      "@emotion/styled": "^11.11.0",
      "@radix-ui/react-icons": "^1.3.0",
      "@types/react": "^18.2.43",
      "@types/react-dom": "^18.2.17",
      "@vitejs/plugin-react": "^4.2.1",
      typescript: "^5.2.2",
      vite: "^5.0.8",
    },
  };

  // Create default Vite config if it doesn't exist
  const defaultViteConfig = `
    import { defineConfig } from 'vite'
    import react from '@vitejs/plugin-react'
    
    export default defineConfig({
      plugins: [react()],
    })
  `.trim();

  // Create default HTML if it doesn't exist
  const defaultHtml = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Todo App</title>
      </head>
      <body>
        <div id="root"></div>
        <script type="module" src="/src/main.tsx"></script>
      </body>
    </html>
  `.trim();

  // Prepare files with proper structure and defaults
  const sandpackFiles = {
    "/package.json": JSON.stringify(defaultPackageJson, null, 2),
    "/vite.config.ts": defaultViteConfig,
    "/index.html": defaultHtml,
    "/src/App.tsx":
      files["src/App.tsx"] ||
      "export default function App() { return <div>Hello World</div> }",
    "/src/main.tsx":
      files["src/main.tsx"] ||
      `
      import React from 'react'
      import ReactDOM from 'react-dom/client'
      import App from './App.tsx'
      
      ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      )
    `.trim(),
    ...Object.entries(files).reduce((acc, [path, content]) => {
      if (!path.startsWith("/")) {
        acc["/" + path] = content;
      } else {
        acc[path] = content;
      }
      return acc;
    }, {} as Record<string, string>),
  };

  return (
    <Container isFullScreen={isFullScreen}>
      <SandpackProvider
        theme={sandpackDark}
        template="vite-react-ts"
        files={sandpackFiles}
        customSetup={{
          dependencies: defaultPackageJson.dependencies,
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
              <SandpackCodeEditor
                showTabs
                showLineNumbers
                showInlineErrors
                wrapContent
                closableTabs
                initMode="immediate"
              />
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
