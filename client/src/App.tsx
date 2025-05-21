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

interface Project {
  name: string;
  path: string;
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

  // Project management states
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [updateRequirement, setUpdateRequirement] = useState("");

  const [test, setTest] = useState(false);

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
        "http://localhost:5001/generate-prd",
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
        "http://localhost:5001/approve-prd",
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
        "http://localhost:5001/api/initialize-project",
        { prd }
      );
      const projectName = result.data.projectName;

      const updateResult = await axios.post(
        "http://localhost:5001/api/update-project",
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

  // Fetch projects on component mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const result = await axios.get(
          "http://localhost:5001/api/list-projects"
        );
        console.log("Fetched projects:", result.data);
        setProjects(result.data.projects || []);
      } catch (err) {
        console.error("Error fetching projects:", err);
        setError("Failed to fetch projects");
      }
    };

    fetchProjects();
  }, [test, prd]);

  // Handle project update
  const handleUpdateProject = async () => {
    if (!selectedProject || !updateRequirement.trim()) {
      setError("Please select a project and enter update requirements");
      return;
    }

    setLoading(true);
    try {
      const result = await axios.post(
        "http://localhost:5001/api/update-project",
        {
          projectName: selectedProject,
          requirements: updateRequirement,
        }
      );

      if (result.data && result.data.message) {
        addMessage(`Project updated: ${result.data.message}`, false);

        // Add success message
        setMessages((prev) => [
          ...prev,
          {
            type: "agent",
            content: `Project ${selectedProject} updated successfully! ${
              result.data.explanation || ""
            }`,
            category: "success",
          },
        ]);

        // Reset update requirement
        setUpdateRequirement("");
      } else if (result.data && result.data.error) {
        setError(result.data.error);
        addErrorMessage(result.data.error);
      }
    } catch (err: any) {
      console.error("Error updating project:", err);
      setError("Failed to update project");
      addErrorMessage(
        "Failed to update project: " +
          (err.response?.data?.error || err.message)
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle clear history
  const handleClearHistory = async (projectName: string) => {
    try {
      const result = await axios.delete(
        `http://localhost:5001/api/clear-project-history/${projectName}`
      );

      if (result.data && result.data.message) {
        addMessage(`${result.data.message}`, false);

        // Add success message
        setMessages((prev) => [
          ...prev,
          {
            type: "agent",
            content: `Project history cleared for ${projectName}. Future updates will start from a clean slate.`,
            category: "success",
          },
        ]);
      }
    } catch (err: any) {
      console.error("Error clearing project history:", err);
      setError("Failed to clear project history");
      addErrorMessage(
        "Failed to clear project history: " +
          (err.response?.data?.error || err.message)
      );
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <button onClick={() => console.log({ projects }, " ppp")}>Hello</button>
      <button onClick={() => setTest(!test)}>Test</button>
      <ProjectManagementPanel>
        <h2>Your Projects</h2>
        <ProjectPillContainer>
          {projects.map((project) => (
            <ProjectPill
              key={project.name}
              isSelected={selectedProject === project.name}
              onClick={() => setSelectedProject(project.name)}
            >
              {project.name}
            </ProjectPill>
          ))}
        </ProjectPillContainer>

        {selectedProject && (
          <ProjectUpdateForm>
            <h3>Update Project: {selectedProject}</h3>
            <textarea
              placeholder="Enter new requirements or updates for your project"
              value={updateRequirement}
              onChange={(e) => setUpdateRequirement(e.target.value)}
              rows={5}
            />
            <ButtonContainer>
              <UpdateButton
                onClick={handleUpdateProject}
                disabled={loading || !updateRequirement.trim()}
              >
                {loading ? "Updating..." : "Update Project"}
              </UpdateButton>
              <ClearHistoryButton
                onClick={() => handleClearHistory(selectedProject)}
                disabled={loading}
              >
                Clear History
              </ClearHistoryButton>
            </ButtonContainer>
            {error && <ErrorMessage>{error}</ErrorMessage>}
          </ProjectUpdateForm>
        )}
      </ProjectManagementPanel>
      <Layout>
        {/* <Terminal
          addErrorMessage={addErrorMessage}
          addMessage={addMessage}
          addSuggestions={addSuggestions}
          runCommand={runCommand}
        /> */}
        {/* Project management UI */}
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
            {/* Original chat thread */}
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

// Project management UI components
const ProjectManagementPanel = styled.div`
  width: 100%;
  margin-bottom: 20px;
  padding: 20px;
  background: ${(props) => props.theme.colors.surface};
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

  h2,
  h3 {
    margin-top: 0;
    margin-bottom: 15px;
    color: ${(props) => props.theme.colors.primary};
  }
`;

const ProjectPillContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
`;

const ProjectPill = styled.div<{ isSelected: boolean }>`
  padding: 8px 16px;
  border-radius: 20px;
  background: ${(props) =>
    props.isSelected
      ? props.theme.colors.primary
      : props.theme.colors.background};
  color: ${(props) => (props.isSelected ? "#fff" : props.theme.colors.text)};
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;

  &:hover {
    transform: translateY(-2px);
    background: ${(props) =>
      props.isSelected
        ? props.theme.colors.primary
        : props.theme.colors.surface};
  }
`;

const ProjectUpdateForm = styled.div`
  width: 100%;
  padding-top: 15px;
  border-top: 1px solid ${(props) => props.theme.colors.border};

  textarea {
    margin-bottom: 15px;
    border: 1px solid ${(props) => props.theme.colors.border};
    border-radius: 4px;
    background: ${(props) => props.theme.colors.background};
    padding: 12px;
    width: 100%;
    resize: vertical;
    color: ${(props) => props.theme.colors.text};
    font-family: inherit;

    &:focus {
      outline: none;
      border-color: ${(props) => props.theme.colors.primary};
    }
  }
`;

const UpdateButton = styled.button`
  padding: 10px 20px;
  background: ${(props) => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: ${(props) => `${props.theme.colors.primary}dd`};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  color: #e74c3c;
  margin-top: 10px;
  font-size: 14px;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
`;

const ClearHistoryButton = styled.button`
  padding: 10px 20px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: #5a6268;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export default App;
