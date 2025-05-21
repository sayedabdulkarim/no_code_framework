import { ThemeProvider } from "@emotion/react";
import styled from "@emotion/styled";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import "./App.css";
import { ChatThread } from "./components/ChatThread";
import { EditorPanel } from "./components/EditorPanel";
import { Layout, WorkspaceLayout } from "./components/Layout";
import { PRDPanel } from "./components/PRDPanel";
// import Terminal from "./components/Terminal";
import { darkTheme } from "./theme";
import { Message } from "./types/chat";
import { CommandSuggestion } from "./types/terminal";

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

interface TerminalMessage {
  id: number;
  text: string;
  isError: boolean;
  timestamp: Date;
  suggestions?: CommandSuggestion[];
  isSuggestion?: boolean;
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
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeFile, setActiveFile] = useState("index.html");
  const [messages, setMessages] = useState<Message[]>([]);
  const [files, setFiles] = useState<Record<string, string>>({});

  // terminal start
  const [terminalMessages, setTerminalMessages] = useState<TerminalMessage[]>([
    {
      id: 1,
      text: "Welcome to the terminal. Error messages will appear here.",
      isError: false,
      timestamp: new Date(),
    },
  ]);

  const addMessage = useCallback((text: string, isError: boolean) => {
    setTerminalMessages((prevMessages) => [
      ...prevMessages,
      {
        id: Date.now(),
        text,
        isError,
        timestamp: new Date(),
      },
    ]);
  }, []);

  // Memoize addErrorMessage for Terminal component
  const addErrorMessage = useCallback(
    (message: string) => {
      addMessage(message, true);
    },
    [addMessage]
  );

  // Add command suggestions to the chat panel
  const addSuggestions = useCallback(
    (
      originalCommand: string,
      errorMessage: string,
      suggestions: CommandSuggestion[]
    ) => {
      setTerminalMessages((prevMessages) => [
        ...prevMessages,
        {
          id: Date.now(),
          text: `Suggestions for: ${originalCommand}`,
          isError: false,
          isSuggestion: true,
          suggestions,
          timestamp: new Date(),
        },
      ]);
    },
    []
  );

  // Run a command in the terminal
  const runCommand = useCallback(
    (command: string) => {
      if (!command || typeof command !== "string") {
        console.warn("Invalid command passed to runCommand:", command);
        return;
      }

      // The terminal component will expose this function globally
      if ((window as any).runTerminalCommand) {
        try {
          (window as any).runTerminalCommand(command);
          // Also add the command as a message to show what was executed
          addMessage(`Executed: ${command}`, false);
        } catch (e) {
          console.error("Error running command:", e);
          // Add an error message if the command execution fails
          addMessage(`Failed to execute: ${command}. Please try again.`, true);
        }
      } else {
        console.warn("runTerminalCommand function not available");
        addMessage(`Unable to run command: Terminal not ready`, true);
      }
    },
    [addMessage]
  );

  // terminal end

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
        "http://localhost:3001/generate-prd",
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
        "http://localhost:3001/approve-prd",
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

  //here we hv to call /initialize-project
  const handleInitializeProject = async () => {
    if (!prd) {
      setError("No PRD available to initialize the project.");
      return;
    }

    setLoading(true);
    try {
      const result = await axios.post(
        "http://localhost:3001/api/initialize-project",
        { prd }
      );
      const projectName = result.data.projectName;

      const updateResult = await axios.post(
        "http://localhost:3001/api/update-project",
        {
          projectName,
          requirements: prd,
        }
      );

      if (updateResult.data && updateResult.data.message) {
        addMessage(`Project updated: ${updateResult.data.message}`, false);
      } else if (updateResult.data && updateResult.data.error) {
        setError(updateResult.data.error);
        addErrorMessage(updateResult.data.error);
      } else {
        addMessage("Project updated, but no message returned.", false);
      }

      addMessage(`Project Path: ${result.data.projectPath}`, false);
    } catch (err: any) {
      console.error("Error initializing project:", err);
      setError("Failed to initialize the project. Please try again.");
      addErrorMessage("Failed to initialize the project.");
    } finally {
      setLoading(false);
    }
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
        {/* <Terminal
          addErrorMessage={addErrorMessage}
          addMessage={addMessage}
          addSuggestions={addSuggestions}
          runCommand={runCommand}
        /> */}
        {prd ? (
          <InitialLayout>
            <PRDPanel
              prd={prd}
              loading={loading}
              // onApprove={() => handlePRDApproval(true)}
              onApprove={() => handleInitializeProject()}
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
              files={files}
              activeFile={activeFile}
              onFileChange={setActiveFile}
              onCodeChange={handleCodeChange}
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
