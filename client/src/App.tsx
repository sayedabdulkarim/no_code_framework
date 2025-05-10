import React, { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { ThemeProvider } from "@emotion/react";
import styled from "@emotion/styled";
import { darkTheme } from "./theme";
import { RequirementForm } from "./components/RequirementForm";
import axios from "axios";
import "./App.css";
import { EditorPanel } from "./components/EditorPanel";
import { Layout, ToggleButton, WorkspaceLayout } from "./components/Layout";
import { PRDPanel } from "./components/PRDPanel";
import { ChatPanel } from "./components/ChatPanel";
import { ChatThread } from "./components/ChatThread";
import { Message, MessageCategory } from "./types/chat";

interface GenerateResponse {
  files: {
    "index.html": string;
    "style.css": string;
    "script.js": string;
  };
  analysis?: string;
  plan?: string;
  feedback?: string;
}

interface PRDResponse {
  prd: string;
}

function App() {
  const [requirement, setRequirement] = useState("");
  const [loading, setLoading] = useState(false);
  const [prd, setPRD] = useState<string | null>(null);
  const [response, setResponse] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<{ [key: string]: boolean }>({});
  const [activeTab, setActiveTab] = useState("chat");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeFile, setActiveFile] = useState("index.html");
  const [messages, setMessages] = useState<Message[]>([]);
  const [files, setFiles] = useState<Record<string, string>>({});

  const handleSendMessage = async (message: string) => {
    setMessages((prev) => [
      ...prev,
      {
        type: "user",
        content: message,
        category: "requirement",
      },
    ]);

    setLoading(true);
    try {
      // Generate PRD first
      const prdResult = await axios.post<PRDResponse>(
        "http://localhost:8000/generate-prd",
        { requirement: message }
      );

      setMessages((prev) => [
        ...prev,
        {
          type: "agent",
          content: prdResult.data.prd,
          category: "prd",
        },
      ]);

      // Set PRD and wait for approval
      setPRD(prdResult.data.prd);
      setRequirement(message);
    } catch (err) {
      console.error("Error:", err);
      setError("Something went wrong. Please try again.");
      setMessages((prev) => [
        ...prev,
        {
          type: "agent",
          content: "Sorry, there was an error. Please try again.",
          category: "error",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handlePRDApproval = async (approved: boolean) => {
    if (!approved || !prd || !requirement) {
      setPRD(null);
      return;
    }

    setLoading(true);
    try {
      const result = await axios.post<GenerateResponse>(
        "http://localhost:8000/approve-prd",
        { requirement, prd, approved }
      );

      if (result.data.analysis) {
        setMessages((prev) => [
          ...prev,
          {
            type: "agent",
            content: result.data.analysis!,
            category: "analysis",
          },
        ]);
      }
      if (result.data.plan) {
        setMessages((prev) => [
          ...prev,
          {
            type: "agent",
            content: result.data.plan!,
            category: "plan",
          },
        ]);
      }

      setResponse(result.data);
      setPRD(null);
    } catch (err) {
      console.error("Error:", err);
      setError("Failed to generate UI. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus({ ...copyStatus, [type]: true });

      setTimeout(() => {
        setCopyStatus({ ...copyStatus, [type]: false });
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const getPreviewDocument = () => {
    // Use the files state instead of response.files for live updates
    if (!files || Object.keys(files).length === 0) return "";

    return `
      <html>
        <head>
          <style>${files["style.css"] || ""}</style>
        </head>
        <body>
          ${files["index.html"] || ""}
          <script>${files["script.js"] || ""}</script>
        </body>
      </html>
    `;
  };

  const handleCodeChange = (filename: string, content: string) => {
    setFiles((prev) => ({
      ...prev,
      [filename]: content,
    }));
  };

  // Initialize files when response changes
  useEffect(() => {
    if (response?.files) {
      setFiles(response.files);
    }
  }, [response]);

  return (
    <ThemeProvider theme={darkTheme}>
      <Layout>
        {prd ? (
          <InitialLayout>
            <PRDPanel
              prd={prd}
              loading={loading}
              onApprove={() => handlePRDApproval(true)}
              onReject={() => handlePRDApproval(false)}
            />
          </InitialLayout>
        ) : !response ? (
          <InitialLayout>
            <ChatThread
              messages={messages}
              onSendMessage={handleSendMessage}
              loading={loading}
            />
          </InitialLayout>
        ) : (
          <WorkspaceLayout isFullScreen={isFullScreen}>
            {!isFullScreen && (
              <ChatThread
                messages={messages}
                onSendMessage={handleSendMessage}
                loading={loading}
              />
            )}

            <EditorPanel
              files={files} // Use files state instead of response.files
              activeFile={activeFile}
              onFileChange={setActiveFile}
              onCodeChange={handleCodeChange}
              getPreviewDocument={getPreviewDocument}
              isFullScreen={isFullScreen}
              onToggleFullscreen={() => setIsFullScreen(!isFullScreen)}
            />
          </WorkspaceLayout>
        )}
      </Layout>
    </ThemeProvider>
  );
}

const InitialLayout = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  max-width: 800px;
  margin: 0 auto;
  padding: ${(props) => props.theme.spacing.md};
`;

export default App;
